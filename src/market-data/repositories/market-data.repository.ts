import { supabase } from "../config/market-data.config.js";
import { MarketDataError } from "../core/market-data.errors.js";
import type {
  DailyMarketDataDataset,
  DailyMarketDataRecord,
  DailyMarketDataSync,
  JsonValue,
  MarketDataRecord,
} from "../core/market-data.types.js";

export interface SaveMarketDataInput {
  requestHash: string;
  endpoint: string;
  query: Record<string, string[]>;
  response: JsonValue;
  status: number;
  fetchedAt: string;
}

export async function saveMarketData(
  input: SaveMarketDataInput
): Promise<void> {
  const { error } = await supabase
    .from("market_data_responses")
    .upsert(
      {
        request_hash: input.requestHash,
        endpoint: input.endpoint,
        query_params: input.query,
        response_body: input.response,
        response_status: input.status,
        fetched_at: input.fetchedAt,
      },
      { onConflict: "request_hash" }
    );

  if (error) {
    throw new MarketDataError(
      "Failed to persist BharatStock response",
      500,
      "DATABASE_WRITE_FAILED",
      { cause: error }
    );
  }
}

export async function findMarketData(
  requestHash: string
): Promise<MarketDataRecord | null> {
  const { data, error } = await supabase
    .from("market_data_responses")
    .select("*")
    .eq("request_hash", requestHash)
    .maybeSingle();

  if (error) {
    throw new MarketDataError(
      "Failed to read persisted market data",
      500,
      "DATABASE_READ_FAILED",
      { cause: error }
    );
  }
  return data;
}

export interface SaveDailyMarketDataRecordsInput {
  dataset: DailyMarketDataDataset;
  snapshotDate: string;
  sourceEndpoint: string;
  records: Array<{ recordHash: string; record: JsonValue; recordOrder: number }>;
  fetchedAt: string;
}

export async function saveDailyMarketDataRecords(
  input: SaveDailyMarketDataRecordsInput
): Promise<void> {
  const databaseRecords = input.records.map(({ recordHash, record, recordOrder }) => ({
    dataset: input.dataset,
    market_date: input.snapshotDate,
    record_hash: recordHash,
    record_order: recordOrder,
    record_body: record,
    fetched_at: input.fetchedAt,
  }));

  for (let offset = 0; offset < databaseRecords.length; offset += 500) {
    const { error } = await supabase
      .from("market_data_daily_records")
      .upsert(databaseRecords.slice(offset, offset + 500), {
        onConflict: "dataset,market_date,record_hash",
      });
    if (error) {
      throw new MarketDataError(
        `Failed to save daily ${input.dataset} records`,
        500,
        "DAILY_RECORDS_WRITE_FAILED",
        { cause: error }
      );
    }
  }

  const { error } = await supabase.from("market_data_daily_syncs").upsert(
    {
      dataset: input.dataset,
      snapshot_date: input.snapshotDate,
      source_endpoint: input.sourceEndpoint,
      fetched_at: input.fetchedAt,
    },
    { onConflict: "dataset,snapshot_date" }
  );
  if (error) {
    throw new MarketDataError(
      `Failed to save the daily ${input.dataset} sync status`,
      500,
      "DAILY_SYNC_STATUS_WRITE_FAILED",
      { cause: error }
    );
  }
}

export interface DailyMarketDataDateRange {
  from: string;
  to: string;
}

export async function findDailyMarketData(
  dataset: DailyMarketDataDataset,
  dateRange?: DailyMarketDataDateRange
): Promise<{ sync: DailyMarketDataSync; records: DailyMarketDataRecord[] } | null> {
  let syncQuery = supabase
    .from("market_data_daily_syncs")
    .select("*")
    .eq("dataset", dataset);
  if (dateRange) {
    syncQuery = syncQuery
      .gte("snapshot_date", dateRange.from)
      .lte("snapshot_date", dateRange.to);
  }
  const { data, error } = await syncQuery
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new MarketDataError(
      `Failed to read the daily ${dataset} snapshot`,
      500,
      "DAILY_SNAPSHOT_READ_FAILED",
      { cause: error }
    );
  }
  if (!data) return null;

  const records: DailyMarketDataRecord[] = [];
  const pageSize = 1_000;
  for (let offset = 0; ; offset += pageSize) {
    let recordsQuery = supabase
      .from("market_data_daily_records")
      .select("*")
      .eq("dataset", dataset);
    if (dateRange) {
      recordsQuery = recordsQuery
        .gte("market_date", dateRange.from)
        .lte("market_date", dateRange.to);
    } else {
      recordsQuery = recordsQuery.eq("market_date", data.snapshot_date);
    }
    const page = await recordsQuery
      .order("market_date", { ascending: false })
      .order("record_order", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (page.error) {
      throw new MarketDataError(
        `Failed to read daily ${dataset} records`,
        500,
        "DAILY_RECORDS_READ_FAILED",
        { cause: page.error }
      );
    }
    records.push(...page.data);
    if (page.data.length < pageSize) break;
  }
  return { sync: data, records };
}

export async function acquireMarketDataJobLock(
  jobName: string,
  leaseToken: string,
  leaseSeconds: number
): Promise<boolean> {
  const { data, error } = await supabase.rpc(
    "try_acquire_market_data_job_lock",
    {
      p_job_name: jobName,
      p_lease_token: leaseToken,
      p_lease_seconds: leaseSeconds,
    }
  );
  if (error) {
    throw new MarketDataError(
      "Failed to acquire the market-data scheduler lock",
      500,
      "SCHEDULER_LOCK_FAILED",
      { cause: error }
    );
  }
  return data;
}

export async function releaseMarketDataJobLock(
  jobName: string,
  leaseToken: string
): Promise<void> {
  const { error } = await supabase.rpc("release_market_data_job_lock", {
    p_job_name: jobName,
    p_lease_token: leaseToken,
  });
  if (error) {
    throw new MarketDataError(
      "Failed to release the market-data scheduler lock",
      500,
      "SCHEDULER_LOCK_RELEASE_FAILED",
      { cause: error }
    );
  }
}
