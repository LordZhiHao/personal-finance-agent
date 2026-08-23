-- Global (no user_id) cache of resolved ticker metadata — see bot/ticker_resolver.py.
-- Avoids re-calling the DeepSeek ticker resolver for repeat entries of an
-- already-known ticker, and lets utils/equity_pricing.py::resolve_yfinance_symbol
-- (used by scheduler/equity_price_updater.py, backend/routers/investments.py's
-- dividend forecast, and bot/handlers.py's /dividends command) correctly price
-- non-US tickers that the static TICKER_YFINANCE_MAP doesn't hand-cover. Same
-- ownerless category as equity_prices (see CLAUDE.md's Multi-Tenancy section).
--
-- RLS policy + anon/authenticated SELECT grant are included up front here, unlike
-- equity_prices which initially shipped without them and silently broke reads
-- until migrations/0004_equity_prices_public_read.sql fixed it later.

create table if not exists ticker_metadata (
    id uuid primary key default gen_random_uuid(),
    ticker text not null unique,
    company_name text,
    exchange text,
    symbol text,
    yfinance_symbol text,
    created_at timestamptz not null default now()
);

alter table ticker_metadata enable row level security;

drop policy if exists "ticker_metadata_public_read" on ticker_metadata;
create policy "ticker_metadata_public_read" on ticker_metadata for select using (true);

grant select on ticker_metadata to anon, authenticated;

insert into schema_migrations (version) values ('0019_ticker_metadata') on conflict do nothing;
