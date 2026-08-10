-- Track on-chain fundings into developer agent wallets (idempotent by tx_hash).

create table if not exists public.agent_fundings (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.developer_agents (id) on delete cascade,
  tx_hash text not null,
  from_address text not null,
  amount numeric(36, 18) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (tx_hash)
);

create index if not exists agent_fundings_agent_idx
  on public.agent_fundings (agent_id, created_at desc);

alter table public.agent_fundings enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'agent_fundings' and policyname = 'agent_fundings_select_all') then
    create policy "agent_fundings_select_all" on public.agent_fundings for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'agent_fundings' and policyname = 'agent_fundings_insert_all') then
    create policy "agent_fundings_insert_all" on public.agent_fundings for insert with check (true);
  end if;
end $$;
