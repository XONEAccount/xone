-- XOne SDK tables + daily period column for calendar-day budget resets.

create table if not exists public.xone_profiles (
  id uuid primary key,
  email text not null,
  name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.xone_api_keys (
  id text primary key,
  user_id uuid not null references public.xone_profiles (id) on delete cascade,
  name text not null,
  token_hash text not null unique,
  token_prefix text not null,
  status text not null default 'active' check (status in ('active', 'deleted')),
  created_at timestamptz not null default now()
);

create table if not exists public.xone_agents (
  id text primary key,
  user_id uuid not null references public.xone_profiles (id) on delete cascade,
  api_key_id text not null references public.xone_api_keys (id) on delete cascade,
  name text not null,
  chain text not null default 'base-sepolia',
  currency text not null default 'USDC',
  default_amount text not null default '0.01',
  daily_limit numeric(36, 18) not null,
  per_transaction numeric(36, 18) not null,
  remaining_daily numeric(36, 18) not null,
  daily_period text not null default '',
  balance numeric(36, 18) not null default 0,
  wallet_address text not null,
  wallet_private_key_enc text not null,
  wallet_family text not null check (wallet_family in ('evm', 'solana')),
  status text not null default 'active'
    check (status in ('active', 'paused', 'exhausted', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (api_key_id)
);

create table if not exists public.xone_agent_history (
  id text primary key,
  agent_id text not null references public.xone_agents (id) on delete cascade,
  user_id uuid not null,
  type text not null,
  amount numeric(36, 18),
  currency text,
  to_address text,
  url text,
  tx_hash text,
  meta jsonb,
  created_at timestamptz not null default now()
);

alter table public.xone_agents
  add column if not exists daily_period text not null default '';

create index if not exists xone_api_keys_user_idx
  on public.xone_api_keys (user_id, created_at desc);
create index if not exists xone_agents_user_idx
  on public.xone_agents (user_id, created_at desc);
create index if not exists xone_agent_history_agent_idx
  on public.xone_agent_history (agent_id, created_at desc);
create index if not exists xone_agent_history_user_idx
  on public.xone_agent_history (user_id, created_at desc);

-- Idempotent x402 pays (also in 20260813010000_xone_pay_intents.sql)
create table if not exists public.xone_pay_intents (
  id text primary key,
  agent_id text not null references public.xone_agents (id) on delete cascade,
  idempotency_key text not null,
  url text not null,
  status text not null
    check (status in ('pending', 'succeeded', 'failed', 'uncertain')),
  max_amount text,
  result jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_id, idempotency_key)
);

create index if not exists xone_pay_intents_agent_created_idx
  on public.xone_pay_intents (agent_id, created_at desc);

-- Backend-only: no anon/authenticated policies. sdk-api uses service_role (bypasses RLS).
alter table public.xone_profiles enable row level security;
alter table public.xone_api_keys enable row level security;
alter table public.xone_agents enable row level security;
alter table public.xone_agent_history enable row level security;
alter table public.xone_pay_intents enable row level security;
