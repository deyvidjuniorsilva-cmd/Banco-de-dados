-- 0001_init.sql

create table accounts (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id),
  name text not null,
  kind text not null check (kind in ('conta', 'cartao')),
  bank text not null check (bank in ('nubank', 'sicoob_credivar', 'banco_do_brasil', 'mercado_pago')),
  created_at timestamptz not null default now()
);

create table imports (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id),
  account_id uuid not null references accounts(id) on delete cascade,
  file_path text not null,
  status text not null default 'pendente' check (status in ('pendente', 'revisado', 'erro')),
  created_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id),
  name text not null,
  created_at timestamptz not null default now(),
  unique (owner, name)
);

create table category_rules (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id),
  keyword text not null,
  category_id uuid not null references categories(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id),
  account_id uuid not null references accounts(id) on delete cascade,
  import_id uuid references imports(id) on delete set null,
  occurred_on date not null,
  description text not null,
  amount numeric(12, 2) not null,
  direction text not null check (direction in ('entrada', 'saida')),
  category_id uuid references categories(id) on delete set null,
  created_at timestamptz not null default now()
);

create table budgets (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id),
  category_id uuid not null references categories(id) on delete cascade,
  year integer not null,
  month integer not null check (month between 1 and 12),
  limit_amount numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  unique (owner, category_id, year, month)
);

alter table accounts enable row level security;
alter table imports enable row level security;
alter table categories enable row level security;
alter table category_rules enable row level security;
alter table transactions enable row level security;
alter table budgets enable row level security;

create policy "owner_all_accounts" on accounts for all using (owner = auth.uid()) with check (owner = auth.uid());
create policy "owner_all_imports" on imports for all using (owner = auth.uid()) with check (owner = auth.uid());
create policy "owner_all_categories" on categories for all using (owner = auth.uid()) with check (owner = auth.uid());
create policy "owner_all_category_rules" on category_rules for all using (owner = auth.uid()) with check (owner = auth.uid());
create policy "owner_all_transactions" on transactions for all using (owner = auth.uid()) with check (owner = auth.uid());
create policy "owner_all_budgets" on budgets for all using (owner = auth.uid()) with check (owner = auth.uid());
