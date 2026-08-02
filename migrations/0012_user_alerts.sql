-- Condition-based alerts (distinct from the clock-based user_reminders table) —
-- a user watches a live metric via chat with Finn and gets notified once it crosses
-- a threshold. daily_spend re-arms every day (spending is inherently day-scoped);
-- stock_price/net_worth/position_pnl are one-shot — they fire once and deactivate,
-- and the user recreates one via chat to watch again.

create table if not exists user_alerts (
    id                 uuid primary key default gen_random_uuid(),
    user_id            uuid not null references users(id) on delete cascade,
    metric             text not null,              -- 'daily_spend' | 'stock_price' | 'net_worth' | 'position_pnl'
    ticker             text,                        -- raw ticker (e.g. 'CSPX'), same convention as portfolio_events.ticker; required iff metric in ('stock_price','position_pnl')
    operator           text not null,               -- 'above' | 'below'
    threshold          numeric not null,
    message            text,                        -- optional custom note; auto-generated wording used if omitted
    channel            text not null default 'both', -- 'telegram' | 'email' | 'both'
    active             boolean not null default true,
    last_triggered_at  timestamptz,
    created_at         timestamptz not null default now(),
    constraint user_alerts_metric_check check (metric in ('daily_spend','stock_price','net_worth','position_pnl')),
    constraint user_alerts_operator_check check (operator in ('above','below')),
    constraint user_alerts_channel_check check (channel in ('telegram','email','both')),
    constraint user_alerts_ticker_required check (metric not in ('stock_price','position_pnl') or ticker is not null)
);
create index if not exists idx_user_alerts_user_id on user_alerts(user_id);
create index if not exists idx_user_alerts_active on user_alerts(active) where active;

insert into schema_migrations (version) values ('0012_user_alerts') on conflict do nothing;
