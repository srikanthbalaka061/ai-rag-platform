import { MarketDataError } from "../core/market-data.errors.js";
import type { JsonValue } from "../core/market-data.types.js";

type JsonObject = { [key: string]: JsonValue };

function isJsonObject(value: JsonValue): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function paginateDailyMarketData(
  responseBody: JsonValue,
  query: URLSearchParams,
  legacySymbol?: string
): JsonValue {
  if (!isJsonObject(responseBody) || !Array.isArray(responseBody.data)) {
    throw new MarketDataError(
      "Saved daily market data does not contain a data array",
      500,
      "INVALID_DAILY_MARKET_DATA"
    );
  }

  const filteredRows = responseBody.data.filter((row: JsonValue) => {
    if (!isJsonObject(row)) return false;

    const symbol = query.get("symbol") ?? legacySymbol;
    if (symbol && !matchesText(row.symbol, symbol)) return false;

    const buySell = query.get("buy_sell");
    const rowSide = typeof row.buy_sell === "string"
      ? row.buy_sell.toUpperCase()
      : row.transaction_type === "acquisition"
        ? "BUY"
        : row.transaction_type === "disposal"
          ? "SELL"
          : null;
    if (buySell) {
      if (rowSide !== buySell) return false;
    }

    const transactionType = query.get("transaction_type");
    if (
      transactionType &&
      (typeof row.transaction_type !== "string" ||
        row.transaction_type.toLowerCase() !== transactionType)
    ) {
      return false;
    }
    if (query.get("promoters_only") === "true" && row.is_promoter !== true) {
      return false;
    }

    const buyer = query.get("buyer");
    if (buyer) {
      const buyerFields = [row.buyer_name];
      if (rowSide === "BUY") {
        buyerFields.push(row.client_name, row.acquirer_name, row.person_name);
      }
      if (!buyerFields.some((value) => matchesText(value, buyer))) return false;
    }

    const seller = query.get("seller");
    if (seller) {
      const sellerFields = [row.seller_name];
      if (rowSide === "SELL") {
        sellerFields.push(row.client_name, row.acquirer_name, row.person_name);
      }
      if (!sellerFields.some((value) => matchesText(value, seller))) return false;
    }

    const clientName = query.get("client_name");
    if (
      clientName &&
      ![
        row.client_name,
        row.buyer_name,
        row.seller_name,
        row.acquirer_name,
        row.person_name,
      ].some((value) => matchesText(value, clientName))
    ) {
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

function matchesText(value: JsonValue | undefined, query: string): boolean {
  return (
    typeof value === "string" &&
    value.toLocaleLowerCase().includes(query.toLocaleLowerCase())
  );
}
