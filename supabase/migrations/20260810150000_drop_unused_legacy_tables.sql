-- Drop legacy custody / demo tables no longer referenced by the app.
-- Keep: profiles, a2a_accounts, a2a_agent_settings, a2a_ledger, wallet_transactions

drop table if exists public.payments cascade;
drop table if exists public.deposits cascade;
drop table if exists public.ledger_entries cascade;
drop table if exists public.balances cascade;
drop table if exists public.auth_nonces cascade;
drop table if exists public.spending_policies cascade;
drop table if exists public.agents cascade;
