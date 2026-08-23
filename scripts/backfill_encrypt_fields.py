"""One-time backfill: encrypts the existing plaintext transactions.amount/description/
raw_text, portfolio_events.quantity/price/fees, and asset_snapshots.total_value values
into their new *_enc columns (see migrations/0017_field_encryption.sql).

Run once per environment, after applying migrations/0017_field_encryption.sql and
setting FIELD_ENCRYPTION_KEY, and BEFORE deploying the db/supabase.py version that
reads/writes only the *_enc columns:

    python -m scripts.backfill_encrypt_fields

Safe to re-run — only touches rows where the *_enc column is still null, so a partial
prior run (or rows already encrypted) are skipped rather than double-encrypted.
"""
from dotenv import load_dotenv

load_dotenv()

from db.supabase import get_client  # noqa: E402
from utils import crypto  # noqa: E402

BATCH_SIZE = 500


def _backfill_table(table: str, plain_to_enc: dict[str, str], float_fields: set[str]):
    db = get_client(use_service_key=True)
    plain_cols = list(plain_to_enc.keys())
    enc_cols = list(plain_to_enc.values())
    total = 0
    while True:
        # Any *_enc column left null identifies a not-yet-backfilled row; check the
        # first one since a row is only ever backfilled as a whole.
        rows = (
            db.table(table)
            .select("id, " + ", ".join(plain_cols))
            .is_(enc_cols[0], "null")
            .limit(BATCH_SIZE)
            .execute()
            .data
        )
        if not rows:
            break
        for row in rows:
            updates = {}
            for plain_col, enc_col in plain_to_enc.items():
                value = row.get(plain_col)
                if plain_col in float_fields:
                    updates[enc_col] = crypto.encrypt_float(value)
                else:
                    updates[enc_col] = crypto.encrypt_text(value)
            db.table(table).update(updates).eq("id", row["id"]).execute()
        total += len(rows)
        print(f"{table}: backfilled {total} row(s) so far")
    print(f"{table}: done, {total} row(s) backfilled")


def main():
    _backfill_table(
        "transactions",
        {"amount": "amount_enc", "description": "description_enc", "raw_text": "raw_text_enc"},
        float_fields={"amount"},
    )
    _backfill_table(
        "portfolio_events",
        {"quantity": "quantity_enc", "price": "price_enc", "fees": "fees_enc"},
        float_fields={"quantity", "price", "fees"},
    )
    _backfill_table(
        "asset_snapshots",
        {"total_value": "total_value_enc"},
        float_fields={"total_value"},
    )


if __name__ == "__main__":
    main()
