-- Stores a pointer to the original uploaded receipt/statement image or PDF (in
-- Supabase Storage, bucket 'receipts' — private; must be created manually via the
-- Supabase dashboard/CLI first, since a SQL migration can't create a Storage bucket).
-- A separate table with its own id (rather than a bare transactions.receipt_path
-- column) because one upload commonly produces multiple transactions/portfolio_events
-- rows, which can all share one receipt.

create table if not exists receipts (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid not null references users(id) on delete cascade,
    storage_path text not null,
    content_type text not null,
    created_at   timestamptz not null default now()
);
create index if not exists idx_receipts_user_id on receipts(user_id);

alter table transactions add column if not exists receipt_id uuid references receipts(id);
alter table portfolio_events add column if not exists receipt_id uuid references receipts(id);

insert into schema_migrations (version) values ('0014_receipts') on conflict do nothing;
