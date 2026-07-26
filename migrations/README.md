# Migrations

Versioned SQL schema changes for the Supabase Postgres database. Before this folder existed, schema was only documented as prose in `CLAUDE.md` — going forward, every schema change is a new file here.

## Convention

- Filenames: `NNNN_snake_case_description.sql`, 4-digit zero-padded, strictly ascending.
- Never edit a merged migration file — a new change is always a new, higher-numbered file.
- Write DDL idempotently where practical (`create table if not exists`, `add column if not exists`, `on conflict do nothing`) so a migration can be safely re-run.
- Each file ends by inserting its own version into `schema_migrations`, so `select * from schema_migrations order by applied_at;` always shows what has and hasn't run.
- One-off *data* backfills that need application logic (password hashing, reading env vars) belong in `scripts/`, not in a migration file — run them as an explicit manual step between two migrations, documented in the relevant migration's comments.

## Applying a migration

No migration runner is wired into this repo. Apply manually, in numeric order, via the Supabase SQL editor or:

```bash
psql "$SUPABASE_DB_URL" -f migrations/0001_multi_tenancy_schema.sql
```
