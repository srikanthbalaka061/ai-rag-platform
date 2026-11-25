import { z } from "zod";
import { MarketDataError } from "../core/market-data.errors.js";

const pageFields = {
  page: z.coerce.number().int().min(1).optional(),
  page_size: z.coerce.number().int().min(1).max(1_000).optional(),
};

const stockSymbolSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9._-]{1,30}$/);

const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Date must be a real calendar date in YYYY-MM-DD format");

const dailyFilterFields = {
  ...pageFields,
  range: z.enum(["week", "month", "custom"]).optional(),
  from: dateField.optional(),
  to: dateField.optional(),
  symbol: stockSymbolSchema.optional(),
  buyer: z.string().trim().min(1).max(120).optional(),
  seller: z.string().trim().min(1).max(120).optional(),
  client_name: z.string().trim().min(1).max(120).optional(),
  buy_sell: z.enum(["BUY", "SELL"]).optional(),
};

function validateDateRange(value: {
  range?: "week" | "month" | "custom";
  from?: string;
  to?: string;
}, context: z.RefinementCtx): void {
  if (value.range === "custom" && (!value.from || !value.to)) {
    context.addIssue({ code: "custom", message: "range=custom requires both from and to dates" });
  }
  if (value.range && value.range !== "custom" && (value.from || value.to)) {
    context.addIssue({ code: "custom", message: "from and to can only be used with range=custom" });
  }
  if (!value.range && Boolean(value.from) !== Boolean(value.to)) {
    context.addIssue({ code: "custom", message: "Both from and to dates are required" });
  }
  if (value.from && value.to && value.from > value.to) {
    context.addIssue({ code: "custom", message: "from must be on or before to" });
  }
}

const dealQuerySchema = z
  .object(dailyFilterFields)
  .strict()
  .superRefine(validateDateRange);

const insiderTradeQuerySchema = z
  .object({
    ...dailyFilterFields,
    transaction_type: z.enum(["acquisition", "disposal"]).optional(),
    promoters_only: z.enum(["true", "false"]).optional(),
  })
  .strict()
  .superRefine(validateDateRange);

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
