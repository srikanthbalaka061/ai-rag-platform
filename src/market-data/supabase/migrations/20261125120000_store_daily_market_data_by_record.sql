create table if not exists public.market_data_daily_records (
  dataset text not null
    check (dataset in ('bulk_deals', 'block_deals', 'insider_trades')),
  market_date date not null,
  record_hash text not null
    check (record_hash ~ '^[a-f0-9]{32,64}$'),
  record_order integer not null check (record_order >= 0),
  record_body jsonb not null,
  fetched_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (dataset, market_date, record_hash)
);

create index if not exists market_data_daily_records_date_order_idx
  on public.market_data_daily_records (dataset, market_date desc, record_order);

alter table public.market_data_daily_records enable row level security;
revoke all on table public.market_data_daily_records from anon, authenticated;
grant all on table public.market_data_daily_records to service_role;

create table if not exists public.market_data_daily_syncs (
  dataset text not null
    check (dataset in ('bulk_deals', 'block_deals', 'insider_trades')),
  snapshot_date date not null,
  source_endpoint text not null,
  fetched_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (dataset, snapshot_date)
);

create index if not exists market_data_daily_syncs_latest_idx
  on public.market_data_daily_syncs (dataset, snapshot_date desc);

alter table public.market_data_daily_syncs enable row level security;
revoke all on table public.market_data_daily_syncs from anon, authenticated;
grant all on table public.market_data_daily_syncs to service_role;

create or replace function public.set_market_data_daily_syncs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists market_data_daily_syncs_updated_at
  on public.market_data_daily_syncs;

create trigger market_data_daily_syncs_updated_at
before update on public.market_data_daily_syncs
for each row execute function public.set_market_data_daily_syncs_updated_at();

-- Preserve existing daily data while splitting each saved response into one row
-- per source object. The old response table remains available for rollback.
insert into public.market_data_daily_syncs (
  dataset, snapshot_date, source_endpoint, fetched_at
)
select dataset, snapshot_date, source_endpoint, fetched_at
from public.market_data_daily_snapshots
on conflict (dataset, snapshot_date) do nothing;

insert into public.market_data_daily_records (
  dataset, market_date, record_hash, record_order, record_body, fetched_at
)
select
  snapshots.dataset,
  case
    when snapshots.dataset = 'insider_trades'
      then (record.value ->> 'intimation_date')::date
    else (record.value ->> 'deal_date')::date
  end,
  md5(record.value::text),
  (record.ordinality - 1)::integer,
  record.value,
  snapshots.fetched_at
from public.market_data_daily_snapshots as snapshots
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(snapshots.response_body -> 'data') = 'array'
      then snapshots.response_body -> 'data'
    else '[]'::jsonb
  end
) with ordinality as record(value, ordinality)
where (
  (snapshots.dataset = 'insider_trades'
    and (record.value ->> 'intimation_date') ~ '^\d{4}-\d{2}-\d{2}$')
  or
  (snapshots.dataset in ('bulk_deals', 'block_deals')
    and (record.value ->> 'deal_date') ~ '^\d{4}-\d{2}-\d{2}$')
)
on conflict (dataset, market_date, record_hash) do nothing;
