import secrets
import string
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from backend.auth import get_current_user
from db.supabase import create_telegram_link_code
from utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/telegram-link", tags=["telegram-link"])

CODE_TTL_MINUTES = 10
CODE_LENGTH = 6
MAX_GENERATE_ATTEMPTS = 5


@router.post("")
def generate_link_code(user_id: str = Depends(get_current_user)):
    """Generates a short-lived numeric code the user redeems in the Telegram bot via
    `/link <code>` to bind their chat id to this account. No "consume" HTTP endpoint
    exists — the bot calls db.supabase.consume_telegram_link_code in-process, same
    service-key pattern as the rest of bot/."""
    for _ in range(MAX_GENERATE_ATTEMPTS):
        code = "".join(secrets.choice(string.digits) for _ in range(CODE_LENGTH))
        try:
            create_telegram_link_code(user_id, code, datetime.now(timezone.utc) + timedelta(minutes=CODE_TTL_MINUTES))
            return {"code": code, "ttl_minutes": CODE_TTL_MINUTES}
        except Exception:
            logger.warning("generate_link_code: collision or failure generating code, retrying")
            continue
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not generate a link code, try again")
