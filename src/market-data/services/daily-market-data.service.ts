import { createHash } from "node:crypto";
import { marketDataConfig } from "../config/market-data.config.js";
import { MarketDataError } from "../core/market-data.errors.js";
import { paginateDailyMarketData } from "../utils/daily-market-data.utils.js";
import { fetchBharatStock } from "../api/bharatstock.client.js";
import type {
  DailyMarketDataDataset,
  JsonValue,
} from "../core/market-data.types.js";
import {
  findDailyMarketData,
  saveDailyMarketDataRecords,
} from "../repositories/market-data.repository.js";

type JsonObject = { [key: string]: JsonValue };

const feeds: Array<{
  dataset: DailyMarketDataDataset;
  endpoint: string;
  dateField: string;
}> = [
  {
    dataset: "bulk_deals",
    endpoint: "deals/bulk",
    dateField: "deal_date",
  },
  {
    dataset: "block_deals",
    endpoint: "deals/block",
    dateField: "deal_date",
  },
  {
    dataset: "insider_trades",
    endpoint: "insider-trades",
    dateField: "intimation_date",
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

async function fetchCurrentDateFeed(
  endpoint: string,
  snapshotDate: string,
  dateField: string
): Promise<JsonValue[]> {
  const pageSize = marketDataConfig.syncPageSize;
  const rows: JsonValue[] = [];
  let responseBytes = 0;
  for (let page = 1; page <= marketDataConfig.syncMaxPages; page += 1) {
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
    if (currentPage.rows.length === 0) return rows;

    for (const row of currentPage.rows) {
      if (!isJsonObject(row)) {
        throw new MarketDataError(
          `BharatStock returned an invalid ${endpoint} record`,
          502,
          "UPSTREAM_INVALID_RESPONSE"
        );
      }
      const rowDate = row[dateField];
      if (typeof rowDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(rowDate)) {
        throw new MarketDataError(
          `BharatStock ${endpoint} record is missing a valid ${dateField}`,
          502,
          "UPSTREAM_INVALID_RESPONSE"
        );
      }
      if (rowDate !== snapshotDate) return rows;
      rows.push(row);
    }

    if (page === marketDataConfig.syncMaxPages) {
      throw new MarketDataError(
        `BharatStock feed reached the configured page limit (${marketDataConfig.syncMaxPages}) before reaching an older date`,
        502,
        "SYNC_PAGE_LIMIT_EXCEEDED"
      );
    }
  }
  return rows;
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
      const records = await fetchCurrentDateFeed(
        feed.endpoint,
        snapshotDate,
        feed.dateField
      );
      const fetchedAt = new Date().toISOString();
      await saveDailyMarketDataRecords({
        dataset: feed.dataset,
        snapshotDate,
        sourceEndpoint: `/v1/${feed.endpoint}`,
        records: records.map((record, recordOrder) => ({
          recordHash: createHash("sha256")
            .update(JSON.stringify(record))
            .digest("hex"),
          recordOrder,
          record,
        })),
        fetchedAt,
      });
    })
  );
  const failures = results.flatMap((result, index) =>
    result.status === "rejected" ? [feeds[index].endpoint] : []
  );
  if (failures.length > 0) {
    throw new MarketDataError(
      `Current-date market-data sync failed for: ${failures.join(", ")}`,
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
  query: URLSearchParams
): Promise<DailyMarketDataResponse> {
  const range = resolveDateRange(query);
  const dailyData = await findDailyMarketData(dataset, range);
  if (!dailyData) {
    throw new MarketDataError(
      `No daily ${dataset.replace("_", " ")} data is available yet`,
      503,
      "DAILY_SNAPSHOT_NOT_AVAILABLE"
    );
  }
  const rows = dailyData.records.map(({ record_body }) => record_body);
  const dateRange = range ?? {
    from: dailyData.sync.snapshot_date,
    to: dailyData.sync.snapshot_date,
  };
  const response: JsonValue = {
    snapshot_date: dailyData.sync.snapshot_date,
    date_range: dateRange,
    data: rows,
    pagination: {
      page: 1,
      page_size: rows.length,
      total_items: rows.length,
      total_pages: rows.length === 0 ? 0 : 1,
    },
  };
  return {
    snapshotDate: dailyData.sync.snapshot_date,
    fetchedAt: dailyData.sync.fetched_at,
    response: paginateDailyMarketData(response, query),
  };
}

function resolveDateRange(
  query: URLSearchParams
): { from: string; to: string } | undefined {
  const range = query.get("range");
  if (range === "custom" || (!range && query.has("from") && query.has("to"))) {
    return { from: query.get("from")!, to: query.get("to")! };
  }
  if (range !== "week" && range !== "month") return undefined;

  const to = getDateInTimezone(new Date(), marketDataConfig.scheduleTimezone);
  const days = range === "week" ? 7 : 30;
  const fromDate = new Date(`${to}T00:00:00.000Z`);
  fromDate.setUTCDate(fromDate.getUTCDate() - (days - 1));
  return { from: fromDate.toISOString().slice(0, 10), to };
}
