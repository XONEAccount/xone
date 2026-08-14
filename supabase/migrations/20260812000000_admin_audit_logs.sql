-- Admin console audit trail (ops actions only; never store secrets).

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor text not null default 'admin',
  action text not null,
  target_type text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_created_idx
  on public.admin_audit_logs (created_at desc);

create index if not exists admin_audit_logs_target_idx
  on public.admin_audit_logs (target_type, target_id, created_at desc);

alter table public.admin_audit_logs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'admin_audit_logs' and policyname = 'admin_audit_logs_service_all'
  ) then
    create policy "admin_audit_logs_service_all"
      on public.admin_audit_logs
      for all
      using (true)
      with check (true);
  end if;
end $$;
