-- Phase 1 schema for Web3 AI Wallet
-- Canonical app identity is auth.users; public.users is the profile extension.

create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  phone text,
  display_name text,
  thirdweb_user_id text,
  primary_wallet_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  provider text not null default 'thirdweb',
  provider_wallet_id text,
  address text not null,
  chain_type text not null default 'evm',
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists wallets_user_address_idx
  on public.wallets (user_id, address);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  wallet_id uuid not null references public.wallets (id) on delete cascade,
  chain text not null,
  tx_hash text not null,
  from_address text not null,
  to_address text not null,
  asset text not null,
  amount text not null,
  status text not null check (status in ('pending', 'confirmed', 'failed')),
  direction text not null check (direction in ('in', 'out')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create unique index if not exists transactions_chain_hash_idx
  on public.transactions (chain, tx_hash);

create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  agent_task_id uuid,
  order_id uuid,
  merchant text,
  merchant_agent_id text,
  asset text not null,
  amount text not null,
  currency text not null default 'USD',
  chain text not null,
  recipient text not null,
  status text not null,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_authorizations (
  id uuid primary key default gen_random_uuid(),
  payment_request_id uuid not null references public.payment_requests (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  decision text not null check (decision in ('allow', 'confirm', 'block')),
  authorized_by text not null,
  max_amount text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  payment_request_id uuid not null references public.payment_requests (id) on delete cascade,
  provider text not null,
  tx_hash text,
  amount text not null,
  asset text not null,
  chain text not null,
  status text not null,
  submitted_at timestamptz,
  confirmed_at timestamptz,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.agent_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.agent_sessions (id) on delete cascade,
  role text not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  session_id uuid references public.agent_sessions (id) on delete set null,
  type text not null,
  status text not null,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete set null,
  actor_type text not null,
  actor_id text,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;
alter table public.wallets enable row level security;
alter table public.transactions enable row level security;
alter table public.payment_requests enable row level security;
alter table public.payment_authorizations enable row level security;
alter table public.payments enable row level security;
alter table public.agent_sessions enable row level security;
alter table public.agent_messages enable row level security;
alter table public.agent_tasks enable row level security;
alter table public.audit_logs enable row level security;

create policy "users_select_own" on public.users
  for select using (auth.uid() = id);

create policy "users_update_own" on public.users
  for update using (auth.uid() = id);

create policy "wallets_select_own" on public.wallets
  for select using (auth.uid() = user_id);

create policy "transactions_select_own" on public.transactions
  for select using (auth.uid() = user_id);

create policy "payment_requests_own" on public.payment_requests
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "payment_authorizations_own" on public.payment_authorizations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "payments_select_via_request" on public.payments
  for select using (
    exists (
      select 1 from public.payment_requests pr
      where pr.id = payment_request_id and pr.user_id = auth.uid()
    )
  );

create policy "agent_sessions_own" on public.agent_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "agent_messages_own" on public.agent_messages
  for all using (
    exists (
      select 1 from public.agent_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.agent_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

create policy "agent_tasks_own" on public.agent_tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "audit_logs_select_own" on public.audit_logs
  for select using (auth.uid() = user_id);
