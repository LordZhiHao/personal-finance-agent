-- Adds a display name (e.g. "Apple Inc.") alongside each equity_prices row, so the
-- Positions table can show more than a raw ticker symbol. Populated going forward by
-- utils/equity_pricing.py::fetch_prices; existing rows stay null until their next refresh.

alter table equity_prices add column if not exists name text;

insert into schema_migrations (version) values ('0003_equity_prices_name') on conflict do nothing;
