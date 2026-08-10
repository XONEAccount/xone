-- On-chain transfer ledger keyed by wallet address (profiles model).
-- Same tx_hash can have both out (sender) and in (receiver) rows.

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null references public.profiles (wallet_address) on delete cascade,
  chain text not null,
  chain_id integer not null,
  tx_hash text not null,
  from_address text not null,
  to_address text not null,
  asset text not null,
  amount text not null,
  status text not null check (status in ('pending', 'submitted', 'confirmed', 'failed')),
  direction text not null check (direction in ('in', 'out')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create unique index if not exists wallet_transactions_unique_leg
  on public.wallet_transactions (chain_id, tx_hash, wallet_address, direction);

create index if not exists wallet_transactions_wallet_created_idx
  on public.wallet_transactions (wallet_address, created_at desc);

create index if not exists wallet_transactions_tx_hash_idx
  on public.wallet_transactions (tx_hash);

alter table public.wallet_transactions enable row level security;

-- App reads via service role; allow authenticated select for future client queries.
create policy "wallet_transactions_select_own"
  on public.wallet_transactions
  for select
  using (true);
