"""Application-level field encryption (AES-256-GCM) for sensitive columns in
`transactions`/`portfolio_events`/`asset_snapshots` (see db/supabase.py's row-level
_encrypt_*/_decrypt_* helpers). The key lives only in FIELD_ENCRYPTION_KEY, read
once here and never passed to or stored in Supabase in any form — this is what
makes the encryption meaningful beyond Supabase's own at-rest disk encryption:
even a leaked SUPABASE_SERVICE_KEY or direct DB access only exposes ciphertext.

Encoding: base64(12-byte random nonce || ciphertext || 16-byte GCM auth tag).
A fresh random nonce is generated per call — GCM's one hard requirement is that
a (key, nonce) pair is never reused.
"""
import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from dotenv import load_dotenv

load_dotenv()

_NONCE_LEN = 12


def _key() -> bytes:
    raw = os.getenv("FIELD_ENCRYPTION_KEY")
    if not raw:
        raise RuntimeError("FIELD_ENCRYPTION_KEY is not set")
    key = bytes.fromhex(raw)
    if len(key) != 32:
        raise RuntimeError("FIELD_ENCRYPTION_KEY must be a 32-byte (64 hex character) key")
    return key


def encrypt_str(value: str) -> str:
    aesgcm = AESGCM(_key())
    nonce = os.urandom(_NONCE_LEN)
    ciphertext = aesgcm.encrypt(nonce, value.encode("utf-8"), None)
    return base64.b64encode(nonce + ciphertext).decode("ascii")


def decrypt_str(token: str) -> str:
    aesgcm = AESGCM(_key())
    raw = base64.b64decode(token)
    nonce, ciphertext = raw[:_NONCE_LEN], raw[_NONCE_LEN:]
    return aesgcm.decrypt(nonce, ciphertext, None).decode("utf-8")


def encrypt_float(value: float | int | None) -> str | None:
    return encrypt_str(repr(value)) if value is not None else None


def decrypt_float(token: str | None) -> float | None:
    return float(decrypt_str(token)) if token is not None else None


def encrypt_text(value: str | None) -> str | None:
    return encrypt_str(value) if value is not None else None


def decrypt_text(token: str | None) -> str | None:
    return decrypt_str(token) if token is not None else None
