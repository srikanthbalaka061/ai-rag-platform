import { marketDataConfig } from "../market-data.config.js";
import { MarketDataError } from "../market-data.errors.js";
import type { JsonValue } from "../market-data.types.js";

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  if (typeof value === "object") {
    return Object.values(value).every(isJsonValue);
  }
  return false;
}

export async function fetchBharatStock(
  endpoint: string,
  query: URLSearchParams
): Promise<JsonValue> {
  const url = new URL(`/v1/${endpoint}`, `${marketDataConfig.baseUrl}/`);
  url.search = query.toString();
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    marketDataConfig.timeoutMs
  );

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-API-Key": marketDataConfig.apiKey,
      },
      redirect: "error",
      signal: controller.signal,
    });

    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > marketDataConfig.maxResponseBytes) {
      throw new MarketDataError(
        "BharatStock response exceeded the size limit",
        502,
        "UPSTREAM_RESPONSE_TOO_LARGE"
      );
    }

    if (!response.ok) {
      await response.body?.cancel();
      throw new MarketDataError(
        `BharatStock returned HTTP ${response.status}`,
        502,
        "UPSTREAM_REQUEST_FAILED"
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new MarketDataError(
        "BharatStock returned an empty response",
        502,
        "UPSTREAM_INVALID_RESPONSE"
      );
    }

    const chunks: Uint8Array[] = [];
    let responseBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      responseBytes += value.byteLength;
      if (responseBytes > marketDataConfig.maxResponseBytes) {
        await reader.cancel();
        throw new MarketDataError(
          "BharatStock response exceeded the size limit",
          502,
          "UPSTREAM_RESPONSE_TOO_LARGE"
        );
      }
      chunks.push(value);
    }
    const text = new TextDecoder().decode(Buffer.concat(chunks));

    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch (error) {
      throw new MarketDataError(
        "BharatStock returned invalid JSON",
        502,
        "UPSTREAM_INVALID_RESPONSE",
        { cause: error }
      );
    }
    if (!isJsonValue(payload)) {
      throw new MarketDataError(
        "BharatStock returned an unsupported JSON value",
        502,
        "UPSTREAM_INVALID_RESPONSE"
      );
    }
    return payload;
  } catch (error) {
    if (error instanceof MarketDataError) {
      throw error;
    }
    if (controller.signal.aborted) {
      throw new MarketDataError(
        "BharatStock request timed out",
        504,
        "UPSTREAM_TIMEOUT",
        { cause: error }
      );
    }
    throw new MarketDataError(
      "Unable to reach BharatStock",
      502,
      "UPSTREAM_UNAVAILABLE",
      { cause: error }
    );
  } finally {
    clearTimeout(timeout);
  }
}
