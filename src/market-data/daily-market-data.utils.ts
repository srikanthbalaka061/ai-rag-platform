import { MarketDataError } from "./market-data.errors.js";
import type { JsonValue } from "./market-data.types.js";

type JsonObject = { [key: string]: JsonValue };

function isJsonObject(value: JsonValue): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function paginateDailyMarketData(
  responseBody: JsonValue,
  query: URLSearchParams,
  symbol?: string
): JsonValue {
  if (!isJsonObject(responseBody) || !Array.isArray(responseBody.data)) {
    throw new MarketDataError(
      "Saved market-data snapshot does not contain a data array",
      500,
      "INVALID_DAILY_SNAPSHOT"
    );
  }

  const filteredRows = responseBody.data.filter((row: JsonValue) => {
    if (!isJsonObject(row)) {
      return symbol === undefined;
    }

    if (
      symbol &&
      (typeof row.symbol !== "string" ||
        row.symbol.toUpperCase() !== symbol.toUpperCase())
    ) {
      return false;
    }

    const buySell = query.get("buy_sell");
    if (
      buySell &&
      typeof row.buy_sell === "string" &&
      row.buy_sell.toUpperCase() !== buySell
    ) {
      return false;
    }
    const transactionType = query.get("transaction_type");
    if (
      transactionType &&
      typeof row.transaction_type === "string" &&
      row.transaction_type.toLowerCase() !== transactionType
    ) {
      return false;
    }
    if (query.get("promoters_only") === "true" && row.is_promoter !== true) {
      return false;
    }
    return true;
  });

  const page = Number(query.get("page") ?? 1);
  const pageSize = Number(query.get("page_size") ?? 20);
  const start = (page - 1) * pageSize;
  const originalPagination = responseBody.pagination;
  const pagination = isJsonObject(originalPagination) ? originalPagination : {};

  return {
    ...responseBody,
    data: filteredRows.slice(start, start + pageSize),
    pagination: {
      ...pagination,
      page,
      page_size: pageSize,
      total_items: filteredRows.length,
      total_pages: Math.ceil(filteredRows.length / pageSize),
    },
  };
}
