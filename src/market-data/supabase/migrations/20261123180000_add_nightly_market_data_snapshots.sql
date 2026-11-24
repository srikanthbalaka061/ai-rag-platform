create table if not exists public.market_data_daily_snapshots (
  dataset text not null
    check (dataset in ('bulk_deals', 'block_deals', 'insider_trades')),
  snapshot_date date not null,
  source_endpoint text not null,
  response_body jsonb not null,
  fetched_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (dataset, snapshot_date)
);

create index if not exists market_data_daily_snapshots_latest_idx
  on public.market_data_daily_snapshots (dataset, snapshot_date desc);

alter table public.market_data_daily_snapshots enable row level security;
revoke all on table public.market_data_daily_snapshots
  from anon, authenticated;
grant all on table public.market_data_daily_snapshots to service_role;

create or replace function public.set_market_data_daily_snapshots_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists market_data_daily_snapshots_updated_at
  on public.market_data_daily_snapshots;

create trigger market_data_daily_snapshots_updated_at
before update on public.market_data_daily_snapshots
for each row execute function public.set_market_data_daily_snapshots_updated_at();

create table if not exists public.market_data_job_locks (
  job_name text primary key,
  lease_token uuid not null,
  lease_expires_at timestamptz not null
);

alter table public.market_data_job_locks enable row level security;
revoke all on table public.market_data_job_locks from anon, authenticated;
grant all on table public.market_data_job_locks to service_role;

create or replace function public.try_acquire_market_data_job_lock(
  p_job_name text,
  p_lease_token uuid,
  p_lease_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  lock_acquired boolean := false;
begin
  if p_job_name is null or length(p_job_name) = 0
    or p_lease_token is null
    or p_lease_seconds is null
    or p_lease_seconds < 60 or p_lease_seconds > 21600 then
    raise exception using
      errcode = '22023',
      message = 'Invalid market-data job lock parameters';
  end if;

  insert into public.market_data_job_locks as current_lock (
    job_name,
    lease_token,
    lease_expires_at
  )
  values (
    p_job_name,
    p_lease_token,
    now() + make_interval(secs => p_lease_seconds)
  )
  on conflict (job_name)
  do update set
    lease_token = excluded.lease_token,
    lease_expires_at = excluded.lease_expires_at
  where current_lock.lease_expires_at <= now()
  returning true into lock_acquired;

  return coalesce(lock_acquired, false);
end;
$$;

create or replace function public.release_market_data_job_lock(
  p_job_name text,
  p_lease_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  lock_released boolean := false;
begin
  delete from public.market_data_job_locks
  where job_name = p_job_name
    and lease_token = p_lease_token
  returning true into lock_released;

  return coalesce(lock_released, false);
end;
$$;

revoke all on function public.try_acquire_market_data_job_lock(text, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.release_market_data_job_lock(text, uuid)
  from public, anon, authenticated;
grant execute on function public.try_acquire_market_data_job_lock(text, uuid, integer)
  to service_role;
grant execute on function public.release_market_data_job_lock(text, uuid)
  to service_role;
