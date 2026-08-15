-- Assistant chat sessions (main /app/chat) persisted per owner wallet.

create table if not exists public.assistant_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_wallet text not null references public.profiles (wallet_address) on delete cascade,
  title text not null default '对话',
  /** Full AI SDK UIMessage[] JSON for restore across tabs / reloads. */
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_wallet)
);

create index if not exists assistant_chat_sessions_updated_idx
  on public.assistant_chat_sessions (updated_at desc);

alter table public.assistant_chat_sessions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'assistant_chat_sessions'
      and policyname = 'assistant_chat_sessions_select_all'
  ) then
    create policy "assistant_chat_sessions_select_all"
      on public.assistant_chat_sessions for select using (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where tablename = 'assistant_chat_sessions'
      and policyname = 'assistant_chat_sessions_insert_all'
  ) then
    create policy "assistant_chat_sessions_insert_all"
      on public.assistant_chat_sessions for insert with check (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where tablename = 'assistant_chat_sessions'
      and policyname = 'assistant_chat_sessions_update_all'
  ) then
    create policy "assistant_chat_sessions_update_all"
      on public.assistant_chat_sessions for update using (true) with check (true);
  end if;
end $$;
