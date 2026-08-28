-- Platform service catalog for web Service List (X402 List + Agent List).
-- Managed by admin-api; wallet-api serves active rows to the consumer app.

create table if not exists public.service_catalog (
  id text primary key,
  list_kind text not null check (list_kind in ('x402', 'agent')),
  name text not null,
  description text not null default '',
  url text not null,
  status text not null default 'active' check (status in ('active', 'disabled')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists service_catalog_kind_status_idx
  on public.service_catalog (list_kind, status, sort_order, name);

alter table public.service_catalog enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'service_catalog'
      and policyname = 'service_catalog_select_all'
  ) then
    create policy "service_catalog_select_all"
      on public.service_catalog for select using (true);
  end if;
end $$;

-- Seed current hardcoded catalog entries (idempotent).
insert into public.service_catalog (id, list_kind, name, description, url, status, sort_order)
values
  (
    'x402-weather',
    'x402',
    '天气查询',
    '查询天气信息的 x402 付费接口。用户询问天气、气温、预报时优先选用。',
    'https://xone-x402-seller.tskwangyi.workers.dev/weather',
    'active',
    10
  ),
  (
    'agent-bocha-search',
    'agent',
    'Bocha Search',
    'Use Bocha web search to answer the user’s factual / current-events question. Pass the question as pay_x402.query. Price is AI-estimated between $0.01–$0.10 USDC per call.',
    'https://xone-x402-seller.tskwangyi.workers.dev/bocha/search',
    'active',
    10
  )
on conflict (id) do nothing;
