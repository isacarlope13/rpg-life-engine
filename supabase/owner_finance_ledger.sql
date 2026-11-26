-- OakHaven finance ledger, private owner-only. No seed data.
create table if not exists public.owner_finance_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  occurred_at timestamptz not null,
  kind text not null check (kind in ('income','expense','transfer','opening_balance')),
  category text not null default 'Otros',
  description text not null default '',
  amount_cop bigint not null check (amount_cop > 0 and amount_cop <= 100000000000),
  payment_method text not null default '',
  origin text not null default 'csv' check (origin in ('csv','manual')),
  created_at timestamptz not null default now(),
  constraint owner_finance_transactions_unique unique (user_id, fingerprint)
);
create index if not exists owner_finance_transactions_owner_date
  on public.owner_finance_transactions (user_id, occurred_at desc);
create table if not exists public.owner_finance_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (length(btrim(label)) between 1 and 120),
  label_key text generated always as (lower(btrim(label))) stored,
  balance_cop bigint not null check (balance_cop >= 0 and balance_cop <= 100000000000),
  as_of_date date not null,
  revision uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  constraint owner_finance_accounts_unique unique (user_id, label_key),
  constraint owner_finance_accounts_owner_id_unique unique (user_id,id)
);
create table if not exists public.owner_finance_debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  creditor text not null check (length(btrim(creditor)) between 1 and 120),
  creditor_key text generated always as (lower(btrim(creditor))) stored,
  principal_remaining_cop bigint not null check (principal_remaining_cop >= 0 and principal_remaining_cop <= 100000000000),
  amount_due_cop bigint not null default 0 check (amount_due_cop >= 0 and amount_due_cop <= 100000000000),
  due_date date,
  status text not null check (status in ('active','overdue','settled','arrangement')),
  updated_at timestamptz not null default now(),
  constraint owner_finance_debts_settled check (status <> 'settled' or (principal_remaining_cop = 0 and amount_due_cop = 0)),
  constraint owner_finance_debts_unique unique (user_id, creditor_key)
);
create table if not exists public.owner_finance_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (length(btrim(label)) between 1 and 120),
  label_key text generated always as (lower(btrim(label))) stored,
  expected_on date not null,
  amount_cop bigint not null check (amount_cop > 0 and amount_cop <= 100000000000),
  kind text not null check (kind in ('income','expense')),
  status text not null default 'expected' check (status in ('expected','received','cancelled')),
  created_at timestamptz not null default now(),
  constraint owner_finance_events_unique unique (user_id, label_key, expected_on, kind)
);
create table if not exists public.owner_finance_reserves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  essential_cop bigint not null check (essential_cop between 0 and 100000000000),
  emergency_cop bigint not null check (emergency_cop between 0 and 100000000000),
  horizon date not null,
  updated_at timestamptz not null default now()
);
do $$
declare t text;
begin
  foreach t in array array['owner_finance_transactions','owner_finance_accounts','owner_finance_debts','owner_finance_events','owner_finance_reserves'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from PUBLIC, anon, authenticated', t);
    execute format('grant select, insert on public.%I to authenticated', t);
    if t <> 'owner_finance_transactions' then
      execute format('grant update on public.%I to authenticated', t);
    end if;
    execute format('drop policy if exists owner_self_only on public.%I', t);
    execute format('create policy owner_self_only on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

-- Prevent an older reconciliation from replacing a newer snapshot, including concurrent requests.
create or replace function public.owner_finance_guard_account_date()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.as_of_date < old.as_of_date then
    raise exception 'Older reconciliation' using errcode='23514';
  end if;
  new.revision := gen_random_uuid();
  return new;
end $$;
drop trigger if exists owner_finance_account_date_guard on public.owner_finance_accounts;
create trigger owner_finance_account_date_guard before update on public.owner_finance_accounts
for each row execute function public.owner_finance_guard_account_date();


-- Atomic manual posting. Imported history does not affect snapshots.
-- Draft migration is intended for a fresh owner ledger, not an already-applied older draft.
alter table public.owner_finance_transactions add column if not exists account_id uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname='owner_finance_transaction_account_fk' and conrelid='public.owner_finance_transactions'::regclass) then
    alter table public.owner_finance_transactions add constraint owner_finance_transaction_account_fk
      foreign key (user_id,account_id) references public.owner_finance_accounts(user_id,id);
  end if;
end $$;
create or replace function public.owner_finance_post_manual(
  p_account_id uuid, p_expected_revision uuid, p_fingerprint text,
  p_occurred_at timestamptz, p_kind text, p_amount_cop bigint,
  p_category text, p_description text, p_payment_method text
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_account public.owner_finance_accounts%rowtype;
  v_id uuid;
  v_balance bigint;
  v_day date := (p_occurred_at at time zone 'America/Bogota')::date;
begin
  if v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$'
    or p_kind is null or p_kind not in ('income','expense')
    or p_amount_cop is null or p_amount_cop not between 1 and 100000000000
    or p_occurred_at is null or p_occurred_at > now()
    or p_description is null or length(btrim(p_description)) not between 1 and 300
    or p_category is null or length(p_category) not between 1 and 100
    or p_payment_method is null or length(btrim(p_payment_method)) not between 1 and 80
  then raise exception 'Invalid manual movement' using errcode='22023'; end if;
  select * into v_account from public.owner_finance_accounts
    where id=p_account_id and user_id=v_user for update;
  if not found then raise exception 'Account unavailable' using errcode='42501'; end if;
  -- Replay is harmless even after account revision changes.
  if exists(select 1 from public.owner_finance_transactions where user_id=v_user and fingerprint=p_fingerprint)
  then return jsonb_build_object('inserted',0,'skipped',1,'balanceUpdated',false); end if;
  if p_expected_revision is distinct from v_account.revision or v_day < v_account.as_of_date
  then raise exception 'Reconciliation changed; review again' using errcode='23514'; end if;
  v_balance := v_account.balance_cop + case when p_kind='income' then p_amount_cop else -p_amount_cop end;
  if v_balance not between 0 and 100000000000
  then raise exception 'Resulting balance outside allowed range' using errcode='23514'; end if;
  insert into public.owner_finance_transactions(user_id,fingerprint,occurred_at,kind,amount_cop,category,description,payment_method,origin,account_id)
    values(v_user,p_fingerprint,p_occurred_at,p_kind,p_amount_cop,p_category,p_description,p_payment_method,'manual',p_account_id)
    on conflict(user_id,fingerprint) do nothing returning id into v_id;
  if v_id is null then return jsonb_build_object('inserted',0,'skipped',1,'balanceUpdated',false); end if;
  update public.owner_finance_accounts set balance_cop=v_balance,as_of_date=v_day
    where user_id=v_user and id=p_account_id;
  if not found then raise exception 'Account update failed' using errcode='23514'; end if;
  return jsonb_build_object('inserted',1,'skipped',0,'balanceUpdated',true,'balanceCop',v_balance);
end $$;
revoke all on function public.owner_finance_post_manual(uuid,uuid,text,timestamptz,text,bigint,text,text,text) from public,anon;
grant execute on function public.owner_finance_post_manual(uuid,uuid,text,timestamptz,text,bigint,text,text,text) to authenticated;
