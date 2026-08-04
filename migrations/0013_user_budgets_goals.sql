-- Per-category monthly spending limits (user_budgets) and one-off savings goals
-- with a manually-tracked running total (user_goals). Separate tables rather than
-- one nullable-everything table, since the two have different lifecycles (budgets
-- recur every calendar month; goals run once toward a target, optionally by a date) —
-- same split precedent as user_reminders vs user_alerts.

create table if not exists user_budgets (
    id                 uuid primary key default gen_random_uuid(),
    user_id            uuid not null references users(id) on delete cascade,
    category           text not null,
    monthly_limit      numeric not null,
    currency           text not null,
    last_alerted_month text,              -- 'YYYY-MM' of the last month an over-limit notice was sent; re-arms next month
    created_at         timestamptz not null default now(),
    constraint user_budgets_category_unique unique (user_id, category),
    constraint user_budgets_limit_positive check (monthly_limit > 0)
);
create index if not exists idx_user_budgets_user_id on user_budgets(user_id);

create table if not exists user_goals (
    id             uuid primary key default gen_random_uuid(),
    user_id        uuid not null references users(id) on delete cascade,
    name           text not null,
    target_amount  numeric not null,
    current_amount numeric not null default 0,
    target_date    date,
    currency       text not null,
    created_at     timestamptz not null default now(),
    constraint user_goals_target_positive check (target_amount > 0)
);
create index if not exists idx_user_goals_user_id on user_goals(user_id);

insert into schema_migrations (version) values ('0013_user_budgets_goals') on conflict do nothing;
