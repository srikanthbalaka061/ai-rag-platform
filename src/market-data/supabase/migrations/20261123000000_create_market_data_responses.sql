create table if not exists public.market_data_responses (
  id uuid primary key default gen_random_uuid(),
  request_hash text not null unique
    check (request_hash ~ '^[a-f0-9]{64}$'),
  endpoint text not null,
  query_params jsonb not null default '{}'::jsonb,
  response_body jsonb not null,
  response_status integer not null check (response_status between 200 and 299),
  fetched_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists market_data_responses_fetched_at_idx
  on public.market_data_responses (fetched_at desc);

alter table public.market_data_responses enable row level security;

create or replace function public.set_market_data_responses_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists market_data_responses_updated_at
  on public.market_data_responses;

create trigger market_data_responses_updated_at
before update on public.market_data_responses
for each row execute function public.set_market_data_responses_updated_at();
