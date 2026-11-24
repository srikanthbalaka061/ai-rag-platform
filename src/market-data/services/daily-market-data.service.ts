import { marketDataConfig } from "../market-data.config.js";
import { MarketDataError } from "../market-data.errors.js";
import { paginateDailyMarketData } from "../daily-market-data.utils.js";
import { fetchBharatStock } from "../api/bharatstock.client.js";
import type {
  DailyMarketDataDataset,
  JsonValue,
} from "../market-data.types.js";
import {
  findLatestDailyMarketDataSnapshot,
  saveDailyMarketDataSnapshot,
} from "../repositories/market-data.repository.js";

type JsonObject = { [key: string]: JsonValue };

const feeds: Array<{
  dataset: DailyMarketDataDataset;
  endpoint: string;
}> = [
  {
    dataset: "bulk_deals",
    endpoint: "deals/bulk",
  },
  {
    dataset: "block_deals",
    endpoint: "deals/block",
  },
  {
    dataset: "insider_trades",
    endpoint: "insider-trades",
  },
];

function isJsonObject(value: JsonValue): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getPagination(
  response: JsonValue
): { body: JsonObject; rows: JsonValue[]; pagination: JsonObject } {
  if (!isJsonObject(response)) {
    throw new MarketDataError(
      "BharatStock returned an invalid paginated response",
      502,
      "UPSTREAM_INVALID_RESPONSE"
    );
  }
  const rows = response.data;
  const pagination = response.pagination;
  if (
    !Array.isArray(rows) ||
    pagination === null ||
    typeof pagination !== "object" ||
    Array.isArray(pagination)
  ) {
    throw new MarketDataError(
      "BharatStock response is missing paginated data",
      502,
      "UPSTREAM_INVALID_RESPONSE"
    );
  }
  return { body: response, rows, pagination };
}

function getNonNegativeInteger(value: JsonValue | undefined): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

async function fetchCompleteFeed(endpoint: string): Promise<JsonValue> {
  const pageSize = marketDataConfig.syncPageSize;
  const firstPageQuery = new URLSearchParams({
    page: "1",
    page_size: String(pageSize),
  });
  const firstResponse = await fetchPageWithRetry(endpoint, firstPageQuery);
  const firstPage = getPagination(firstResponse);
  const totalItems = getNonNegativeInteger(firstPage.pagination.total_items);
  if (totalItems === null) {
    throw new MarketDataError(
      "BharatStock pagination.total_items is missing or invalid",
      502,
      "UPSTREAM_INVALID_RESPONSE"
    );
  }

  const actualPageSize =
    getNonNegativeInteger(firstPage.pagination.page_size) ??
    (firstPage.rows.length > 0 ? firstPage.rows.length : pageSize);
  if (actualPageSize < 1) {
    throw new MarketDataError(
      "BharatStock returned an invalid page size",
      502,
      "UPSTREAM_INVALID_RESPONSE"
    );
  }

  const totalPages = Math.max(1, Math.ceil(totalItems / actualPageSize));
  if (totalPages > marketDataConfig.syncMaxPages) {
    throw new MarketDataError(
      `BharatStock feed exceeds the configured page limit (${marketDataConfig.syncMaxPages})`,
      502,
      "SYNC_PAGE_LIMIT_EXCEEDED"
    );
  }

  const rows = [...firstPage.rows];
  let responseBytes = Buffer.byteLength(JSON.stringify(firstPage.body), "utf8");
  for (let page = 2; page <= totalPages; page += 1) {
    const query = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
    });
    const response = await fetchPageWithRetry(endpoint, query);
    const currentPage = getPagination(response);
    responseBytes += Buffer.byteLength(
      JSON.stringify(currentPage.body),
      "utf8"
    );
    if (responseBytes > marketDataConfig.maxSnapshotBytes) {
      throw new MarketDataError(
        "BharatStock feed exceeds the configured snapshot size limit",
        502,
        "SYNC_SNAPSHOT_TOO_LARGE"
      );
    }
    rows.push(...currentPage.rows);
  }

  if (responseBytes > marketDataConfig.maxSnapshotBytes) {
    throw new MarketDataError(
      "BharatStock feed exceeds the configured snapshot size limit",
      502,
      "SYNC_SNAPSHOT_TOO_LARGE"
    );
  }

  if (rows.length !== totalItems) {
    throw new MarketDataError(
      `BharatStock returned ${rows.length} of ${totalItems} expected records`,
      502,
      "INCOMPLETE_UPSTREAM_FEED"
    );
  }

  const pagination: JsonObject = {
    ...firstPage.pagination,
    page: 1,
    page_size: actualPageSize,
    total_items: rows.length,
    total_pages: totalPages,
  };
  return { ...firstPage.body, data: rows, pagination };
}

async function fetchPageWithRetry(
  endpoint: string,
  query: URLSearchParams
): Promise<JsonValue> {
  const retryableCodes = new Set([
    "UPSTREAM_UNAVAILABLE",
    "UPSTREAM_TIMEOUT",
    "UPSTREAM_REQUEST_FAILED",
  ]);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await fetchBharatStock(endpoint, query);
    } catch (error) {
      if (
        !(error instanceof MarketDataError) ||
        !retryableCodes.has(error.code) ||
        attempt === 3
      ) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
    }
  }
  throw new MarketDataError(
    "BharatStock page fetch attempts were exhausted",
    502,
    "UPSTREAM_UNAVAILABLE"
  );
}

function getDateInTimezone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = new Map(parts.map(({ type, value }) => [type, value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

export async function syncDailyMarketData(): Promise<void> {
  const snapshotDate = getDateInTimezone(
    new Date(),
    marketDataConfig.scheduleTimezone
  );
  const results = await Promise.allSettled(
    feeds.map(async (feed) => {
      const response = await fetchCompleteFeed(feed.endpoint);
      await saveDailyMarketDataSnapshot({
        dataset: feed.dataset,
        snapshotDate,
        sourceEndpoint: `/v1/${feed.endpoint}`,
        response,
        fetchedAt: new Date().toISOString(),
      });
    })
  );
  const failures = results.flatMap((result, index) =>
    result.status === "rejected" ? [feeds[index].endpoint] : []
  );
  if (failures.length > 0) {
    throw new MarketDataError(
      `Nightly market-data sync failed for: ${failures.join(", ")}`,
      500,
      "DAILY_SYNC_PARTIAL_FAILURE",
      {
        cause: results.find(
          (result): result is PromiseRejectedResult =>
            result.status === "rejected"
        )?.reason,
      }
    );
  }
}

export interface DailyMarketDataResponse {
  snapshotDate: string;
  fetchedAt: string;
  response: JsonValue;
}

export async function getLatestDailyMarketData(
  dataset: DailyMarketDataDataset,
  query: URLSearchParams,
  symbol?: string
): Promise<DailyMarketDataResponse> {
  const snapshot = await findLatestDailyMarketDataSnapshot(dataset);
  if (!snapshot) {
    throw new MarketDataError(
      `No nightly ${dataset.replace("_", " ")} data is available yet`,
      503,
      "DAILY_SNAPSHOT_NOT_AVAILABLE"
    );
  }
  return {
    snapshotDate: snapshot.snapshot_date,
    fetchedAt: snapshot.fetched_at,
    response: paginateDailyMarketData(snapshot.response_body, query, symbol),
  };
}
