import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../core/market-data.types.js";

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function validateUrl(value: string, name: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
  const localHttpAllowed =
    process.env.NODE_ENV !== "production" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if (url.protocol !== "https:" && !localHttpAllowed) {
    throw new Error(`${name} must use HTTPS`);
  }
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(`${name} must be an origin URL without credentials or path`);
  }
  return url.toString().replace(/\/+$/, "");
}

export const marketDataConfig = {
  baseUrl: validateUrl(
    process.env.BHARATSTOCK_BASE_URL?.trim() || "https://bharatstockapi.com",
    "BHARATSTOCK_BASE_URL"
  ),
  apiKey: getRequiredEnv("BHARATSTOCK_API_KEY"),
  clientToken: getRequiredEnv("MARKET_DATA_API_TOKEN"),
  timeoutMs: Number(process.env.BHARATSTOCK_TIMEOUT_MS ?? 10_000),
  syncPageSize: 200 as const,
  syncMaxPages: Number(process.env.MARKET_DATA_SYNC_MAX_PAGES ?? 100),
  scheduleTimezone:
    process.env.MARKET_DATA_SYNC_TIMEZONE?.trim() || "Asia/Kolkata",
  maxResponseBytes: 5 * 1024 * 1024,
  maxSnapshotBytes: 25 * 1024 * 1024,
};

if (marketDataConfig.clientToken.length < 32) {
  throw new Error("MARKET_DATA_API_TOKEN must contain at least 32 characters");
}

if (
  !Number.isInteger(marketDataConfig.timeoutMs) ||
  marketDataConfig.timeoutMs < 1_000 ||
  marketDataConfig.timeoutMs > 60_000
) {
  throw new Error("BHARATSTOCK_TIMEOUT_MS must be between 1000 and 60000");
}

if (
  !Number.isInteger(marketDataConfig.syncMaxPages) ||
  marketDataConfig.syncMaxPages < 1 ||
  marketDataConfig.syncMaxPages > 1_000
) {
  throw new Error("MARKET_DATA_SYNC_MAX_PAGES must be between 1 and 1000");
}

try {
  new Intl.DateTimeFormat("en-US", {
    timeZone: marketDataConfig.scheduleTimezone,
  }).format(new Date());
} catch (error) {
  throw new Error("MARKET_DATA_SYNC_TIMEZONE must be a valid IANA timezone", {
    cause: error,
  });
}

const supabaseUrl = validateUrl(
  getRequiredEnv("SUPABASE_URL"),
  "SUPABASE_URL"
);
const supabaseServiceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  }
);
