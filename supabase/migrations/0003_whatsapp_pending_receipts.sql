-- 0003_whatsapp_pending_receipts.sql

create table if not exists whatsapp_pending_receipts (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  phone text not null,
  status text not null check (status in ('aguardando_conta', 'aguardando_confirmacao')),
  extracted_date date not null,
  extracted_description text not null,
  extracted_amount numeric(12, 2) not null,
  extracted_direction text not null check (extracted_direction in ('entrada', 'saida')),
  account_id uuid references accounts(id) on delete set null,
  category_id uuid references categories(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_pending_receipts_phone_idx on whatsapp_pending_receipts(phone);

alter table whatsapp_pending_receipts enable row level security;

create policy "owner_all_whatsapp_pending_receipts" on whatsapp_pending_receipts
  for all using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
