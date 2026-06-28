# CLAUDE.md — Personal Finance Tracker

## Project Overview

This is a personal finance tracker built for one user (me). It has four components:
1. A Telegram bot for data ingestion (images, PDFs, text)
2. Qwen VLM for extracting structured transaction data from screenshots/statements
3. A Supabase Postgres database as the single source of truth
4. A Streamlit dashboard for visualisation
5. An APScheduler job that sends weekly reports via Telegram and email

The bot and scheduler run together on Railway. The dashboard runs on Streamlit Community Cloud behind Cloudflare Access.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Bot framework | python-telegram-bot v20+ (async) |
| VLM extraction | Qwen VLM API (`qwen-vl-max`), OpenAI-compatible SDK |
| PDF handling | pdf2image (converts pages → JPEG before sending to Qwen) |
| Database | Supabase (Postgres) via `supabase-py` |
| Dashboard | Streamlit + Plotly |
| Scheduler | APScheduler (AsyncIOScheduler, runs in-process with bot) |
| Email | Gmail SMTP via smtplib |
| Hosting (bot) | Railway |
| Hosting (dashboard) | Streamlit Community Cloud |
| Auth | Cloudflare Zero Trust Access (email OTP in front of dashboard URL) |

---

## Project File Structure

```
expense-tracker/
├── bot/
│   ├── main.py              # Bot entry point + APScheduler wired here
│   ├── handlers.py          # Telegram handlers: photo, document, text
│   └── extractor.py         # Qwen VLM API calls + JSON parsing
├── db/
│   └── supabase.py          # All Supabase read/write functions
├── dashboard/
│   └── app.py               # Streamlit dashboard
├── scheduler/
│   ├── weekly_report.py     # Scheduler trigger + Telegram send
│   ├── report_builder.py    # Supabase queries for weekly summary
│   └── emailer.py           # Gmail HTML email sender
├── utils/
│   ├── constants.py         # CATEGORIES, CURRENCIES, ACCOUNT_TYPES
│   ├── pdf_converter.py     # pdf2image helper
│   └── formatters.py        # Shared number/date formatting
├── .env                     # All secrets — never commit
├── .env.example             # Template with keys but no values
├── requirements.txt
├── Procfile                 # Railway: `worker: python -m bot.main`
└── CLAUDE.md                # This file
```

---

## Database Schema

Four tables in Supabase. Always use these exact column names.

```
accounts          id, name, type, currency, is_active, created_at
transactions      id, account_id, date, description, amount, category, currency, raw_text, source, created_at
portfolio_events  id, account_id, date, ticker, action, quantity, price, currency, fees, created_at
asset_snapshots   id, account_id, snapshot_date, total_value, currency, notes, created_at
```

**Key conventions:**
- `amount` in `transactions` is **negative for expenses, positive for income**
- `action` in `portfolio_events` is one of: `BUY | SELL | DIVIDEND`
- `source` in `transactions` is one of: `telegram_image | telegram_pdf | manual`
- Always use `SUPABASE_SERVICE_KEY` for bot writes, `SUPABASE_ANON_KEY` for dashboard reads

---

## Environment Variables

All secrets are in `.env`. Reference them via `os.getenv()` with `load_dotenv()`.

```
BOT_TOKEN
YOUR_TELEGRAM_CHAT_ID
QWEN_API_KEY
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY
GMAIL_USER
GMAIL_APP_PASSWORD
NOTIFY_EMAIL
```

Never hardcode any of these. Never print them in logs.

---

## Categories

Always use this exact list for the `category` field in transactions and in the Qwen extraction prompt. Defined in `utils/constants.py`:

```python
CATEGORIES = [
    "Food & Drink", "Transport", "Shopping", "Groceries",
    "Entertainment", "Health", "Utilities", "Salary",
    "Investment", "Transfer", "Other"
]
```

---

## Qwen VLM Extraction

- Model: `qwen-vl-max`
- Base URL: `https://dashscope.aliyuncs.com/compatible-mode/v1`
- Use the `openai` Python SDK (Qwen is OpenAI-compatible)
- Always send images as base64: `data:image/jpeg;base64,<b64>`
- For PDFs: convert each page to JPEG via `utils/pdf_converter.py` first, then send each page separately
- The system prompt instructs Qwen to return **only valid JSON**, no markdown, no explanation
- Always strip markdown fences from the response before `json.loads()`
- Store the raw Qwen response text in `transactions.raw_text` for every insert

