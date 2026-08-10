-- Developer agents: restricted ETH wallets + machine payments (MCP / x402).

create table if not exists public.developer_agents (
  id uuid primary key default gen_random_uuid(),
  owner_wallet text not null references public.profiles (wallet_address) on delete cascade,
  name text not null,
  description text not null default '',
  api_key_hash text not null unique,
  api_key_prefix text not null,
  wallet_address text not null unique,
  encrypted_private_key text not null,
  max_amount numeric(36, 18) not null check (max_amount > 0),
  max_single_payment numeric(36, 18) not null check (max_single_payment > 0),
  spent_amount numeric(36, 18) not null default 0 check (spent_amount >= 0),
  allowance_eth numeric(36, 18) not null default 0 check (allowance_eth >= 0),
  asset text not null default 'ETH',
  chain text not null default 'ethereum-sepolia',
  status text not null default 'active'
    check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (max_single_payment <= max_amount)
);

create index if not exists developer_agents_owner_idx
  on public.developer_agents (owner_wallet, created_at desc);

create table if not exists public.agent_payments (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.developer_agents (id) on delete cascade,
  idempotency_key text,
  amount numeric(36, 18) not null check (amount > 0),
  asset text not null default 'ETH',
  chain text not null,
  recipient text not null,
  merchant text,
  resource text,
  status text not null
    check (status in (
      'created',
      'awaiting_authorization',
      'authorized',
      'submitting',
      'submitted',
      'confirming',
      'confirmed',
      'rejected',
      'expired',
      'failed',
      'cancelled'
    )),
  provider text not null default 'x402',
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists agent_payments_idempotency_uidx
  on public.agent_payments (agent_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists agent_payments_agent_created_idx
  on public.agent_payments (agent_id, created_at desc);

alter table public.developer_agents enable row level security;
alter table public.agent_payments enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'developer_agents' and policyname = 'developer_agents_select_all') then
    create policy "developer_agents_select_all" on public.developer_agents for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'developer_agents' and policyname = 'developer_agents_insert_all') then
    create policy "developer_agents_insert_all" on public.developer_agents for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'developer_agents' and policyname = 'developer_agents_update_all') then
    create policy "developer_agents_update_all" on public.developer_agents for update using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'agent_payments' and policyname = 'agent_payments_select_all') then
    create policy "agent_payments_select_all" on public.agent_payments for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'agent_payments' and policyname = 'agent_payments_insert_all') then
    create policy "agent_payments_insert_all" on public.agent_payments for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'agent_payments' and policyname = 'agent_payments_update_all') then
    create policy "agent_payments_update_all" on public.agent_payments for update using (true) with check (true);
  end if;
end $$;
