import { createHash } from "node:crypto";
import { fetchBharatStock } from "../api/bharatstock.client.js";
import { MarketDataError } from "../market-data.errors.js";
import type { JsonValue, MarketDataResult } from "../market-data.types.js";
import {
  findMarketData,
  saveMarketData,
} from "../repositories/market-data.repository.js";

export function createRequestHash(
  endpoint: string,
  query: URLSearchParams
): string {
  const canonicalQuery = [...query.entries()]
    .sort(([keyA, valueA], [keyB, valueB]) =>
      keyA === keyB
        ? valueA.localeCompare(valueB)
        : keyA.localeCompare(keyB)
    )
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
  return createHash("sha256")
    .update(`${endpoint}?${canonicalQuery}`)
    .digest("hex");
}

export function queryToRecord(
  query: URLSearchParams
): Record<string, string[]> {
  const entries = new Map<string, string[]>();
  query.forEach((value, key) => {
    const values = entries.get(key) ?? [];
    values.push(value);
    entries.set(key, values);
  });
  return Object.fromEntries(entries);
}

export async function requestMarketData(
  endpoint: string,
  query: URLSearchParams
): Promise<MarketDataResult> {
  const requestHash = createRequestHash(endpoint, query);
  const response = await fetchBharatStock(endpoint, query);
  const fetchedAt = new Date().toISOString();

  await saveMarketData({
    requestHash,
    endpoint,
    query: queryToRecord(query),
    response,
    status: 200,
    fetchedAt,
  });

  return {
    cacheKey: requestHash,
    endpoint,
    query: queryToRecord(query),
    fetchedAt,
    status: 200,
    response,
  };
}

export function screenStocks(
  query: URLSearchParams
): Promise<MarketDataResult> {
  return requestMarketData("screener", query);
}

export async function getSavedMarketData(
  requestHash: string
): Promise<MarketDataResult> {
  const record = await findMarketData(requestHash);
  if (!record) {
    throw new MarketDataError(
      "No saved response was found for this cache key",
      404,
      "SAVED_RESPONSE_NOT_FOUND"
    );
  }
  return {
    cacheKey: record.request_hash,
    endpoint: record.endpoint,
    query: record.query_params,
    fetchedAt: record.fetched_at,
    status: record.response_status,
    response: record.response_body as JsonValue,
  };
}
