-- equity_prices is global, ownerless market data (see CLAUDE.md), so it should be
-- readable by the anon key like every other table's reads in db/supabase.py. It
-- predates the migrations/ folder and was apparently set up by hand without a
-- permissive SELECT policy/grant, silently breaking get_latest_equity_prices() for
-- every caller (Positions table, Top Holdings, /portfolio bot command) even though
-- rows exist and are inserted fine via the service key. Idempotent — covers both a
-- missing RLS policy and a missing grant, whichever is actually the cause.

alter table equity_prices enable row level security;

drop policy if exists "equity_prices_public_read" on equity_prices;
create policy "equity_prices_public_read" on equity_prices for select using (true);

grant select on equity_prices to anon, authenticated;

insert into schema_migrations (version) values ('0004_equity_prices_public_read') on conflict do nothing;
