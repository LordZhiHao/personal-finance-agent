import html
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from utils.constants import THEME_COLORS
from utils.logger import get_logger

logger = get_logger(__name__)


def build_html(data: dict, accent: str) -> str:
    currency = data["currency"]
    cat_rows = "".join(
        f"<tr><td style='padding:4px 12px 4px 0'>{cat}</td>"
        f"<td>{currency} {amt:,.2f}</td></tr>"
        for cat, amt in data["by_category"].items()
    )
    snap_rows = "".join(
        f"<tr><td style='padding:4px 12px 4px 0'>{s['accounts']['name']}</td>"
        f"<td>{s['accounts']['currency']} {s['total_value']:,.2f}</td></tr>"
        for s in data["snapshots"]
    )
    return f"""
    <html><body style="font-family:sans-serif;color:#222;max-width:600px;margin:auto">
    <h2 style="color:{accent}">📊 Weekly Financial Update</h2>
    <p style="color:#666">{data['week_start'].strftime('%d %b')} –
       {data['week_end'].strftime('%d %b %Y')}</p>

    <h3 style="color:{accent}">💰 Income & Expenses</h3>
    <table>
      <tr><td>Income</td><td><b>{currency} {data['income']:,.2f}</b></td></tr>
      <tr><td>Spent</td><td><b>{currency} {data['expenses']:,.2f}</b></td></tr>
      <tr><td>Net</td><td><b>{currency} {data['net']:+,.2f}</b></td></tr>
      <tr><td>Savings Rate</td><td><b>{data['savings_rate']}%</b></td></tr>
    </table>

    <h3 style="color:{accent}">🧾 Spend by Category</h3>
    <table>{cat_rows}</table>

    <h3 style="color:{accent}">🏦 Portfolio Snapshot</h3>
    <table>{snap_rows}</table>
    <p><b>Total Assets: {currency} {data['total_assets']:,.2f}</b></p>
    </body></html>
    """


def send_email(data: dict, to_email: str, theme: str = "green"):
    accent = THEME_COLORS.get(theme, THEME_COLORS["green"])
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"💰 Weekly Update — w/e {data['week_end'].strftime('%d %b %Y')}"
    msg["From"] = os.getenv("GMAIL_USER")
    msg["To"] = to_email
    msg.attach(MIMEText(build_html(data, accent), "html"))
    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(os.getenv("GMAIL_USER"), os.getenv("GMAIL_APP_PASSWORD"))
        server.send_message(msg)
    logger.info("send_email: sent to %s", to_email)


def build_reminder_html(text: str, accent: str) -> str:
    return f"""
    <html><body style="font-family:sans-serif;color:#222;max-width:600px;margin:auto">
    <h2 style="color:{accent}">🔔 Reminder</h2>
    <p style="white-space:pre-wrap">{html.escape(text)}</p>
    </body></html>
    """


def send_reminder_email(text: str, to_email: str, theme: str = "green", subject: str = "🔔 Reminder from Finn"):
    accent = THEME_COLORS.get(theme, THEME_COLORS["green"])
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = os.getenv("GMAIL_USER")
    msg["To"] = to_email
    msg.attach(MIMEText(build_reminder_html(text, accent), "html"))
    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(os.getenv("GMAIL_USER"), os.getenv("GMAIL_APP_PASSWORD"))
        server.send_message(msg)
    logger.info("send_reminder_email: sent to %s", to_email)
