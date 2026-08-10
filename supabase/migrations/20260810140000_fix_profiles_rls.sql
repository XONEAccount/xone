-- profiles had RLS enabled with zero policies → all anon writes fail.
-- Add policies for wallet-address identity model + A2A/tx tables.

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'profiles_select_all') then
    create policy "profiles_select_all" on public.profiles for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'profiles_insert_all') then
    create policy "profiles_insert_all" on public.profiles for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'profiles_update_all') then
    create policy "profiles_update_all" on public.profiles for update using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'a2a_accounts' and policyname = 'a2a_accounts_insert_all') then
    create policy "a2a_accounts_insert_all" on public.a2a_accounts for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'a2a_accounts' and policyname = 'a2a_accounts_update_all') then
    create policy "a2a_accounts_update_all" on public.a2a_accounts for update using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'a2a_agent_settings' and policyname = 'a2a_agent_settings_insert_all') then
    create policy "a2a_agent_settings_insert_all" on public.a2a_agent_settings for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'a2a_agent_settings' and policyname = 'a2a_agent_settings_update_all') then
    create policy "a2a_agent_settings_update_all" on public.a2a_agent_settings for update using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'a2a_ledger' and policyname = 'a2a_ledger_insert_all') then
    create policy "a2a_ledger_insert_all" on public.a2a_ledger for insert with check (true);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'wallet_transactions' and policyname = 'wallet_transactions_insert_all') then
    create policy "wallet_transactions_insert_all" on public.wallet_transactions for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'wallet_transactions' and policyname = 'wallet_transactions_update_all') then
    create policy "wallet_transactions_update_all" on public.wallet_transactions for update using (true) with check (true);
  end if;
end $$;
