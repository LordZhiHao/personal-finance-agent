import os

import pytz
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from dotenv import load_dotenv
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, filters

from bot.handlers import (
    handle_assets_command,
    handle_balance_command,
    handle_document,
    handle_error,
    handle_expense_command,
    handle_help_command,
    handle_photo,
    handle_portfolio_command,
    handle_recent_command,
    handle_text,
    handle_undo_command,
)
from scheduler.daily_checkin import send_daily_checkin
from scheduler.equity_price_updater import update_equity_prices
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
    )
    scheduler.add_job(
        send_daily_checkin,
        trigger="cron",
        hour=22,
        minute=30,
        args=[app.bot],
    )
    scheduler.start()
    logger.info(
        "Scheduler started — weekly report every Sunday 8pm SGT, "
        "daily check-in 10:30pm SGT, equity prices hourly"
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
    app.add_handler(CommandHandler("expense", handle_expense_command))
    app.add_handler(CommandHandler("portfolio", handle_portfolio_command))
    app.add_handler(CommandHandler("assets", handle_assets_command))
    app.add_handler(CommandHandler("balance", handle_balance_command))
    app.add_handler(CommandHandler("recent", handle_recent_command))
    app.add_handler(CommandHandler("undo", handle_undo_command))
    app.add_handler(CommandHandler("help", handle_help_command))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    app.add_error_handler(handle_error)
    logger.info("Bot is running...")
    app.run_polling()


if __name__ == "__main__":
    main()
