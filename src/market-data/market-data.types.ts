export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type MarketDataRecord = {
  id: string;
  request_hash: string;
  endpoint: string;
  query_params: Record<string, string[]>;
  response_body: JsonValue;
  response_status: number;
  fetched_at: string;
  created_at: string;
  updated_at: string;
}

export type DailyMarketDataDataset =
  | "bulk_deals"
  | "block_deals"
  | "insider_trades";

export type DailyMarketDataSnapshot = {
  dataset: DailyMarketDataDataset;
  snapshot_date: string;
  source_endpoint: string;
  response_body: JsonValue;
  fetched_at: string;
  created_at: string;
  updated_at: string;
};

export type MarketDataJobLock = {
  job_name: string;
  lease_token: string;
  lease_expires_at: string;
};

export interface Database {
  public: {
    Tables: {
      market_data_responses: {
        Row: MarketDataRecord;
        Insert: Omit<MarketDataRecord, "id" | "created_at" | "updated_at">;
        Update: Partial<
          Omit<MarketDataRecord, "id" | "created_at" | "updated_at">
        >;
        Relationships: [];
      };
      market_data_daily_snapshots: {
        Row: DailyMarketDataSnapshot;
        Insert: Omit<
          DailyMarketDataSnapshot,
          "created_at" | "updated_at"
        >;
        Update: Partial<
          Omit<DailyMarketDataSnapshot, "created_at" | "updated_at">
        >;
        Relationships: [];
      };
      market_data_job_locks: {
        Row: MarketDataJobLock;
        Insert: MarketDataJobLock;
        Update: Partial<MarketDataJobLock>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      try_acquire_market_data_job_lock: {
        Args: {
          p_job_name: string;
          p_lease_token: string;
          p_lease_seconds: number;
        };
        Returns: boolean;
      };
      release_market_data_job_lock: {
        Args: { p_job_name: string; p_lease_token: string };
        Returns: boolean;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}

export interface MarketDataResult {
  cacheKey: string;
  endpoint: string;
  query: Record<string, string[]>;
  fetchedAt: string;
  status: number;
  response: JsonValue;
}
