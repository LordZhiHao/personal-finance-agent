import calendar
from datetime import datetime, timedelta

import pytz

from db.supabase import get_all_active_reminders, mark_reminder_sent
from scheduler.emailer import send_reminder_email
from utils.logger import get_logger

logger = get_logger(__name__)

SGT = pytz.timezone("Asia/Singapore")

# 1 minute wider than the 5-minute poll interval so a slow tick (GC pause, event-loop
# contention, restart) never leaves a gap between two consecutive ticks' windows that a
# reminder could fall through.
DUE_WINDOW_MINUTES = 6


def _effective_day_of_month(day_of_month: int, year: int, month: int) -> int:
    """Clamp e.g. day_of_month=31 to Feb's 28th so a 'last-of-month'-style reminder
    still fires once in short months instead of silently never matching."""
    return min(day_of_month, calendar.monthrange(year, month)[1])


def _is_due(reminder: dict, now: datetime) -> bool:
    frequency = reminder["frequency"]
    if frequency == "weekly":
        if now.weekday() != reminder["day_of_week"]:
            return False
    elif frequency == "monthly":
        if now.day != _effective_day_of_month(reminder["day_of_month"], now.year, now.month):
            return False

    hour, minute = int(reminder["time_of_day"][:2]), int(reminder["time_of_day"][3:5])
    scheduled = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if not (scheduled <= now < scheduled + timedelta(minutes=DUE_WINDOW_MINUTES)):
        return False

    last_sent_at = reminder.get("last_sent_at")
    if last_sent_at:
        last_sent_sgt = datetime.fromisoformat(last_sent_at).astimezone(SGT)
        if last_sent_sgt.date() == now.date():
            return False  # already sent this occurrence — poll overlap / restart guard
    return True


async def send_due_reminders(bot):
    """Polled every 5 minutes (see bot/main.py). One user's bad reminder row, Telegram
    send failure, or email failure never blocks the rest — same per-item try/except
    isolation as scheduler/weekly_report.py and scheduler/daily_checkin.py."""
    now = datetime.now(SGT)
    reminders = get_all_active_reminders()
    due = [r for r in reminders if _is_due(r, now)]
    logger.info("send_due_reminders: %d/%d reminder(s) due at %s", len(due), len(reminders), now.isoformat())

    for reminder in due:
        try:
            user = reminder.get("users") or {}
            text = f"🔔 {reminder['message']}"
            if reminder["channel"] in ("telegram", "both") and user.get("telegram_chat_id"):
                try:
                    await bot.send_message(chat_id=user["telegram_chat_id"], text=text)
                except Exception:
                    logger.exception("send_due_reminders: telegram send failed for reminder_id=%s", reminder["id"])
            if reminder["channel"] in ("email", "both") and user.get("notify_email"):
                try:
                    send_reminder_email(reminder["message"], to_email=user["notify_email"], theme=user.get("theme", "green"))
                except Exception:
                    logger.exception("send_due_reminders: email send failed for reminder_id=%s", reminder["id"])
            mark_reminder_sent(reminder["id"], now)
        except Exception:
            logger.exception("send_due_reminders: failed processing reminder_id=%s", reminder.get("id"))
