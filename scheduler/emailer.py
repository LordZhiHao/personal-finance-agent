import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from utils.logger import get_logger

logger = get_logger(__name__)


def build_html(data: dict) -> str:
    cat_rows = "".join(
        f"<tr><td style='padding:4px 12px 4px 0'>{cat}</td>"
        f"<td>SGD {amt:,.2f}</td></tr>"
        for cat, amt in data["by_category"].items()
    )
    snap_rows = "".join(
        f"<tr><td style='padding:4px 12px 4px 0'>{s['accounts']['name']}</td>"
        f"<td>{s['accounts']['currency']} {s['total_value']:,.2f}</td></tr>"
        for s in data["snapshots"]
    )
    return f"""
    <html><body style="font-family:sans-serif;color:#222;max-width:600px;margin:auto">
    <h2>📊 Weekly Financial Update</h2>
    <p style="color:#666">{data['week_start'].strftime('%d %b')} –
       {data['week_end'].strftime('%d %b %Y')}</p>

    <h3>💰 Income & Expenses</h3>
    <table>
      <tr><td>Income</td><td><b>SGD {data['income']:,.2f}</b></td></tr>
      <tr><td>Spent</td><td><b>SGD {data['expenses']:,.2f}</b></td></tr>
      <tr><td>Net</td><td><b>SGD {data['net']:+,.2f}</b></td></tr>
      <tr><td>Savings Rate</td><td><b>{data['savings_rate']}%</b></td></tr>
    </table>

    <h3>🧾 Spend by Category</h3>
    <table>{cat_rows}</table>

    <h3>🏦 Portfolio Snapshot</h3>
    <table>{snap_rows}</table>
    <p><b>Total Assets: SGD {data['total_assets']:,.2f}</b></p>
    </body></html>
    """


def send_email(data: dict):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"💰 Weekly Update — w/e {data['week_end'].strftime('%d %b %Y')}"
    msg["From"] = os.getenv("GMAIL_USER")
    msg["To"] = os.getenv("NOTIFY_EMAIL")
    msg.attach(MIMEText(build_html(data), "html"))
    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(os.getenv("GMAIL_USER"), os.getenv("GMAIL_APP_PASSWORD"))
        server.send_message(msg)
    logger.info("send_email: sent to %s", os.getenv("NOTIFY_EMAIL"))
