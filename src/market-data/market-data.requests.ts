import { z } from "zod";
import { MarketDataError } from "./market-data.errors.js";

const pageFields = {
  page: z.coerce.number().int().min(1).optional(),
  page_size: z.coerce.number().int().min(1).max(1_000).optional(),
};

const dealQuerySchema = z
  .object({
    ...pageFields,
    buy_sell: z.enum(["BUY", "SELL"]).optional(),
  })
  .strict();

const insiderTradeQuerySchema = z
  .object({
    ...pageFields,
    transaction_type: z.enum(["acquisition", "disposal"]).optional(),
    promoters_only: z.enum(["true", "false"]).optional(),
  })
  .strict();

const screenerQuerySchema = z
  .object({
    ...pageFields,
    filter: z
      .union([
        z.string().trim().min(1).max(100),
        z.array(z.string().trim().min(1).max(100)).min(1).max(50),
      ])
      .optional(),
    sector: z.string().trim().min(1).max(100).optional(),
    sort_by: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/).optional(),
    sort_order: z.enum(["asc", "desc"]).optional(),
  })
  .strict();

const stockSymbolSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9._-]{1,30}$/);

function assertQuery(
  query: URLSearchParams,
  schema: z.ZodType
): void {
  const grouped = new Map<string, string[]>();
  query.forEach((value, key) => {
    const values = grouped.get(key) ?? [];
    values.push(value);
    grouped.set(key, values);
  });
  const values = Object.fromEntries(
    [...grouped].map(([key, entries]) => [
      key,
      entries.length === 1 ? entries[0] : entries,
    ])
  );
  const result = schema.safeParse(values);
  if (!result.success) {
    throw new MarketDataError(
      "Query parameters are invalid for this market-data endpoint",
      400,
      "INVALID_ENDPOINT_QUERY",
      { cause: result.error }
    );
  }
}

export function validateDealQuery(query: URLSearchParams): void {
  assertQuery(query, dealQuerySchema);
}

export function validateInsiderTradeQuery(query: URLSearchParams): void {
  assertQuery(query, insiderTradeQuerySchema);
}

export function validateScreenerQuery(query: URLSearchParams): void {
  assertQuery(query, screenerQuerySchema);
}

export function validateStockSymbol(symbol: string): string {
  const result = stockSymbolSchema.safeParse(symbol);
  if (!result.success) {
    throw new MarketDataError(
      "A valid stock ticker is required",
      400,
      "INVALID_STOCK_SYMBOL",
      { cause: result.error }
    );
  }
  return result.data;
}
