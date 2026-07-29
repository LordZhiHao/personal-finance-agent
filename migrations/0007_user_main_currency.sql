-- User's preferred display currency (MYR/SGD/USD), set from the Settings page and
-- used everywhere instead of the old per-page hardcoded/selectable "SGD" default.

alter table users add column if not exists main_currency text not null default 'SGD';

insert into schema_migrations (version) values ('0007_user_main_currency') on conflict do nothing;
