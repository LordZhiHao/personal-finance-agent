-- Onboarding personalization: demographic profile fields + a curated "persona" that
-- personalizes Finn's system prompt tone and drives an onboarding starter budget/goal
-- suggestion (see utils/constants.py PERSONAS). Identity fields are nullable with no
-- default -- NULL means "not yet answered," same convention as onboarding_completed_at
-- in 0008. num_kids/num_pets default to 0 since a count of zero is a real, known
-- answer, not an "unset" state -- same convention as hidden_dashboard_sections in 0016.
-- Enum-like fields (gender, marital_status, persona) are validated in
-- backend/schemas.py MeUpdate and bot/finance_agent.py's update_profile_settings tool,
-- not via a DB check constraint -- same convention as main_currency/theme.

alter table users add column if not exists name text;
alter table users add column if not exists age smallint;
alter table users add column if not exists gender text;
alter table users add column if not exists gender_other_text text;
alter table users add column if not exists marital_status text;
alter table users add column if not exists marital_status_other_text text;
alter table users add column if not exists num_kids smallint not null default 0;
alter table users add column if not exists num_pets smallint not null default 0;
alter table users add column if not exists persona text;
alter table users add column if not exists persona_custom_text text;

insert into schema_migrations (version) values ('0018_user_profile_persona') on conflict do nothing;
