-- Self-reported monthly income, captured in the redesigned onboarding wizard's
-- "Your plan" step and used as the baseline for the suggested-budget endpoint's
-- "what's left to plan" figure (see backend/routers/onboarding.py). Nullable with
-- no default -- NULL means "not yet answered," same convention as age/persona in
-- 0018 and onboarding_completed_at in 0008. No currency column: always interpreted
-- in the user's main_currency (same implicit-currency convention as that column).

alter table users add column if not exists monthly_income numeric;

insert into schema_migrations (version) values ('0022_user_monthly_income') on conflict do nothing;