**Expected Qwen output schema:**
```json
{
  "document_type": "bank_statement | trade_screenshot | receipt | unknown",
  "account_hint": "string or null",
  "currency": "SGD | MYR | USD | other",
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "string",
      "amount": -12.40,
      "category": "Food & Drink",
      "confidence": 0.95
    }
  ],
  "portfolio_events": [
    {
      "ticker": "CSPX",
      "action": "BUY",
      "quantity": 10,
      "price": 500.00,
      "currency": "USD",
      "fees": 1.50,
      "date": "2026-06-27"
    }
  ]
}
```

---

## Telegram Bot Behaviour

- **Only one user is allowed**: check `update.effective_user.id` against `YOUR_TELEGRAM_CHAT_ID` at the top of every handler. Silently return if not authorised.
- **Never auto-commit to DB** — always show a confirmation message first
- Pending extractions are stored in a dict keyed by user ID: `pending = {}`
- Confirmation flow: bot shows extracted rows → user replies `confirm`, `cancel`, or `edit <n>`
- Flag rows with `confidence < 0.7` with a ⚠️ in the confirmation message
- After `confirm`: write to Supabase, clear from `pending`, reply with count of saved entries
- After `cancel`: clear from `pending`, reply with cancellation message
- Handlers: `handle_photo`, `handle_document`, `handle_text` in `bot/handlers.py`

---

## Scheduler

- Uses `APScheduler` `AsyncIOScheduler` with `Asia/Singapore` timezone
- Wired into bot in `bot/main.py` via `post_init` hook — runs in the same process
- Schedule: `cron`, `day_of_week="sun"`, `hour=20`, `minute=0`
- Queries the previous Mon–Sun window from Supabase
- Sends Telegram message first, then email (email failure should not crash the job — wrap in try/except)
- Weekly report includes: income, expenses, net, savings rate, spend by category (sorted desc), latest snapshot per account, total assets

---

## Dashboard

File: `dashboard/app.py`. Runs with `streamlit run dashboard/app.py`.

**Layout (in order):**
1. Sidebar: date range picker, account filter
2. KPI row: Net Worth, Monthly Income, Monthly Spend, Savings Rate
3. Line chart: Net Worth Over Time (from `asset_snapshots`)
4. Stacked bar chart: Monthly Spend by Category
5. Dual line chart: Monthly Income vs Monthly Spend
6. Line chart: Savings Rate (%) over time — with 50% dashed target line
7. Donut chart: Spend by Category (selected period)
8. Donut chart: Asset Allocation by Account
9. Transactions table: sortable, all columns

Use Plotly for all charts (`plotly.express`). Use `st.columns()` for side-by-side layout. Use `st.divider()` between sections.

---

## Coding Conventions

- All async functions for bot handlers (required by python-telegram-bot v20+)
- Use `load_dotenv()` at the top of every entry-point file
- All Supabase operations go in `db/supabase.py` — never query Supabase inline in handlers or dashboard
- All formatting helpers (currency, date strings) go in `utils/formatters.py`
- No f-string SQL — all queries go through the Supabase Python client
- Use type hints where practical
- Do not use global state outside of the `pending` dict in `handlers.py`

---

## What NOT to Do

- Do not auto-insert to Supabase without user confirmation via Telegram
- Do not expose `SUPABASE_SERVICE_KEY` in dashboard code — dashboard uses `SUPABASE_ANON_KEY` only
- Do not use synchronous Telegram bot patterns (use async throughout)
- Do not put business logic in `bot/main.py` — keep it as a thin entry point only
- Do not add a login screen to the Streamlit app — auth is handled entirely by Cloudflare Access at the network level
- Do not change the `amount` sign convention — negative = expense is used throughout the codebase and dashboard logic depends on it

---

## Common Tasks

**Add a new expense category:**
→ Update `CATEGORIES` in `utils/constants.py` only. The extraction prompt imports from there.

**Test Qwen extraction without running the bot:**
```bash
python -m bot.extractor /path/to/screenshot.jpg
```

**Trigger the weekly report manually for testing:**
```python
# In a scratch script
import asyncio
from scheduler.weekly_report import send_weekly_report
from telegram import Bot
import os
bot = Bot(token=os.getenv("BOT_TOKEN"))
asyncio.run(send_weekly_report(bot))
```

**Add a new Supabase query:**
→ Add a function to `db/supabase.py`. Import it where needed. Never write inline Supabase calls.

**Add a new chart to the dashboard:**
→ Add after the existing sections in `dashboard/app.py`. Use `plotly.express`. Follow the existing column layout pattern.