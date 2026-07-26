-- Multi-tenancy: adds a `users` table, a `telegram_link_codes` table for binding a
-- Telegram chat to a web account, and a nullable `user_id` column on `accounts`.
-- Purely additive — safe to run while the existing single-tenant app is still live.
-- `accounts.user_id` is deliberately nullable here; it's locked to NOT NULL in
-- 0002_lock_accounts_owner.sql after scripts/backfill_owner.py has run.

create extension if not exists pgcrypto;

create table if not exists schema_migrations (
    version    text primary key,
    applied_at timestamptz not null default now()
);

create table if not exists users (
    id               uuid primary key default gen_random_uuid(),
    email            text not null unique,
    password_hash    text not null,
    telegram_chat_id bigint unique,
    notify_email     text,
    created_at       timestamptz not null default now()
);

create table if not exists telegram_link_codes (
    code       text primary key,
    user_id    uuid not null references users(id) on delete cascade,
    expires_at timestamptz not null,
    used_at    timestamptz,
    created_at timestamptz not null default now()
);
create index if not exists idx_telegram_link_codes_user_id on telegram_link_codes(user_id);

alter table accounts add column if not exists user_id uuid references users(id) on delete restrict;
create index if not exists idx_accounts_user_id on accounts(user_id);

insert into schema_migrations (version) values ('0001_multi_tenancy_schema') on conflict do nothing;
