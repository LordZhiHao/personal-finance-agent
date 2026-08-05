from collections import defaultdict
from datetime import date

from db.supabase import get_all_budgets, get_category_classifications_for_user, get_transactions, mark_budget_alerted
from scheduler.emailer import send_reminder_email
from scheduler.report_builder import budget_status
from utils.logger import get_logger

logger = get_logger(__name__)


async def check_budgets(bot):
    """Polled once a day (see bot/main.py) — budget status isn't time-sensitive like a
    stock alert, so a daily cadence is enough. Fetches every active budget row once,
    groups by owner, and re-uses one month-to-date transaction fetch per user rather
    than per budget — same batching idea as scheduler/user_alerts.py's check_alerts.
    One user's bad row, Telegram failure, or email failure never blocks the rest."""
    budgets = get_all_budgets()
    logger.info("check_budgets: evaluating %d budget(s)", len(budgets))
    if not budgets:
        return

    by_user: dict[str, list[dict]] = defaultdict(list)
    for b in budgets:
        by_user[b["user_id"]].append(b)

    current_month = date.today().strftime("%Y-%m")
    month_start = date.today().replace(day=1).isoformat()
    today = date.today().isoformat()

    for user_id, user_budgets in by_user.items():
        try:
            txns = get_transactions(month_start, today, user_id)
            classifications = get_category_classifications_for_user(user_id)
            statuses = budget_status(txns, user_budgets, classifications)
        except Exception:
            logger.exception("check_budgets: failed computing status for user_id=%s", user_id)
            continue

        user = (user_budgets[0].get("users")) or {}
        for status, budget in zip(statuses, user_budgets):
            try:
                if status["spent"] <= status["monthly_limit"]:
                    continue
                if budget.get("last_alerted_month") == current_month:
                    continue

                text = (
                    f"🚨 Budget exceeded: {status['category']} — spent {status['currency']} "
                    f"{status['spent']:,.2f} of your {status['currency']} {status['monthly_limit']:,.2f} "
                    "monthly limit."
                )
                if user.get("telegram_chat_id"):
                    try:
                        await bot.send_message(chat_id=user["telegram_chat_id"], text=text)
                    except Exception:
                        logger.exception("check_budgets: telegram send failed for budget_id=%s", budget["id"])
                if user.get("notify_email"):
                    try:
                        send_reminder_email(
                            text, to_email=user["notify_email"], theme=user.get("theme", "green"),
                            subject="🚨 Budget exceeded",
                        )
                    except Exception:
                        logger.exception("check_budgets: email send failed for budget_id=%s", budget["id"])
                mark_budget_alerted(budget["id"], current_month)
            except Exception:
                logger.exception("check_budgets: failed processing budget_id=%s", budget.get("id"))
