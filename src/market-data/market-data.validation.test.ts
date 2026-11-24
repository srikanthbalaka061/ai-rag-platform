import assert from "node:assert/strict";
import test from "node:test";
import { MarketDataError } from "./market-data.errors.js";
import {
  validateDealQuery,
  validateInsiderTradeQuery,
  validateScreenerQuery,
  validateStockSymbol,
} from "./market-data.requests.js";
import { resolveMarketDataEndpoint } from "./market-data.validation.js";

test("allows all documented BharatStock endpoint families", () => {
  const endpoints = [
    "stocks",
    "stocks/compare",
    "stocks/quotes",
    "stocks/RELIANCE",
    "stocks/RELIANCE/prices",
    "stocks/RELIANCE/financials",
    "stocks/RELIANCE/ratios",
    "stocks/RELIANCE/technical-indicators",
    "stocks/RELIANCE/shareholding",
    "stocks/RELIANCE/mf-holdings",
    "stocks/RELIANCE/corporate-actions",
    "stocks/RELIANCE/bulk-deals",
    "stocks/RELIANCE/block-deals",
    "stocks/RELIANCE/insider-trades",
    "movers",
    "price-shockers",
    "market/fii-dii",
    "mf/schemes",
    "mf/schemes/120503",
    "mf/schemes/120503/nav",
    "mf/schemes/120503/returns",
    "mf/portfolios",
    "mf/portfolios/Axis Flexi Cap Fund/holdings",
    "status",
    "screener",
    "deals/bulk",
    "deals/block",
    "insider-trades",
    "indices",
    "indices/NIFTY 50/prices",
    "search",
  ];

  for (const endpoint of endpoints) {
    assert.equal(resolveMarketDataEndpoint(endpoint), endpoint.replace(/ /g, "%20"));
  }
});

test("rejects malformed, unsupported, and traversal paths", () => {
  for (const path of [
    "",
    "admin/keys",
    "stocks/RELIANCE/unknown",
    "stocks/../status",
    "stocks/%2Fadmin",
    "indices/NIFTY%2F50/prices",
    "stocks/%E0%A4%A",
  ]) {
    assert.throws(
      () => resolveMarketDataEndpoint(path),
      (error: unknown) =>
        error instanceof MarketDataError &&
        (error.statusCode === 400 || error.statusCode === 404)
    );
  }
});

test("validates deal, insider, screener, and ticker query inputs", () => {
  assert.doesNotThrow(() =>
    validateDealQuery(
      new URLSearchParams("page=2&page_size=20&buy_sell=BUY")
    )
  );
  assert.doesNotThrow(() =>
    validateInsiderTradeQuery(
      new URLSearchParams(
        "page=1&transaction_type=acquisition&promoters_only=true"
      )
    )
  );
  assert.doesNotThrow(() =>
    validateScreenerQuery(
      new URLSearchParams(
        "filter=pe_ratio.lt.15&filter=roe.gt.10&sort_by=roe&sort_order=desc"
      )
    )
  );
  assert.equal(validateStockSymbol("RELIANCE"), "RELIANCE");

  assert.throws(() => validateDealQuery(new URLSearchParams("buy_sell=HOLD")));
  assert.throws(() =>
    validateInsiderTradeQuery(
      new URLSearchParams("transaction_type=unknown")
    )
  );
  assert.throws(() =>
    validateScreenerQuery(new URLSearchParams("unexpected=value"))
  );
  assert.throws(() => validateStockSymbol("RELIANCE/OTHER"));
});
