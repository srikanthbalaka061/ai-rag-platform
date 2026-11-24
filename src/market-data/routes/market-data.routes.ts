import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { MarketDataError } from "../market-data.errors.js";
import {
  marketDataAuthenticationMiddleware,
  marketDataErrorMiddleware,
  marketDataRequestMiddleware,
} from "../middleware/market-data.middleware.js";
import {
  getLatestDailyMarketData,
  getSavedMarketData,
  requestMarketData,
  screenStocks,
} from "../services/service.js";
import { resolveMarketDataEndpoint } from "../market-data.validation.js";
import {
  validateDealQuery,
  validateInsiderTradeQuery,
  validateScreenerQuery,
  validateStockSymbol,
} from "../market-data.requests.js";

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

router.use(marketDataRequestMiddleware);
router.use(marketDataAuthenticationMiddleware);

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
  const query = requestQuery(request);
  validateDealQuery(query);
  sendDailySnapshot(
    response,
    await getLatestDailyMarketData("bulk_deals", query)
  );
});

router.get("/deals/block", async (request, response) => {
  const query = requestQuery(request);
  validateDealQuery(query);
  sendDailySnapshot(
    response,
    await getLatestDailyMarketData("block_deals", query)
  );
});

router.get("/insider-trades", async (request, response) => {
  const query = requestQuery(request);
  validateInsiderTradeQuery(query);
  sendDailySnapshot(
    response,
    await getLatestDailyMarketData("insider_trades", query)
  );
});

router.get("/screener", async (request, response) => {
  const query = requestQuery(request);
  validateScreenerQuery(query);
  sendFreshResponse(response, await screenStocks(query));
});

router.get("/stocks/:ticker/bulk-deals", async (request, response) => {
  const query = requestQuery(request);
  validateDealQuery(query);
  const symbol = validateStockSymbol(request.params.ticker);
  sendDailySnapshot(
    response,
    await getLatestDailyMarketData("bulk_deals", query, symbol)
  );
});

router.get("/stocks/:ticker/block-deals", async (request, response) => {
  const query = requestQuery(request);
  validateDealQuery(query);
  const symbol = validateStockSymbol(request.params.ticker);
  sendDailySnapshot(
    response,
    await getLatestDailyMarketData("block_deals", query, symbol)
  );
});

router.get("/stocks/:ticker/insider-trades", async (request, response) => {
  const query = requestQuery(request);
  validateInsiderTradeQuery(query);
  const symbol = validateStockSymbol(request.params.ticker);
  sendDailySnapshot(
    response,
    await getLatestDailyMarketData("insider_trades", query, symbol)
  );
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

router.use(marketDataErrorMiddleware);

export default router;
