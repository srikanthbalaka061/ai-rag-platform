import { MarketDataError } from "./market-data.errors.js";

const allowedEndpoints = [
  /^stocks$/,
  /^stocks\/(?:compare|quotes)$/,
  /^stocks\/[A-Za-z0-9._-]+$/,
  /^stocks\/[A-Za-z0-9._-]+\/(?:prices|financials|ratios|technical-indicators|shareholding|mf-holdings|corporate-actions|bulk-deals|block-deals|insider-trades)$/,
  /^movers$/,
  /^price-shockers$/,
  /^market\/fii-dii$/,
  /^mf\/schemes$/,
  /^mf\/schemes\/[A-Za-z0-9_-]+(?:\/(?:nav|returns))?$/,
  /^mf\/portfolios$/,
  /^mf\/portfolios\/[A-Za-z0-9 .&()_-]+\/holdings$/,
  /^status$/,
  /^screener$/,
  /^deals\/(?:bulk|block)$/,
  /^insider-trades$/,
  /^indices$/,
  /^indices\/[A-Za-z0-9 .&()_-]+\/prices$/,
  /^search$/,
];

export function resolveMarketDataEndpoint(path: string): string {
  let endpoint: string;
  try {
    endpoint = decodeURIComponent(path).replace(/^\/+|\/+$/g, "");
  } catch (error) {
    throw new MarketDataError(
      "Request path contains invalid encoding",
      400,
      "INVALID_PATH",
      { cause: error }
    );
  }

  if (
    endpoint.length === 0 ||
    endpoint.length > 300 ||
    endpoint.includes("..") ||
    !allowedEndpoints.some((pattern) => pattern.test(endpoint))
  ) {
    throw new MarketDataError(
      "The requested market data endpoint is not supported",
      404,
      "ENDPOINT_NOT_FOUND"
    );
  }
  return endpoint
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}
