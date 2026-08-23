-- Application-level field encryption (AES-256-GCM, see utils/crypto.py) for the
-- financial values a leaked SUPABASE_SERVICE_KEY or direct DB access would
-- otherwise expose in plaintext. Additive only, by design: new nullable *_enc text
-- columns are added alongside the existing plaintext columns, and the plaintext
-- columns' NOT NULL constraints (if any) are relaxed so new code — which will stop
-- writing to the plaintext columns entirely — can still insert/update rows.
--
-- Rollout, in order:
--   1. Apply this migration.
--   2. Set FIELD_ENCRYPTION_KEY (Railway + local .env).
--   3. Run `python -m scripts.backfill_encrypt_fields` once against production data.
--   4. Deploy db/supabase.py + utils/crypto.py + backend/ + bot/ + scheduler/ together.
--   5. Once verified, a follow-up migration drops the old plaintext columns.
--
-- The old plaintext columns are deliberately left in place here (not dropped) so
-- step 3/4 has a rollback path if something goes wrong before verification.

alter table transactions add column if not exists amount_enc text;
alter table transactions add column if not exists description_enc text;
alter table transactions add column if not exists raw_text_enc text;
alter table transactions alter column amount drop not null;
alter table transactions alter column description drop not null;

alter table portfolio_events add column if not exists quantity_enc text;
alter table portfolio_events add column if not exists price_enc text;
alter table portfolio_events add column if not exists fees_enc text;
alter table portfolio_events alter column quantity drop not null;
alter table portfolio_events alter column price drop not null;

alter table asset_snapshots add column if not exists total_value_enc text;
alter table asset_snapshots alter column total_value drop not null;

insert into schema_migrations (version) values ('0017_field_encryption') on conflict do nothing;
