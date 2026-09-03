-- Balance checkpoints: a first-class "this is the real stated balance as of this
-- date" write for bank/ewallet accounts, since balances here are user-maintained,
-- not bank-linked (see CLAUDE.md's Settings/accounts notes). Multiple rows per
-- account over time — a history, not a single mutable value — so
-- utils/balances.py::compute_account_balances() can always roll transactions
-- forward from the latest checkpoint (stated_balance + sum(transactions.amount
-- where date > as_of)) instead of summing every transaction ever from zero, and
-- the gap between the two is a visible reconciliation delta rather than silent
-- drift. An account with no checkpoint row keeps today's from-zero behavior.

create table if not exists account_balance_checkpoints (
    id              uuid primary key default gen_random_uuid(),
    account_id      uuid not null references accounts(id) on delete cascade,
    as_of           date not null,
    stated_balance  numeric not null,
    currency        text not null,
    -- stated_balance minus what the previous checkpoint (or, for a first checkpoint,
    -- a from-zero transaction sum) projected forward to as_of — the reconciliation
    -- delta shown as "-S$142 since you set it" in Settings. Computed once at insert
    -- time in db.supabase.create_balance_checkpoint(), not recomputed on every read.
    drift_amount    numeric not null,
    created_at      timestamptz not null default now()
);
create index if not exists idx_account_balance_checkpoints_account_id
    on account_balance_checkpoints(account_id, as_of desc);

insert into schema_migrations (version) values ('0020_account_balance_checkpoints') on conflict do nothing;
