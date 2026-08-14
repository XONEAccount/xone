-- Payment intents for idempotent x402 pays (prevent double settlement on retries).

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
