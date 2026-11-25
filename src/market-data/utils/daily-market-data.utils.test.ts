import assert from "node:assert/strict";
import test from "node:test";
import { paginateDailyMarketData } from "./daily-market-data.utils.js";

test("paginates and filters bulk deals from a saved snapshot", () => {
  const result = paginateDailyMarketData(
    {
      data: [
        { symbol: "AAA", buy_sell: "BUY" },
        { symbol: "BBB", buy_sell: "SELL" },
        { symbol: "CCC", buy_sell: "BUY" },
      ],
      pagination: { total_items: 3 },
    },
    new URLSearchParams("buy_sell=BUY&page=2&page_size=1")
  );

  assert.deepEqual(result, {
    data: [{ symbol: "CCC", buy_sell: "BUY" }],
    pagination: {
      total_items: 2,
      page: 2,
      page_size: 1,
      total_pages: 2,
    },
  });
});

test("applies insider filters before calculating pagination", () => {
  const result = paginateDailyMarketData(
    {
      data: [
        { symbol: "AAA", transaction_type: "acquisition", is_promoter: true },
        { symbol: "BBB", transaction_type: "disposal", is_promoter: true },
        { symbol: "CCC", transaction_type: "acquisition", is_promoter: false },
      ],
      pagination: {},
    },
    new URLSearchParams(
      "transaction_type=acquisition&promoters_only=true&page=1&page_size=10"
    )
  );

  assert.deepEqual(result, {
    data: [
      { symbol: "AAA", transaction_type: "acquisition", is_promoter: true },
    ],
    pagination: { page: 1, page_size: 10, total_items: 1, total_pages: 1 },
  });
});

test("filters ticker-specific deals from the saved market-wide data", () => {
  const result = paginateDailyMarketData(
    {
      data: [
        { symbol: "RELIANCE", buy_sell: "BUY" },
        { symbol: "TCS", buy_sell: "SELL" },
      ],
      pagination: {},
    },
    new URLSearchParams(),
    "reliance"
  );

  assert.deepEqual(result, {
    data: [{ symbol: "RELIANCE", buy_sell: "BUY" }],
    pagination: { page: 1, page_size: 20, total_items: 1, total_pages: 1 },
  });
});

test("rejects malformed saved snapshots", () => {
  assert.throws(() =>
    paginateDailyMarketData({ data: "not-an-array" }, new URLSearchParams())
  );
});
