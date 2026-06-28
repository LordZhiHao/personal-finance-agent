# Personal Finance Tracker

A Telegram-first personal finance tracker that uses Qwen VLM to extract transactions from screenshots, PDFs, and text, stores data in Supabase, and visualises results in a Streamlit dashboard.

## What it does

- Accepts financial screenshots, PDFs, and manual text via Telegram
- Uses `qwen-vl-max` to extract transaction and portfolio event data
- Stores structured data in Supabase with confirmation before saving
- Provides a Streamlit dashboard for net worth, spending, and income analytics
- Sends weekly reports via Telegram and email

## Key components

- `bot/` — Telegram bot entry point, handlers, and extraction logic
- `db/` — Supabase read/write operations
- `dashboard/` — Streamlit app for visualisation
- `scheduler/` — Weekly report scheduler and email sender
- `utils/` — Shared constants, PDF conversion, and formatting helpers

## Why it matters

- Eliminates manual data entry by using messaging and image/PDF extraction
- Keeps all data in your own Supabase instance
- Requires explicit user confirmation before any database write
- Designed for private, one-user use with infrastructure-level access control

## Quick start

1. Copy `.env.example` to `.env`
2. Add your Telegram bot token, Qwen API key, Supabase credentials, and email settings
3. Run the bot via `python -m bot.main`
4. Deploy the dashboard at `dashboard/app.py` with Streamlit

## Notes

- The full build and deployment guide is documented in `CLAUDE.md` and `INSTRUCTIONS.md`
- Do not commit `.env` or secret keys
cd 'c:\Users\Jason\Desktop\personal-finance-agent'; Get-Content README.md -Raw | Out-String
cd 'c:\Users\Jason\Desktop\personal-finance-agent'; @'
# Personal Finance Tracker

A Telegram-first personal finance tracker that uses Qwen VLM to extract transactions from screenshots, PDFs, and text, stores data in Supabase, and visualises results in a Streamlit dashboard.

## What it does

- Accepts financial screenshots, PDFs, and manual text via Telegram
- Uses `qwen-vl-max` to extract transaction and portfolio event data
- Stores structured data in Supabase with confirmation before saving
- Provides a Streamlit dashboard for net worth, spending, and income analytics
- Sends weekly reports via Telegram and email

## Key components

- `bot/` — Telegram bot entry point, handlers, and extraction logic
- `db/` — Supabase read/write operations
- `dashboard/` — Streamlit app for visualisation
- `scheduler/` — Weekly report scheduler and email sender
- `utils/` — Shared constants, PDF conversion, and formatting helpers

## Why it matters

- Eliminates manual data entry by using messaging and image/PDF extraction
- Keeps all data in your own Supabase instance
- Requires explicit user confirmation before any database write
- Designed for private, one-user use with infrastructure-level access control

## Quick start

1. Copy `.env.example` to `.env`
2. Add your Telegram bot token, Qwen API key, Supabase credentials, and email settings
3. Run the bot via `python -m bot.main`
4. Deploy the dashboard at `dashboard/app.py` with Streamlit

## Notes

- The full build and deployment guide is documented in `CLAUDE.md` and `INSTRUCTIONS.md`
- Do not commit `.env` or secret keys
