-- Align developer agents with @xonepay/sdk AgentCreateParams naming extras.

alter table public.developer_agents
  add column if not exists allowed_hosts text[] not null default '{}'::text[];

alter table public.developer_agents
  add column if not exists allowed_payees text[] not null default '{}'::text[];

comment on column public.developer_agents.max_amount is
  'Policy spend cap (aligned with SDK dailyLimit for wallet agents)';
comment on column public.developer_agents.max_single_payment is
  'Per-payment cap (aligned with SDK perTransaction)';
