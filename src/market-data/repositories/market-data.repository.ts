import { supabase } from "../market-data.config.js";
import { MarketDataError } from "../market-data.errors.js";
import type {
  DailyMarketDataDataset,
  DailyMarketDataSnapshot,
  JsonValue,
  MarketDataRecord,
} from "../market-data.types.js";

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

export interface SaveDailyMarketDataSnapshotInput {
  dataset: DailyMarketDataDataset;
  snapshotDate: string;
  sourceEndpoint: string;
  response: JsonValue;
  fetchedAt: string;
}

export async function saveDailyMarketDataSnapshot(
  input: SaveDailyMarketDataSnapshotInput
): Promise<void> {
  const { error } = await supabase
    .from("market_data_daily_snapshots")
    .upsert(
      {
        dataset: input.dataset,
        snapshot_date: input.snapshotDate,
        source_endpoint: input.sourceEndpoint,
        response_body: input.response,
        fetched_at: input.fetchedAt,
      },
      { onConflict: "dataset,snapshot_date" }
    );

  if (error) {
    throw new MarketDataError(
      `Failed to save the daily ${input.dataset} snapshot`,
      500,
      "DAILY_SNAPSHOT_WRITE_FAILED",
      { cause: error }
    );
  }
}

export async function findLatestDailyMarketDataSnapshot(
  dataset: DailyMarketDataDataset
): Promise<DailyMarketDataSnapshot | null> {
  const { data, error } = await supabase
    .from("market_data_daily_snapshots")
    .select("*")
    .eq("dataset", dataset)
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
  return data;
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
