-- Categorization rules a user defines to deterministically override a transaction's
-- category going forward (enforced in bot/handlers.py::save_extraction, every commit
-- path) and to re-file past matching transactions on demand (POST /api/rules/{id}/apply).
-- Rules are also surfaced as hints inside the Gemini/DeepSeek extraction prompt
-- (bot/extractor.py) so the model's raw guess is right more often even before the
-- deterministic pass runs -- but that pass is what makes "edit one and it re-files the
-- history" a real guarantee, not the prompt hint alone.
--
-- match_type is intentionally just two real mechanisms, not the mockup's "merchant is"/
-- "payee is" framing -- transactions has no separate merchant/payee column, only
-- description, so every text match is description_contains under the hood.
-- pattern is generic text: the substring for description_contains, a stringified
-- number for amount_equals (matched against abs(transactions.amount), so the user
-- doesn't need to think about the expense sign convention).
--
-- learned_from allows 'correction' now (not just 'manual') even though the app never
-- writes it yet -- auto-learning rules from manual category corrections is a deferred,
-- separate phase, and giving the column its full value set today avoids a migration
-- just to add a check-constraint value later.

create table if not exists category_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  match_type text not null check (match_type in ('description_contains', 'amount_equals')),
  pattern text not null,
  category text not null,
  hit_count integer not null default 0,
  learned_from text not null default 'manual' check (learned_from in ('manual', 'correction')),
  created_at timestamptz not null default now()
);

create index if not exists category_rules_user_id_idx on category_rules(user_id);

insert into schema_migrations (version) values ('0023_category_rules') on conflict do nothing;
