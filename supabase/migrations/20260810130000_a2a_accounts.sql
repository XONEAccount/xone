-- A2A spendable balance and agent settings (replaces browser localStorage demo state).

create table if not exists public.a2a_accounts (
  wallet_address text primary key references public.profiles (wallet_address) on delete cascade,
  balance numeric not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.a2a_agent_settings (
  wallet_address text not null references public.profiles (wallet_address) on delete cascade,
  agent_id text not null,
  enabled boolean not null default true,
  max_amount numeric not null check (max_amount > 0),
  max_single_payment numeric not null check (max_single_payment > 0),
  spent_amount numeric not null default 0 check (spent_amount >= 0),
  updated_at timestamptz not null default now(),
  primary key (wallet_address, agent_id),
  check (max_single_payment <= max_amount)
);

create table if not exists public.a2a_ledger (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null references public.profiles (wallet_address) on delete cascade,
  kind text not null check (kind in ('fund', 'pay', 'blocked', 'failed')),
  agent_id text,
  title text not null default '',
  counterparty text not null default '',
  amount numeric not null check (amount >= 0),
  asset text not null default 'ETH',
  status text not null check (status in ('success', 'blocked', 'failed', 'pending')),
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists a2a_ledger_wallet_created_idx
  on public.a2a_ledger (wallet_address, created_at desc);

alter table public.a2a_accounts enable row level security;
alter table public.a2a_agent_settings enable row level security;
alter table public.a2a_ledger enable row level security;

create policy "a2a_accounts_select_all" on public.a2a_accounts for select using (true);
create policy "a2a_agent_settings_select_all" on public.a2a_agent_settings for select using (true);
create policy "a2a_ledger_select_all" on public.a2a_ledger for select using (true);
