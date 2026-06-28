# 💰 Personal Finance Tracker — Master Build Guide

> Telegram-first personal expense and asset tracker with VLM-powered data extraction, Supabase storage, Streamlit dashboard, and weekly scheduled reports.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Features](#2-features)
3. [Architecture](#3-architecture)
4. [Third-Party Services & Access Required](#4-third-party-services--access-required)
5. [Project File Structure](#5-project-file-structure)
6. [Database Schema](#6-database-schema)
7. [Environment Variables](#7-environment-variables)
8. [Step-by-Step Build Guide](#8-step-by-step-build-guide)
9. [Dashboard Spec](#9-dashboard-spec)
10. [Weekly Report Spec](#10-weekly-report-spec)
11. [Deployment Guide](#11-deployment-guide)
12. [Build Order Checklist](#12-build-order-checklist)

---

## 1. Project Overview

A fully personal, Telegram-native finance tracker. Drop bank statement screenshots, trade screenshots, or PDF statements into a Telegram bot — the bot uses Qwen VLM to extract structured transaction data, asks you to confirm, then writes to Supabase. A Streamlit dashboard visualises your net worth, spending trends, and income/expense ratios over time. A weekly scheduled report is pushed to you every Sunday via Telegram and email.

**Design principles:**
- No manual data entry apps — Telegram is the only interface for data input
- Nothing auto-commits without your confirmation
- All data lives in your own Supabase instance
- Auth is infrastructure-level, not bolted-on

---

## 2. Features

### 2.1 Telegram Bot — Data Ingestion
- Accepts **images** (bank statement screenshots, trade screenshots, receipts)
- Accepts **PDF files** (multi-page bank statements — auto-converted to images per page)
- Accepts **free-text** for manual one-line entries (e.g. `"spent $12 on lunch today"`)
- Qwen VLM extracts structured data: date, merchant, amount, category, currency
- Detects document type automatically: `bank_statement` | `trade_screenshot` | `receipt`
- Extracts both **expense/income transactions** and **portfolio trade events**
- Shows a **confirmation message** with all extracted rows before writing to DB
- Supports `confirm`, `cancel`, and `edit <row number>` commands
- Flags low-confidence extractions with a ⚠️ warning
- User ID whitelist — only your Telegram account can interact with the bot

### 2.2 Supabase Database
- `accounts` — your bank accounts, brokerages, wallets
- `transactions` — all income and expense entries, tagged by category
- `portfolio_events` — buy/sell/dividend trade records
- `asset_snapshots` — periodic total value per account (for net worth charting)
- Raw OCR output stored alongside every transaction for debugging

### 2.3 Streamlit Dashboard
- Protected via a simple email/password login form built into the app, checked against `DASHBOARD_EMAIL`/`DASHBOARD_PASSWORD` env vars (originally planned as Cloudflare Access, but that requires a domain you control as a Cloudflare DNS zone — doesn't work for a `*.streamlit.app` URL)
- Date range picker + account filter in sidebar
- **KPI row**: Net Worth, Monthly Income, Monthly Spend, Savings Rate
- **Line chart**: Net worth over time
- **Bar chart**: Monthly spend over time, stacked by category
- **Dual line chart**: Monthly income vs monthly expenses over time
- **Line chart**: Savings rate (%) over time
- **Donut chart**: Spend breakdown by category (current selected period)
- **Donut chart**: Asset allocation by geography (SG / MY / US / Cash)
- **Holdings table**: Ticker, Quantity, Latest Price, Total Value, P&L
- **Recent transactions table**: Searchable, filterable by category/account/date

### 2.4 Weekly Scheduler
- Runs every **Sunday at 8:00pm SGT** automatically
- Queries the past Mon–Sun window from Supabase
- Sends a **Telegram message** with: income, spend, net, savings rate, spend by category, portfolio snapshot, total assets
- Sends an **HTML email** with the same data (via Gmail SMTP)
- Runs in-process alongside the bot on Railway — no separate service needed

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     YOU                                  │
│  Drop screenshot/PDF/text into Telegram                  │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              TELEGRAM BOT  (Railway)                     │
│  python-telegram-bot v20+ (async)                        │
│  APScheduler (Sunday 8pm SGT)                            │
└──────┬───────────────────────────────────────┬──────────┘
       │                                       │
       ▼                                       ▼
┌──────────────────┐                 ┌─────────────────────┐
│  QWEN VLM API    │                 │  SUPABASE (Postgres) │
│  qwen-vl-max     │                 │  transactions        │
│  OpenAI-compat   │                 │  accounts            │
│  endpoint        │                 │  portfolio_events    │
└──────────────────┘                 │  asset_snapshots     │
                                     └──────────┬──────────┘
                                                │
                                                ▼
                                     ┌─────────────────────┐
                                     │  STREAMLIT DASHBOARD │
                                     │  (Streamlit Cloud)   │
                                     │  + login form        │
                                     └─────────────────────┘
                                                │
                                     ┌─────────────────────┐
                                     │  WEEKLY REPORT       │
                                     │  → Telegram message  │
                                     │  → Gmail HTML email  │
                                     └─────────────────────┘
```

---

## 4. Third-Party Services & Access Required

### 4.1 Required — Core Services

| Service | Purpose | How to Get Access | Free Tier |
|---|---|---|---|
| **Telegram Bot** | Bot token for ingestion + reports | @BotFather → `/newbot` | ✅ Free |
| **Gemini API** | Image/PDF understanding + extraction | [aistudio.google.com](https://aistudio.google.com) → API Key | ✅ Free tier |
| **Supabase** | Postgres database + REST API | [supabase.com](https://supabase.com) → New project | ✅ Free tier |
| **Railway** | Host the Telegram bot + scheduler | [railway.app](https://railway.app) → New project | ✅ $5 free/month |
| **Streamlit Community Cloud** | Host the dashboard | [streamlit.io/cloud](https://streamlit.io/cloud) → Connect GitHub | ✅ Free |

### 4.2 Required — Auth

No external service needed. The dashboard has a built-in email/password login form checked against `DASHBOARD_EMAIL`/`DASHBOARD_PASSWORD` env vars (set in Streamlit Cloud's Secrets in production). Originally planned as Cloudflare Zero Trust Access, but that requires a domain you control as a Cloudflare DNS zone — it can't front a `*.streamlit.app` URL you don't own.

### 4.3 Optional — Email Reports

| Service | Purpose | How to Get Access |
|---|---|---|
| **Gmail App Password** | Send weekly HTML email via SMTP | Google Account → Security → 2-Step Verification → App Passwords → Create |

### 4.4 Setup Notes

**Telegram — get your Chat ID:**
1. Start your bot, send it any message
2. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
3. Find `"chat": {"id": XXXXXXXXX}` — that is your `YOUR_TELEGRAM_CHAT_ID`

**Gemini API:**
- Model: `gemini-3.5-flash`
- Use the `google-genai` Python library (`google.genai.Client(api_key=...)`)
- Images are passed via `types.Part.from_bytes(data=..., mime_type=...)`, not base64 data URLs

**Supabase — what you need:**
- Project URL (e.g. `https://xxxx.supabase.co`)
- `anon` public key (for reading from dashboard)
- `service_role` key (for bot writes — keep this secret)

**Dashboard login — setup steps:**
1. Set `DASHBOARD_EMAIL`/`DASHBOARD_PASSWORD` in `.env` locally and in Streamlit Cloud's Secrets in production
2. `dashboard/app.py` gates the whole app behind `require_login()`, which checks a login form against those two env vars and persists the result in `st.session_state`
3. No external service needed — this replaced an earlier Cloudflare Access plan, which doesn't work because Cloudflare's Access "Public Hostname" apps require a domain you control as a Cloudflare DNS zone, and `*.streamlit.app` isn't one

---

## 5. Project File Structure

```
expense-tracker/
│
├── bot/
│   ├── main.py                  # Bot entry point, APScheduler wired here
│   ├── handlers.py              # Telegram message handlers (photo, doc, text, commands)
│   └── extractor.py             # Qwen VLM API calls + JSON parsing
│
├── db/
│   └── supabase.py              # All Supabase read/write operations
│
├── dashboard/
│   └── app.py                   # Streamlit dashboard (all charts + tables)
│
├── scheduler/
│   ├── weekly_report.py         # Scheduler trigger + Telegram send
│   ├── report_builder.py        # Supabase queries for weekly summary data
│   └── emailer.py               # Gmail SMTP HTML email sender
│
├── utils/
│   ├── constants.py             # Category list, currency list, account types
│   ├── pdf_converter.py         # pdf2image: converts PDF pages → JPEG for Qwen
│   └── formatters.py            # Shared number/date formatting helpers
│
├── .env                         # All secrets (never commit this)
├── .env.example                 # Template with all required keys, no values
├── .gitignore
├── requirements.txt
├── Procfile                     # For Railway: `worker: python -m bot.main`
└── README.md                    # This file
```

---

## 6. Database Schema

Run the following SQL in your Supabase SQL editor to set up all tables.

```sql
-- Accounts: your bank accounts, brokerages, wallets
CREATE TABLE accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,               -- "DBS Multiplier", "IBKR", "Maybank"
  type text NOT NULL,               -- 'bank' | 'brokerage' | 'ewallet'
  currency text NOT NULL,           -- 'SGD' | 'MYR' | 'USD'
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Transactions: all income and expenses
CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id),
  date date NOT NULL,
  description text,
  amount numeric NOT NULL,          -- negative = expense, positive = income
  category text,                    -- see constants.py for full list
  currency text NOT NULL,
  raw_text text,                    -- original Qwen output, for debugging
  source text,                      -- 'telegram_image' | 'telegram_pdf' | 'manual'
  created_at timestamptz DEFAULT now()
);

-- Portfolio events: buy / sell / dividend records
CREATE TABLE portfolio_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id),
  date date NOT NULL,
  ticker text NOT NULL,             -- 'CSPX', 'D05.SI', 'MAYBANK'
  action text NOT NULL,             -- 'BUY' | 'SELL' | 'DIVIDEND'
  quantity numeric,
  price numeric,
  currency text NOT NULL,
  fees numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Asset snapshots: total value per account at a point in time
-- Update this manually or via bot command after checking your portfolio
CREATE TABLE asset_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id),
  snapshot_date date NOT NULL,
  total_value numeric NOT NULL,
  currency text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_category ON transactions(category);
CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_portfolio_events_date ON portfolio_events(date);
CREATE INDEX idx_asset_snapshots_date ON asset_snapshots(snapshot_date);
```

**Seed your accounts first before doing anything else:**
```sql
INSERT INTO accounts (name, type, currency) VALUES
  ('DBS Multiplier', 'bank', 'SGD'),
  ('Maybank MY', 'bank', 'MYR'),
  ('IBKR', 'brokerage', 'USD'),
  ('moomoo SG', 'brokerage', 'SGD'),
  ('Cash', 'ewallet', 'SGD');
```

---

## 7. Environment Variables

Create a `.env` file at project root. Never commit this file.

```bash
# ── Telegram ─────────────────────────────────────────────
BOT_TOKEN=your_telegram_bot_token_here
YOUR_TELEGRAM_CHAT_ID=123456789          # your personal chat ID with the bot

# ── Gemini VLM ───────────────────────────────────────────
GEMINI_API_KEY=your_gemini_api_key_here

# ── Supabase ─────────────────────────────────────────────
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=your_anon_key          # for dashboard (read-only safe)
SUPABASE_SERVICE_KEY=your_service_key    # for bot (read + write, keep secret)

# ── Email (optional) ──────────────────────────────────────
GMAIL_USER=yourname@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx  # Gmail App Password, not your login password
NOTIFY_EMAIL=yourname@gmail.com

# ── Dashboard login ────────────────────────────────────────
DASHBOARD_EMAIL=yourname@gmail.com
DASHBOARD_PASSWORD=choose_a_password
```

`.env.example` (commit this):
```bash
BOT_TOKEN=
YOUR_TELEGRAM_CHAT_ID=
GEMINI_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
GMAIL_USER=
GMAIL_APP_PASSWORD=
NOTIFY_EMAIL=
DASHBOARD_EMAIL=
DASHBOARD_PASSWORD=
```

---

## 8. Step-by-Step Build Guide

### Phase 1 — Foundation

#### Step 1: Repo & dependencies

```bash
mkdir expense-tracker && cd expense-tracker
python -m venv venv && source venv/bin/activate
pip install python-telegram-bot[job-queue] google-genai supabase streamlit \
            plotly pandas python-dotenv APScheduler pdf2image Pillow pytz
pip freeze > requirements.txt
```

Create `.gitignore`:
```
.env
venv/
__pycache__/
*.pyc
.DS_Store
```

---

#### Step 2: Constants — define once, use everywhere

**`utils/constants.py`**
```python
CATEGORIES = [
    "Food & Drink",
    "Transport",
    "Shopping",
    "Groceries",
    "Entertainment",
    "Health",
    "Utilities",
    "Salary",
    "Investment",
    "Transfer",
    "Other",
]

CURRENCIES = ["SGD", "MYR", "USD"]

ACCOUNT_TYPES = ["bank", "brokerage", "ewallet"]

PORTFOLIO_ACTIONS = ["BUY", "SELL", "DIVIDEND"]
```

---

#### Step 3: Supabase client wrapper

**`db/supabase.py`**
```python
from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv()

def get_client(use_service_key=False):
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY") if use_service_key \
          else os.getenv("SUPABASE_ANON_KEY")
    return create_client(url, key)

def insert_transactions(rows: list[dict]):
    db = get_client(use_service_key=True)
    return db.table("transactions").insert(rows).execute()

def insert_portfolio_events(rows: list[dict]):
    db = get_client(use_service_key=True)
    return db.table("portfolio_events").insert(rows).execute()

def get_transactions(start_date: str, end_date: str):
    db = get_client()
    return (
        db.table("transactions")
        .select("*, accounts(name, currency)")
        .gte("date", start_date)
        .lte("date", end_date)
        .order("date", desc=True)
        .execute()
        .data
    )

def get_latest_snapshots():
    db = get_client()
    snapshots = (
        db.table("asset_snapshots")
        .select("*, accounts(name, currency)")
        .order("snapshot_date", desc=True)
        .limit(50)
        .execute()
        .data
    )
    seen = {}
    for s in snapshots:
        if s["account_id"] not in seen:
            seen[s["account_id"]] = s
    return list(seen.values())

def get_accounts():
    db = get_client()
    return db.table("accounts").select("*").eq("is_active", True).execute().data
```

---

### Phase 2 — Qwen Extraction

#### Step 4: PDF → image converter

**Update:** for born-digital bank statement PDFs (the common case — check if you can select/copy text in a PDF viewer), `utils/pdf_text.py` extracts the text layer directly via `pdfplumber` instead of rasterizing pages. This is cheaper (text tokens, not image tokens) and more accurate (no OCR step). `pdf2image`/`pdf_to_images` below is kept only as an unused fallback for scanned/image-only PDFs.

**`utils/pdf_converter.py`**
```python
from pdf2image import convert_from_bytes
import io

def pdf_to_images(pdf_bytes: bytes) -> list[bytes]:
    """Convert each page of a PDF to JPEG bytes for Qwen."""
    pages = convert_from_bytes(pdf_bytes, dpi=200)
    result = []
    for page in pages:
        buf = io.BytesIO()
        page.save(buf, format="JPEG")
        result.append(buf.getvalue())
    return result
```

---

#### Step 5: Gemini extractor — test this standalone first

**`bot/extractor.py`**
```python
import json
import os

from dotenv import load_dotenv
from google import genai
from google.genai import types

from utils.constants import CATEGORIES

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

MODEL = "gemini-3.5-flash"

SYSTEM_PROMPT = f"""
You are a financial document parser for a user based in Singapore.
Extract ALL transactions visible in the provided image.

Return ONLY a valid JSON object — no explanation, no markdown, no backticks.

Schema:
{{
  "document_type": "bank_statement" | "trade_screenshot" | "receipt" | "unknown",
  "account_hint": "string or null",
  "currency": "SGD" | "MYR" | "USD" | "other",
  "transactions": [
    {{
      "date": "YYYY-MM-DD",
      "description": "string",
      "amount": float,
      "category": one of {CATEGORIES},
      "confidence": float between 0 and 1
    }}
  ],
  "portfolio_events": [
    {{
      "ticker": "string",
      "action": "BUY" | "SELL" | "DIVIDEND",
      "quantity": float,
      "price": float,
      "currency": "string",
      "fees": float,
      "date": "YYYY-MM-DD"
    }}
  ]
}}

Rules:
- amount is NEGATIVE for expenses/debits, POSITIVE for income/credits
- portfolio_events is an empty list [] if no trades are present
- If date is not visible, use today's date
- confidence reflects how clearly you can read each field
"""

def extract_from_image(image_bytes: bytes, mime_type: str = "image/jpeg") -> dict:
    response = client.models.generate_content(
        model=MODEL,
        contents=[
            types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
            "Extract all transactions from this financial document.",
        ],
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            response_mime_type="application/json",
        ),
    )
    raw = response.text.strip()
    # Strip markdown fences defensively, even though response_mime_type is set
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


# ── Quick standalone test ──────────────────────────────────
# Run: python -m bot.extractor <path_to_image>
if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python -m bot.extractor <path_to_image>")
        sys.exit(1)
    path = sys.argv[1]
    mime = "image/png" if path.lower().endswith(".png") else "image/jpeg"
    with open(path, "rb") as f:
        result = extract_from_image(f.read(), mime_type=mime)
    print(json.dumps(result, indent=2))
```

**Test before wiring the bot:**
```bash
python -m bot.extractor /path/to/your/dbs_screenshot.jpg
```

---

### Phase 3 — Telegram Bot

#### Step 6: Handlers

**Update:** the real `bot/handlers.py` has since diverged from the skeleton below — PDFs go through `extract_from_text()` (text-layer extraction, one Gemini call per document) instead of looping `extract_from_image()` per rasterized page, and confirmation messages are sent via `send_confirmation()`/`chunk_lines()` rather than a single `reply_text()` call, since statements with 90+ rows exceed Telegram's 4096-char message limit. See the real file for the current version.

**`bot/handlers.py`**
```python
import os
from telegram import Update
from telegram.ext import ContextTypes
from bot.extractor import extract_from_image
from utils.pdf_converter import pdf_to_images
from db.supabase import insert_transactions, insert_portfolio_events, get_accounts

ALLOWED_USER_IDS = {int(os.getenv("YOUR_TELEGRAM_CHAT_ID"))}

# In-memory pending store: user_id → extracted data awaiting confirmation
pending = {}

def is_authorized(update: Update) -> bool:
    return update.effective_user.id in ALLOWED_USER_IDS

def format_confirmation(data: dict) -> str:
    lines = [f"📄 *{data['document_type']}* — {data.get('currency', '')}"]
    lines.append("")
    for i, t in enumerate(data.get("transactions", []), 1):
        flag = "⚠️" if t["confidence"] < 0.7 else "✅"
        sign = "+" if t["amount"] > 0 else ""
        lines.append(
            f"{flag} {i}. {t['date']} | {t['description']} | "
            f"{sign}{t['amount']:.2f} | _{t['category']}_"
        )
    for t in data.get("portfolio_events", []):
        lines.append(
            f"📈 {t['date']} | {t['action']} {t['quantity']} {t['ticker']} "
            f"@ {t['price']} {t['currency']}"
        )
    lines.append("")
    lines.append("Reply `confirm` to save, `cancel` to discard, or `edit 3` to fix a row.")
    return "\n".join(lines)

async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_authorized(update): return
    await update.message.reply_text("⏳ Extracting transactions...")
    photo = await update.message.photo[-1].get_file()
    image_bytes = await photo.download_as_bytearray()
    data = extract_from_image(bytes(image_bytes))
    pending[update.effective_user.id] = data
    await update.message.reply_text(
        format_confirmation(data), parse_mode="Markdown"
    )

async def handle_document(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_authorized(update): return
    doc = update.message.document
    file = await doc.get_file()
    file_bytes = await file.download_as_bytearray()

    await update.message.reply_text("⏳ Processing document...")

    if doc.mime_type == "application/pdf":
        pages = pdf_to_images(bytes(file_bytes))
        all_txns = []
        all_trades = []
        for page_bytes in pages:
            result = extract_from_image(page_bytes)
            all_txns.extend(result.get("transactions", []))
            all_trades.extend(result.get("portfolio_events", []))
        data = {
            "document_type": "bank_statement",
            "currency": result.get("currency", "SGD"),
            "transactions": all_txns,
            "portfolio_events": all_trades
        }
    else:
        data = extract_from_image(bytes(file_bytes))

    pending[update.effective_user.id] = data
    await update.message.reply_text(
        format_confirmation(data), parse_mode="Markdown"
    )

async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_authorized(update): return
    text = update.message.text.strip().lower()
    uid = update.effective_user.id

    if text == "confirm":
        data = pending.pop(uid, None)
        if not data:
            await update.message.reply_text("Nothing pending to confirm.")
            return
        accounts = get_accounts()
        default_account_id = accounts[0]["id"] if accounts else None

        txn_rows = [
            {
                "account_id": default_account_id,
                "date": t["date"],
                "description": t["description"],
                "amount": t["amount"],
                "category": t["category"],
                "currency": data.get("currency", "SGD"),
                "source": "telegram_image",
            }
            for t in data.get("transactions", [])
        ]
        trade_rows = [
            {
                "account_id": default_account_id,
                "date": t["date"],
                "ticker": t["ticker"],
                "action": t["action"],
                "quantity": t["quantity"],
                "price": t["price"],
                "currency": t["currency"],
                "fees": t.get("fees", 0),
            }
            for t in data.get("portfolio_events", [])
        ]
        if txn_rows:
            insert_transactions(txn_rows)
        if trade_rows:
            insert_portfolio_events(trade_rows)
        total = len(txn_rows) + len(trade_rows)
        await update.message.reply_text(f"✅ Saved {total} entries to database.")

    elif text == "cancel":
        pending.pop(uid, None)
        await update.message.reply_text("❌ Cancelled. Nothing was saved.")

    elif text.startswith("edit"):
        await update.message.reply_text(
            "To edit, resend the image with corrections, or manually fix in the dashboard."
        )
    else:
        await update.message.reply_text(
            "Send me a bank statement screenshot, trade screenshot, or PDF to get started."
        )
```

---

#### Step 7: Bot entry point

**`bot/main.py`**
```python
import os
import asyncio
from dotenv import load_dotenv
from telegram.ext import ApplicationBuilder, MessageHandler, filters
from bot.handlers import handle_photo, handle_document, handle_text
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from scheduler.weekly_report import send_weekly_report
import pytz

load_dotenv()

async def post_init(app):
    scheduler = AsyncIOScheduler(timezone=pytz.timezone("Asia/Singapore"))
    scheduler.add_job(
        send_weekly_report,
        trigger="cron",
        day_of_week="sun",
        hour=20,
        minute=0,
        args=[app.bot]
    )
    scheduler.start()
    print("✅ Scheduler started — weekly report every Sunday 8pm SGT")

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
    print("🤖 Bot is running...")
    app.run_polling()

if __name__ == "__main__":
    main()
```

---

### Phase 4 — Weekly Scheduler

#### Step 8: Report data builder

**`scheduler/report_builder.py`**
```python
from db.supabase import get_client
from datetime import date, timedelta

def get_weekly_data() -> dict:
    db = get_client()
    today = date.today()
    # Last full Mon–Sun window
    days_since_sunday = (today.weekday() + 1) % 7
    week_end = today - timedelta(days=days_since_sunday)
    week_start = week_end - timedelta(days=6)

    txns = (
        db.table("transactions")
        .select("*")
        .gte("date", week_start.isoformat())
        .lte("date", week_end.isoformat())
        .execute()
        .data
    )

    income = sum(t["amount"] for t in txns if t["amount"] > 0)
    expenses = abs(sum(t["amount"] for t in txns if t["amount"] < 0))
    net = income - expenses
    savings_rate = round((net / income * 100), 1) if income else 0

    by_category = {}
    for t in txns:
        if t["amount"] < 0:
            cat = t.get("category") or "Other"
            by_category[cat] = by_category.get(cat, 0) + abs(t["amount"])
    by_category = dict(sorted(by_category.items(), key=lambda x: x[1], reverse=True))

    snapshots = (
        db.table("asset_snapshots")
        .select("*, accounts(name, currency)")
        .order("snapshot_date", desc=True)
        .limit(50)
        .execute()
        .data
    )
    seen = {}
    for s in snapshots:
        if s["account_id"] not in seen:
            seen[s["account_id"]] = s
    latest_snapshots = list(seen.values())
    total_assets = sum(s["total_value"] for s in latest_snapshots)

    return {
        "week_start": week_start,
        "week_end": week_end,
        "income": income,
        "expenses": expenses,
        "net": net,
        "savings_rate": savings_rate,
        "by_category": by_category,
        "snapshots": latest_snapshots,
        "total_assets": total_assets,
    }
```

---

#### Step 9: Telegram weekly report sender

**`scheduler/weekly_report.py`**
```python
import os
from scheduler.report_builder import get_weekly_data
from scheduler.emailer import send_email

def format_telegram_message(data: dict) -> str:
    cat_lines = "\n".join(
        f"  {'📍' if i == 0 else '▪️'} {cat}: SGD {amt:,.2f}"
        for i, (cat, amt) in enumerate(data["by_category"].items())
    ) or "  No expenses this week 🎉"

    snapshot_lines = "\n".join(
        f"  ▪️ {s['accounts']['name']}: {s['accounts']['currency']} {s['total_value']:,.2f}"
        for s in data["snapshots"]
    ) or "  No snapshots found — update via bot"

    return f"""
📊 *Weekly Financial Update*
{data['week_start'].strftime('%d %b')} – {data['week_end'].strftime('%d %b %Y')}

💰 *Income & Expenses*
├ Income:    SGD {data['income']:,.2f}
├ Spent:     SGD {data['expenses']:,.2f}
├ Net:       SGD {data['net']:+,.2f}
└ Savings:   {data['savings_rate']}%

🧾 *Spend by Category*
{cat_lines}

🏦 *Portfolio Snapshot*
{snapshot_lines}
└ Total: SGD {data['total_assets']:,.2f}

_Next update: Sunday 8pm SGT_
""".strip()

async def send_weekly_report(bot):
    data = get_weekly_data()
    msg = format_telegram_message(data)
    await bot.send_message(
        chat_id=int(os.getenv("YOUR_TELEGRAM_CHAT_ID")),
        text=msg,
        parse_mode="Markdown"
    )
    try:
        send_email(data)
    except Exception as e:
        print(f"Email send failed: {e}")
    print("✅ Weekly report sent")
```

---

#### Step 10: Email sender

**`scheduler/emailer.py`**
```python
import smtplib
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

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
```

---

### Phase 5 — Dashboard

#### Step 11: Streamlit dashboard

The actual `dashboard/app.py` has since grown a `require_login()` gate (email/password against `DASHBOARD_EMAIL`/`DASHBOARD_PASSWORD`), a `sys.path` fix for running under Streamlit, and currency-converted Net Worth/Asset Allocation via `utils/fx.py` — see the real file for the current version. The sample below is the original Phase 5 skeleton before those additions.

**`dashboard/app.py`**
```python
import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import date, timedelta
from db.supabase import get_transactions, get_latest_snapshots, get_accounts

st.set_page_config(page_title="Finance Tracker", layout="wide")
st.title("💰 Personal Finance Dashboard")

# ── Sidebar ───────────────────────────────────────────────
with st.sidebar:
    st.header("Filters")
    end_date = st.date_input("End date", value=date.today())
    start_date = st.date_input("Start date", value=date.today() - timedelta(days=180))
    accounts = get_accounts()
    account_options = ["All"] + [a["name"] for a in accounts]
    selected_account = st.selectbox("Account", account_options)

# ── Load data ─────────────────────────────────────────────
txns = get_transactions(start_date.isoformat(), end_date.isoformat())
df = pd.DataFrame(txns)

if df.empty:
    st.info("No transactions found for this period. Start by sending a screenshot to your bot.")
    st.stop()

df["date"] = pd.to_datetime(df["date"])
df["month"] = df["date"].dt.to_period("M").astype(str)
df["account_name"] = df["accounts"].apply(lambda x: x["name"] if x else "Unknown")

if selected_account != "All":
    df = df[df["account_name"] == selected_account]

income_df = df[df["amount"] > 0]
expense_df = df[df["amount"] < 0].copy()
expense_df["amount"] = expense_df["amount"].abs()

# ── KPI Row ───────────────────────────────────────────────
snapshots = get_latest_snapshots()
total_assets = sum(s["total_value"] for s in snapshots)
monthly_income = income_df[income_df["month"] == date.today().strftime("%Y-%m")]["amount"].sum()
monthly_spend = expense_df[expense_df["month"] == date.today().strftime("%Y-%m")]["amount"].sum()
savings_rate = round((monthly_income - monthly_spend) / monthly_income * 100, 1) if monthly_income else 0

col1, col2, col3, col4 = st.columns(4)
col1.metric("Net Worth", f"SGD {total_assets:,.0f}")
col2.metric("Monthly Income", f"SGD {monthly_income:,.0f}")
col3.metric("Monthly Spend", f"SGD {monthly_spend:,.0f}")
col4.metric("Savings Rate", f"{savings_rate}%")

st.divider()

# ── Row 2: Net Worth + Monthly Spend ──────────────────────
col1, col2 = st.columns(2)

with col1:
    st.subheader("Net Worth Over Time")
    snap_df = pd.DataFrame(snapshots)
    if not snap_df.empty:
        snap_df["snapshot_date"] = pd.to_datetime(snap_df["snapshot_date"])
        monthly_snap = snap_df.groupby("snapshot_date")["total_value"].sum().reset_index()
        fig = px.line(monthly_snap, x="snapshot_date", y="total_value",
                      labels={"total_value": "SGD", "snapshot_date": "Date"})
        st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("No asset snapshots yet.")

with col2:
    st.subheader("Monthly Spend by Category")
    monthly_cat = expense_df.groupby(["month", "category"])["amount"].sum().reset_index()
    fig = px.bar(monthly_cat, x="month", y="amount", color="category",
                 labels={"amount": "SGD", "month": "Month"})
    st.plotly_chart(fig, use_container_width=True)

# ── Row 3: Income vs Spend + Savings Rate ─────────────────
col1, col2 = st.columns(2)

with col1:
    st.subheader("Income vs Spend Over Time")
    inc_monthly = income_df.groupby("month")["amount"].sum().reset_index()
    inc_monthly["type"] = "Income"
    exp_monthly = expense_df.groupby("month")["amount"].sum().reset_index()
    exp_monthly["type"] = "Spend"
    combined = pd.concat([inc_monthly, exp_monthly])
    fig = px.line(combined, x="month", y="amount", color="type",
                  labels={"amount": "SGD", "month": "Month"})
    st.plotly_chart(fig, use_container_width=True)

with col2:
    st.subheader("Savings Rate Over Time (%)")
    inc_m = income_df.groupby("month")["amount"].sum()
    exp_m = expense_df.groupby("month")["amount"].sum()
    rate_df = ((inc_m - exp_m) / inc_m * 100).reset_index()
    rate_df.columns = ["month", "savings_rate"]
    fig = px.line(rate_df, x="month", y="savings_rate",
                  labels={"savings_rate": "%", "month": "Month"})
    fig.add_hline(y=50, line_dash="dot", line_color="green",
                  annotation_text="50% target")
    st.plotly_chart(fig, use_container_width=True)

# ── Row 4: Donut Charts ───────────────────────────────────
col1, col2 = st.columns(2)

with col1:
    st.subheader("Spend by Category")
    cat_totals = expense_df.groupby("category")["amount"].sum().reset_index()
    fig = px.pie(cat_totals, names="category", values="amount", hole=0.4)
    st.plotly_chart(fig, use_container_width=True)

with col2:
    st.subheader("Asset Allocation")
    if snapshots:
        alloc = [
            {"region": s["accounts"]["name"], "value": s["total_value"]}
            for s in snapshots
        ]
        alloc_df = pd.DataFrame(alloc)
        fig = px.pie(alloc_df, names="region", values="value", hole=0.4)
        st.plotly_chart(fig, use_container_width=True)

st.divider()

# ── Row 5: Recent Transactions ────────────────────────────
st.subheader("Recent Transactions")
display_cols = ["date", "description", "amount", "category", "account_name"]
display_df = df[display_cols].sort_values("date", ascending=False)
st.dataframe(display_df, use_container_width=True, height=400)
```

---

## 9. Dashboard Spec

| Section | Chart Type | Data Source | Notes |
|---|---|---|---|
| Net Worth | KPI card | `asset_snapshots` latest | Sum across all accounts in SGD |
| Monthly Income | KPI card | `transactions` current month, amount > 0 | |
| Monthly Spend | KPI card | `transactions` current month, amount < 0 | |
| Savings Rate | KPI card | (Income − Spend) / Income | Current month |
| Net Worth Over Time | Line chart | `asset_snapshots` grouped by date | |
| Monthly Spend | Stacked bar | `transactions` grouped by month + category | |
| Income vs Spend | Dual line | `transactions` aggregated monthly | |
| Savings Rate % | Line chart | Derived from monthly income/spend | 50% target dashed line |
| Spend by Category | Donut | `transactions` for selected period | |
| Asset Allocation | Donut | `asset_snapshots` latest per account | |
| Transactions Table | Searchable table | `transactions` | Filter by category, account, date |

---

## 10. Weekly Report Spec

**Schedule:** Every Sunday at 8:00pm SGT

**Telegram message includes:**
- Week date range (Mon–Sun)
- Total income for the week
- Total spend for the week
- Net (income − spend)
- Savings rate %
- Spend broken down by category (sorted highest to lowest)
- Latest asset snapshot per account
- Total assets across all accounts

**Email (HTML) includes:**
- Same content as Telegram, formatted as clean HTML tables
- Subject: `💰 Weekly Update — w/e DD Mon YYYY`
- Sent to your `NOTIFY_EMAIL`

---

## 11. Deployment Guide

### Bot + Scheduler → Railway

1. Push repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add all env vars from `.env` in Railway dashboard → Variables (skip `DASHBOARD_EMAIL`/`DASHBOARD_PASSWORD` — those are dashboard-only)
4. Create `Procfile` at project root:
   ```
   worker: python -m bot.main
   ```
5. Create `nixpacks.toml` at project root so the Linux build includes poppler for `pdf2image`:
   ```toml
   [phases.setup]
   nixPkgs = ["poppler_utils"]
   ```
6. Railway detects `Procfile` and runs it — bot stays alive 24/7
7. Watch the deploy logs for a brief `telegram.error.Conflict` right after restart — that's expected (Telegram's old long-poll session taking a moment to time out) and clears on its own within ~30–60s. If it persists, check for a second instance polling the same `BOT_TOKEN` (e.g. a local `bot/main.py` still running).

### Dashboard → Streamlit Community Cloud

1. Go to [share.streamlit.io](https://share.streamlit.io) → New app
2. Connect your GitHub repo
3. Set main file path: `dashboard/app.py`
4. Add all env vars under Advanced settings → Secrets (TOML format):
   ```toml
   SUPABASE_URL = "..."
   SUPABASE_ANON_KEY = "..."
   DASHBOARD_EMAIL = "..."
   DASHBOARD_PASSWORD = "..."
   ```
5. Deploy — you get a `*.streamlit.app` URL

### Auth → built-in login form

No external service. `dashboard/app.py` gates the app behind a `require_login()` form that checks the submitted email/password against `DASHBOARD_EMAIL`/`DASHBOARD_PASSWORD`. This replaced an earlier Cloudflare Zero Trust Access plan — Cloudflare's Access "Public Hostname" apps require a domain you control as a Cloudflare DNS zone, which a `*.streamlit.app` URL isn't, so Cloudflare can't front it.

---

## 12. Build Order Checklist

Work through these in order. Each step is independently testable before moving on.

```
PHASE 1 — FOUNDATION
[ ] 1.  Create project folder, venv, install dependencies
[ ] 2.  Write utils/constants.py (categories, currencies)
[ ] 3.  Create Supabase project, run schema SQL, seed accounts table
[ ] 4.  Write db/supabase.py and test connection with a simple select

PHASE 2 — EXTRACTION
[ ] 5.  Write utils/pdf_converter.py
[ ] 6.  Write bot/extractor.py with SYSTEM_PROMPT
[ ] 7.  Test extractor standalone: python -m bot.extractor <image>
[ ] 8.  Verify JSON output matches schema, adjust prompt if needed

PHASE 3 — BOT
[ ] 9.  Write bot/handlers.py (photo, document, text handlers)
[ ] 10. Write bot/main.py with APScheduler wired in
[ ] 11. Run bot locally: python -m bot.main
[ ] 12. Send a test screenshot to bot, verify confirmation message
[ ] 13. Reply "confirm" and verify rows appear in Supabase

PHASE 4 — SCHEDULER
[ ] 14. Write scheduler/report_builder.py, test with python -c
[ ] 15. Write scheduler/weekly_report.py
[ ] 16. Write scheduler/emailer.py
[ ] 17. Trigger report manually to test: add a one-off job with run_date=now
[ ] 18. Verify Telegram message and email both arrive correctly

PHASE 5 — DASHBOARD
[ ] 19. Write dashboard/app.py
[ ] 20. Run locally: streamlit run dashboard/app.py
[ ] 21. Verify all 4 KPI cards show correct values
[ ] 22. Verify all 6 charts render with real data from Supabase

PHASE 6 — DEPLOY & SECURE
[ ] 23. Push to GitHub
[ ] 24. Deploy bot to Railway, set env vars, verify still running
[ ] 25. Deploy dashboard to Streamlit Community Cloud
[ ] 26. Set DASHBOARD_EMAIL/DASHBOARD_PASSWORD in Streamlit Cloud Secrets
[ ] 27. Confirm wrong credentials are rejected and correct credentials let you in
[ ] 28. Send one final test screenshot end-to-end in production

DONE ✅
```

---

*Built for personal use. Stack: python-telegram-bot · Gemini VLM · Supabase · Streamlit · APScheduler · Railway*