import os

import pytz
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from dotenv import load_dotenv
from telegram.ext import ApplicationBuilder, MessageHandler, filters

from bot.handlers import handle_document, handle_photo, handle_text
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
    scheduler.start()
    logger.info("Scheduler started — weekly report every Sunday 8pm SGT, equity prices hourly")


def main():
    app = (
        ApplicationBuilder()
        .token(os.getenv("BOT_TOKEN"))
        .post_init(post_init)
        .build()
    )
    app.add_handler(MessageHandler(filters.PHOTO, handle_photo))
    app.add_handler(MessageHandler(filters.Document.ALL, handle_document))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    logger.info("Bot is running...")
    app.run_polling()


if __name__ == "__main__":
    main()
