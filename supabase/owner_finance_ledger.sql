-- OakHaven finance ledger, private owner-only. No seed data.
create table if not exists public.owner_finance_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fingerprint text not null,
  occurred_at timestamptz not null,
  kind text not null check (kind in ('income','expense','transfer','opening_balance')),
  category text not null default 'Otros',
  description text not null default '',
  amount_cop bigint not null check (amount_cop > 0 and amount_cop <= 100000000000),
  payment_method text not null default '',
  origin text not null default 'csv',
  created_at timestamptz not null default now(),
  constraint owner_finance_transactions_unique unique (user_id, fingerprint)
);
create index if not exists owner_finance_transactions_owner_date
  on public.owner_finance_transactions (user_id, occurred_at desc);
create table if not exists public.owner_finance_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  balance_cop bigint not null check (balance_cop >= 0 and balance_cop <= 100000000000),
  as_of_date date not null,
  created_at timestamptz not null default now(),
  constraint owner_finance_accounts_unique unique (user_id, label)
);
create table if not exists public.owner_finance_debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  creditor text not null,
  principal_remaining_cop bigint not null check (principal_remaining_cop >= 0 and principal_remaining_cop <= 100000000000),
  amount_due_cop bigint not null default 0 check (amount_due_cop >= 0 and amount_due_cop <= 100000000000),
  due_date date,
  status text not null check (status in ('active','overdue','settled','arrangement')),
  updated_at timestamptz not null default now(),
  constraint owner_finance_debts_unique unique (user_id, creditor)
);
create table if not exists public.owner_finance_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  expected_on date not null,
  amount_cop bigint not null check (amount_cop > 0 and amount_cop <= 100000000000),
  kind text not null check (kind in ('income','expense')),
  status text not null default 'expected' check (status in ('expected','received','cancelled')),
  created_at timestamptz not null default now(),
  constraint owner_finance_events_unique unique (user_id, label, expected_on, kind)
);
do $$
declare t text;
begin
  foreach t in array array['owner_finance_transactions','owner_finance_accounts','owner_finance_debts','owner_finance_events'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname='owner_self_only') then
      execute format('create policy owner_self_only on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    end if;
  end loop;
end $$;
