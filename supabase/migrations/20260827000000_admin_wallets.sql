-- Ops admin wallet allowlist (SIWE / challenge-response login).

create table if not exists public.admin_wallets (
  address text primary key,
  label text not null default '',
  status text not null default 'active'
    check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_wallets_status_idx
  on public.admin_wallets (status);

alter table public.admin_wallets enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'admin_wallets' and policyname = 'admin_wallets_service_all'
  ) then
    create policy "admin_wallets_service_all"
      on public.admin_wallets
      for all
      using (true)
      with check (true);
  end if;
end $$;
