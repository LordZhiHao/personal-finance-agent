-- Run ONLY after scripts/backfill_owner.py has succeeded and
-- `select count(*) from accounts where user_id is null;` returns 0.
-- Locks accounts.user_id as required, now that every existing row has an owner.

alter table accounts alter column user_id set not null;

insert into schema_migrations (version) values ('0002_lock_accounts_owner') on conflict do nothing;
