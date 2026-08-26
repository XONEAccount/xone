-- Allow pause/resume for developer agent wallets (active | paused | disabled).
alter table public.developer_agents
  drop constraint if exists developer_agents_status_check;

alter table public.developer_agents
  add constraint developer_agents_status_check
  check (status in ('active', 'paused', 'disabled'));

comment on column public.developer_agents.status is
  'active = usable; paused = temporarily blocked from payments; disabled = soft-deleted';
