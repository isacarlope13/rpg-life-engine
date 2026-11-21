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
  created_at timestamptz not null default now(),
  constraint owner_finance_accounts_unique unique (user_id, label_key)
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
  return new;
end $$;
drop trigger if exists owner_finance_account_date_guard on public.owner_finance_accounts;
create trigger owner_finance_account_date_guard before update on public.owner_finance_accounts
for each row execute function public.owner_finance_guard_account_date();
