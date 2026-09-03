-- "How Finn behaves" preferences, surfaced from the Settings restructure —
-- plain columns on users, same convention as main_currency/theme (migrations
-- 0007/0009): no dedicated db/supabase.py functions, just the generic
-- get_user_by_id/update_user. Defaults preserve today's actual behavior for
-- every existing user (weekly reports already send unconditionally; the budget
-- scheduler's over-limit alert already fires at the monthly_limit itself, i.e.
-- effectively a 100% threshold, but 80% is the more useful default going forward
-- for anyone who hasn't changed it, matching the mockup's own copy).

alter table users add column if not exists budget_nudge_threshold numeric not null default 80;
alter table users add column if not exists weekly_recap boolean not null default true;

insert into schema_migrations (version) values ('0021_user_preferences') on conflict do nothing;
