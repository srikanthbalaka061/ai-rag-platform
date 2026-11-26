import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { MarketDataError } from "../core/market-data.errors.js";
import {
  getLatestDailyMarketData,
  getSavedMarketData,
  requestMarketData,
  screenStocks,
} from "../services/index.js";
import { resolveMarketDataEndpoint } from "../validation/market-data.validation.js";
import {
  validateDealQuery,
  validateInsiderTradeQuery,
  validateScreenerQuery,
} from "../validation/market-data.requests.js";
import type { DailyMarketDataDataset } from "../core/market-data.types.js";

const router = Router();
const cacheKeySchema = z.string().regex(/^[a-f0-9]{64}$/i);
const MAX_QUERY_BYTES = 2_048;
const MAX_QUERY_ENTRIES = 50;

function requestQuery(request: Request): URLSearchParams {
  const queryString = request.originalUrl.split("?")[1] ?? "";
  if (Buffer.byteLength(queryString, "utf8") > MAX_QUERY_BYTES) {
    throw new MarketDataError(
      "Query string exceeds the maximum length",
      400,
      "QUERY_TOO_LARGE"
    );
  }

  const query = new URLSearchParams(queryString);
  if ([...query].length > MAX_QUERY_ENTRIES) {
    throw new MarketDataError(
      "Too many query parameters",
      400,
      "TOO_MANY_QUERY_PARAMETERS"
    );
  }
  for (const [key, value] of query) {
    if (
      key.length === 0 ||
      key.length > 100 ||
      value.length > 500 ||
      /[\u0000-\u001f\u007f]/.test(key + value)
    ) {
      throw new MarketDataError(
        "Query parameters contain an invalid value",
        400,
        "INVALID_QUERY_PARAMETER"
      );
    }
  }
  return query;
}

function sendFreshResponse(
  response: Response,
  result: Awaited<ReturnType<typeof requestMarketData>>
): void {
  response.setHeader("X-Market-Data-Cache-Key", result.cacheKey);
  response.setHeader("X-Market-Data-Fetched-At", result.fetchedAt);
  response.status(result.status).json(result.response);
}

function sendDailySnapshot(
  response: Response,
  snapshot: Awaited<ReturnType<typeof getLatestDailyMarketData>>
): void {
  response.setHeader("X-Market-Data-Source", "database");
  response.setHeader("X-Market-Data-Snapshot-Date", snapshot.snapshotDate);
  response.setHeader("X-Market-Data-Fetched-At", snapshot.fetchedAt);
  response.status(200).json(snapshot.response);
}

async function sendDailyMarketData(
  dataset: DailyMarketDataDataset,
  request: Request,
  response: Response
): Promise<void> {
  const query = requestQuery(request);
  if (dataset === "insider_trades") {
    validateInsiderTradeQuery(query);
  } else {
    validateDealQuery(query);
  }
  sendDailySnapshot(response, await getLatestDailyMarketData(dataset, query));
}

router.get("/cache/:cacheKey", async (request, response) => {
  const validation = cacheKeySchema.safeParse(request.params.cacheKey);
  if (!validation.success) {
    throw new MarketDataError(
      "A valid cache key is required",
      400,
      "INVALID_CACHE_KEY"
    );
  }
  response.json(await getSavedMarketData(validation.data));
});

router.get("/deals/bulk", async (request, response) => {
  await sendDailyMarketData("bulk_deals", request, response);
});

router.get("/deals/block", async (request, response) => {
  await sendDailyMarketData("block_deals", request, response);
});

router.get("/insider-trades", async (request, response) => {
  await sendDailyMarketData("insider_trades", request, response);
});

router.get("/screener", async (request, response) => {
  const query = requestQuery(request);
  validateScreenerQuery(query);
  sendFreshResponse(response, await screenStocks(query));
});

router.get(/.*/, async (request, response: Response) => {
  const endpoint = resolveMarketDataEndpoint(request.path);
  const result = await requestMarketData(endpoint, requestQuery(request));
  sendFreshResponse(response, result);
});

router.all(/.*/, (_request, response) => {
  response.setHeader("Allow", "GET");
  response.status(405).json({
    error: { code: "METHOD_NOT_ALLOWED", message: "Only GET is supported" },
  });
});

export default router;
