-- User's chosen accent color theme (orange/green), applied across the frontend
-- dashboard's charts/components and the weekly report email. Defaults to 'green'
-- to match the pre-existing single brand color, so existing users see no change.

alter table users add column if not exists theme text not null default 'green';

insert into schema_migrations (version) values ('0009_user_theme') on conflict do nothing;
