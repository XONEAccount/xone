-- Agent payee/host allowlists + atomic daily-budget debit/refund.
-- Debit MUST be remaining_daily = remaining_daily - amount in SQL (not read-modify-write).

alter table public.xone_agents
  add column if not exists allowed_hosts text[] not null default '{}',
  add column if not exists allowed_payees text[] not null default '{}';

comment on column public.xone_agents.allowed_hosts is
  'Optional hostname allowlist for x402 URLs. Empty = any public host (SSRF still blocked).';
comment on column public.xone_agents.allowed_payees is
  'Optional 0x payTo allowlist. Empty = any payee on the agent network.';

create or replace function public.xone_debit_agent_spend(
  p_agent_id text,
  p_amount numeric,
  p_daily_period text
)
returns public.xone_agents
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.xone_agents;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'xone_debit_failed' using errcode = 'P0001';
  end if;

  update public.xone_agents
  set
    remaining_daily = remaining_daily - p_amount,
    status = case
      when remaining_daily - p_amount <= 0 then 'exhausted'
      else 'active'
    end,
    updated_at = now()
  where id = p_agent_id
    and status = 'active'
    and daily_period = p_daily_period
    and remaining_daily >= p_amount
  returning * into r;

  if r.id is null then
    raise exception 'xone_debit_failed' using errcode = 'P0001';
  end if;

  return r;
end;
$$;

create or replace function public.xone_refund_agent_spend(
  p_agent_id text,
  p_amount numeric
)
returns public.xone_agents
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.xone_agents;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'xone_refund_failed' using errcode = 'P0001';
  end if;

  update public.xone_agents
  set
    remaining_daily = least(daily_limit, remaining_daily + p_amount),
    status = case
      when status in ('paused', 'deleted') then status
      when least(daily_limit, remaining_daily + p_amount) > 0 then 'active'
      else 'exhausted'
    end,
    updated_at = now()
  where id = p_agent_id
  returning * into r;

  if r.id is null then
    raise exception 'xone_refund_failed' using errcode = 'P0001';
  end if;

  return r;
end;
$$;

revoke all on function public.xone_debit_agent_spend(text, numeric, text) from public, anon, authenticated;
revoke all on function public.xone_refund_agent_spend(text, numeric) from public, anon, authenticated;
grant execute on function public.xone_debit_agent_spend(text, numeric, text) to service_role;
grant execute on function public.xone_refund_agent_spend(text, numeric) to service_role;
