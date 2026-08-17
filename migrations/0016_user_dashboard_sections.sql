-- Per-user list of dashboard chart/section keys hidden from the Spending/Investments
-- views (Settings > Customize Dashboard). Stored as a "hidden" list rather than an
-- "enabled" allowlist so new sections added in future releases default to visible for
-- existing users -- an empty array (the default) means "everything visible."

alter table users add column if not exists hidden_dashboard_sections jsonb not null default '[]'::jsonb;

insert into schema_migrations (version) values ('0016_user_dashboard_sections') on conflict do nothing;

