import os

import pytz
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from dotenv import load_dotenv
from telegram.ext import ApplicationBuilder, CallbackQueryHandler, CommandHandler, MessageHandler, filters

from bot.handlers import (
    handle_account_choice_callback,
    handle_allocation_command,
    handle_assets_command,
    handle_balance_command,
    handle_compare_command,
    handle_dashboard_command,
    handle_dividends_command,
    handle_document,
    handle_error,
    handle_expense_command,
    handle_help_command,
    handle_link_command,
    handle_newaccount_command,
    handle_photo,
    handle_portfolio_command,
    handle_recent_command,
    handle_text,
    handle_undo_command,
)
from scheduler.daily_checkin import send_daily_checkin
from scheduler.dividend_check import send_dividend_notifications
from scheduler.equity_price_updater import update_equity_prices
from scheduler.user_alerts import check_alerts
from scheduler.user_budgets import check_budgets
from scheduler.user_reminders import send_due_reminders
from scheduler.weekly_report import send_weekly_report
from utils.logger import get_logger

load_dotenv()
logger = get_logger(__name__)


async def post_init(app):
    scheduler = AsyncIOScheduler(timezone=pytz.timezone("Asia/Singapore"))
    scheduler.add_job(
        send_weekly_report,
        trigger="cron",
        day_of_week="sun",
        hour=20,
        minute=0,
        args=[app.bot],
    )
    scheduler.add_job(
        update_equity_prices,
        trigger="interval",
        hours=1,
        id="equity_prices_hourly",
    )
    scheduler.add_job(
        update_equity_prices,
        trigger="cron",
        hour=23,
        minute=50,
        id="equity_prices_eod",
    )
    scheduler.add_job(
        send_daily_checkin,
        trigger="cron",
        hour=22,
        minute=30,
        args=[app.bot],
    )
    scheduler.add_job(
        send_dividend_notifications,
        trigger="cron",
        hour=8,
        minute=0,
        args=[app.bot],
    )
    scheduler.add_job(
        send_due_reminders,
        trigger="interval",
        minutes=5,
        args=[app.bot],
        id="user_reminders_poll",
    )
    scheduler.add_job(
        check_alerts,
        trigger="interval",
        minutes=15,
        args=[app.bot],
        id="user_alerts_poll",
    )
    scheduler.add_job(
        check_budgets,
        trigger="cron",
        hour=9,
        minute=0,
        args=[app.bot],
        id="user_budgets_poll",
    )
    scheduler.start()
    logger.info(
        "Scheduler started — weekly report every Sunday 8pm SGT, "
        "daily check-in 10:30pm SGT, dividend check 8am SGT, equity prices hourly + 11:50pm SGT, "
        "user reminders polled every 5 minutes, user alerts polled every 15 minutes, "
        "user budgets checked daily 9am SGT"
    )


def main():
    app = (
        ApplicationBuilder()
        .token(os.getenv("BOT_TOKEN"))
        .post_init(post_init)
        .build()
    )
    app.add_handler(MessageHandler(filters.PHOTO, handle_photo))
    app.add_handler(MessageHandler(filters.Document.ALL, handle_document))
    app.add_handler(CommandHandler("link", handle_link_command))
    app.add_handler(CommandHandler("dashboard", handle_dashboard_command))
    app.add_handler(CommandHandler("newaccount", handle_newaccount_command))
    app.add_handler(CommandHandler("expense", handle_expense_command))
    app.add_handler(CommandHandler("compare", handle_compare_command))
    app.add_handler(CommandHandler("portfolio", handle_portfolio_command))
    app.add_handler(CommandHandler("dividends", handle_dividends_command))
    app.add_handler(CommandHandler("allocation", handle_allocation_command))
    app.add_handler(CommandHandler("assets", handle_assets_command))
    app.add_handler(CommandHandler("balance", handle_balance_command))
    app.add_handler(CommandHandler("recent", handle_recent_command))
    app.add_handler(CommandHandler("undo", handle_undo_command))
    app.add_handler(CommandHandler("help", handle_help_command))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    app.add_handler(CallbackQueryHandler(handle_account_choice_callback, pattern=r"^acct:"))
    app.add_error_handler(handle_error)
    logger.info("Bot is running...")
    app.run_polling()


if __name__ == "__main__":
    main()
