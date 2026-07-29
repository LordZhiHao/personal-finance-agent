-- Tracks whether a user has been through (or skipped past) the post-signup
-- onboarding wizard (main currency -> accounts -> categories -> Telegram link).
-- NULL means "needs onboarding"; non-null is the timestamp it was completed/skipped.

alter table users add column if not exists onboarding_completed_at timestamptz;

-- Backfill: every user that existed before this migration is already using the
-- app day-to-day — treat them as already onboarded so they aren't dropped into
-- the wizard on their next login. New signups after this migration get NULL
-- (needs onboarding) since create_user() never sets this column.
update users set onboarding_completed_at = created_at where onboarding_completed_at is null;

insert into schema_migrations (version) values ('0008_user_onboarding') on conflict do nothing;
