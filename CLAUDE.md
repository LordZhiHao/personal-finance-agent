# CLAUDE.md — Personal Finance Tracker

## Project Overview

This is a personal finance tracker built for one user (me). It has these components:
1. A Telegram bot for data ingestion (images, PDFs, text)
2. Gemini VLM for extracting structured transaction data from screenshots/statements
3. A Supabase Postgres database as the single source of truth
4. A FastAPI backend (`backend/`) exposing that data over a JSON API with JWT auth
5. A React dashboard (`frontend/`) for visualisation — the primary web UI, replacing the legacy Streamlit dashboard (`dashboard/`, kept until the React app is confirmed as a full replacement, then removed)
6. An APScheduler job that sends weekly reports via Telegram and email

The bot and scheduler run together on Railway. The backend (`backend/`) runs as a second Railway service in the same project (`web: python -m uvicorn backend.main:app ...` in the `Procfile`). The React frontend is deployed on Vercel and talks only to the backend API — it never touches Supabase directly. The legacy Streamlit dashboard, while still present, runs on Streamlit Community Cloud behind a simple email/password login form built into the Streamlit app itself.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Bot framework | python-telegram-bot v20+ (async) |
| VLM extraction | Gemini API (`gemini-3.5-flash`), `google-genai` SDK |
| PDF handling | `pdf2image` (+ poppler) rasterizes each PDF page to JPEG (`utils/pdf_converter.py`); each page is sent through the same Gemini image-extraction call as photos and the results are merged (`extract_from_pdf_images` in `bot/extractor.py`). `pdfplumber` is listed in `requirements.txt` but is not currently wired into any code path |
| Database | Supabase (Postgres) via `supabase-py` |
| Equity prices | `yfinance`, polled hourly by APScheduler |
| Backend API | FastAPI (`backend/`), wraps `db/supabase.py` + `utils/` — the only thing that talks to Supabase for the React frontend |
| Frontend | React + TypeScript (Vite SPA), Tailwind CSS, TanStack Query, Recharts, react-router-dom, react-hook-form + zod (`frontend/`) |
| Dashboard (legacy) | Streamlit + Plotly (`dashboard/`) — being replaced by `frontend/` |
| Scheduler | APScheduler (AsyncIOScheduler, runs in-process with bot) |
| Email | Gmail SMTP via smtplib |
| Hosting (bot + backend) | Railway (two services in one project: `worker` = bot, `web` = backend API) |
| Hosting (frontend) | Vercel |
| Hosting (dashboard, legacy) | Streamlit Community Cloud |
| Auth (backend/frontend) | `POST /api/auth/login` in `backend/routers/auth_routes.py` checks email/password against env vars and issues a JWT (`backend/auth.py`); frontend sends it as `Authorization: Bearer <token>` |
| Auth (legacy dashboard) | Email/password login form inside `dashboard/app.py`, checked against env vars, session-only (no token) |

---

## Project File Structure

```
expense-tracker/
├── bot/
│   ├── main.py              # Bot entry point + APScheduler wired here
│   ├── handlers.py          # Telegram handlers: photo, document, text
│   └── extractor.py         # Gemini API calls (image + text) + JSON parsing
├── db/
│   └── supabase.py          # All Supabase read/write functions
├── backend/                 # FastAPI API — the only thing frontend/ talks to
│   ├── main.py               # FastAPI app, CORS, router registration — thin, like bot/main.py
│   ├── config.py              # env var loading (JWT_SECRET, CORS_ALLOWED_ORIGIN, ...)
│   ├── auth.py                 # create_access_token / get_current_user (JWT, PyJWT)
│   ├── schemas.py                # Pydantic request models (login, transaction update, portfolio event)
│   └── routers/
│       ├── auth_routes.py         # POST /api/auth/login
│       ├── meta.py                 # GET /api/meta — CATEGORIES/CURRENCIES/etc. from utils/constants.py
│       ├── spending.py               # GET/PATCH /api/transactions, GET /api/transactions/summary
│       ├── investments.py             # GET/POST /api/portfolio-events, GET /api/snapshots, GET /api/holdings
│       └── accounts.py                 # GET /api/accounts, GET /api/accounts/balances
├── frontend/                 # React SPA (Vite + TS) — deployed to Vercel
│   └── src/
│       ├── api/client.ts       # fetch wrapper: attaches JWT, base URL from VITE_API_URL
│       ├── auth/                # AuthContext, LoginPage, ProtectedRoute
│       ├── hooks/api.ts          # useQuery hooks per backend endpoint
│       ├── pages/                  # SpendingPage, InvestmentsPage, PortfolioPage, BalancesPage
│       ├── components/               # FilterBar, TransactionsTable, AddTradeDialog, Layout, charts/
│       └── lib/                        # format.ts, dates.ts (month/heatmap aggregation), palette.ts
├── dashboard/                # Legacy Streamlit dashboard — being replaced by frontend/, kept until confirmed redundant
│   ├── app.py               # Thin entrypoint: login gate + st.navigation between pages
│   ├── auth.py              # require_login()
│   ├── components/
│   │   └── filters.py       # Sidebar filter form shared by both pages (Apply-button pattern)
│   └── views/                       # NOT named "pages" — that name triggers Streamlit's
│       ├── spending.py              # legacy auto-page-discovery, which conflicts with the
│       └── investments.py           # explicit st.Page/st.navigation calls in app.py
├── scheduler/
│   ├── weekly_report.py     # Scheduler trigger + Telegram send
│   ├── report_builder.py    # Supabase queries for weekly summary + summarize_transactions()
│   ├── emailer.py           # Gmail HTML email sender
│   └── equity_price_updater.py  # Hourly yfinance price pull + asset_snapshots refresh
├── utils/
│   ├── constants.py         # CATEGORIES, CURRENCIES, ACCOUNT_TYPES, TICKER_YFINANCE_MAP
│   ├── pdf_converter.py     # pdf2image: rasterizes PDF pages to JPEG for Gemini (PDF default path, see extract_from_pdf_images in bot/extractor.py)
│   ├── fx.py                # Currency conversion via Frankfurter API
│   ├── equity_pricing.py    # yfinance price lookups
│   ├── portfolio.py         # Holdings + average-cost basis + unrealized gain/loss (for /portfolio, GET /api/holdings)
│   ├── balances.py          # compute_account_balances(): unified cash+brokerage balance per account (for /balance, GET /api/accounts/balances)
│   ├── period.py            # parse_period(): day|week|month|year -> trailing date window
│   └── formatters.py        # Shared number/date formatting (format_money, format_pct)
├── .env                     # All secrets — never commit
├── .env.example             # Template with keys but no values
├── requirements.txt          # Shared by bot, scheduler, backend, and the legacy dashboard
├── Procfile                 # Railway: `worker: python -m bot.main` + `web: python -m uvicorn backend.main:app ...`
└── CLAUDE.md                # This file
```

---

## Database Schema

Five tables in Supabase. Always use these exact column names.

```
accounts          id, name, type, currency, is_active, created_at
transactions      id, account_id, date, description, amount, category, currency, raw_text, source, created_at
portfolio_events  id, account_id, date, ticker, action, quantity, price, currency, fees, created_at
asset_snapshots   id, account_id, snapshot_date, total_value, currency, notes, created_at
equity_prices     id, ticker, price, currency, fetched_at, created_at
```

**Key conventions:**
- `amount` in `transactions` is **negative for expenses, positive for income**
- `action` in `portfolio_events` is one of: `BUY | SELL | DIVIDEND`
- `source` in `transactions` is one of: `telegram_image | telegram_pdf | telegram_text | manual`
- Always use `SUPABASE_SERVICE_KEY` for bot writes, `SUPABASE_ANON_KEY` for dashboard reads. Exceptions: `db.dashboard_insert_portfolio_event()` (investments page "Add Entry" dialog, and `backend/routers/investments.py`'s `POST /api/portfolio-events`) and `db.update_transaction()` (spending page's editable transactions table, and `backend/routers/spending.py`'s `PATCH /api/transactions/{id}`) both use `SUPABASE_SERVICE_KEY` — the anon key has no INSERT/UPDATE grant via RLS on `portfolio_events`/`transactions`, and adding those grants was judged a bigger surface change than reusing the service key for these single, already-login-gated write paths. The browser never holds a Supabase key at all — `backend/` is the only thing that calls `db/supabase.py`, so `SUPABASE_SERVICE_KEY` stays server-side by construction for the React frontend
- `asset_snapshots` has a unique constraint on `(account_id, snapshot_date)` — required for the hourly equity price job to upsert rather than duplicate a snapshot per run. `ticker` in `equity_prices` stores the Yahoo Finance symbol (post-`TICKER_YFINANCE_MAP` lookup), not the raw broker ticker

---

## Environment Variables

All secrets are in `.env`. Reference them via `os.getenv()` with `load_dotenv()`.

```
BOT_TOKEN
YOUR_TELEGRAM_CHAT_ID
GEMINI_API_KEY
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY
GMAIL_USER
GMAIL_APP_PASSWORD
NOTIFY_EMAIL
DASHBOARD_EMAIL
DASHBOARD_PASSWORD
JWT_SECRET
CORS_ALLOWED_ORIGIN
```

`JWT_SECRET` and `CORS_ALLOWED_ORIGIN` (comma-separated allowed frontend origins) are used only by `backend/`. The React frontend has its own env var, set in `frontend/.env.local` / Vercel project settings, not `.env`: `VITE_API_URL` — the backend's base URL.

Never hardcode any of these. Never print them in logs.

---

## Categories

Always use this exact list for the `category` field in transactions and in the Gemini extraction prompt. Defined in `utils/constants.py`:

```python
CATEGORIES = [
    "Food & Drink", "Transport", "Shopping", "Groceries",
    "Entertainment", "Health", "Utilities", "Salary",
    "Investment", "Transfer", "Other"
]
```

---

## Gemini Extraction

- Model: `gemini-3.5-flash`
- Use the `google-genai` SDK (`google.genai.Client`), not the OpenAI SDK
- `bot/extractor.py` has three entry points sharing one `SYSTEM_PROMPT`/JSON schema:
  - `extract_from_image(image_bytes, mime_type)` — for `handle_photo`, non-PDF documents, and each rasterized PDF page (see `extract_from_pdf_images` below). Images are sent via `types.Part.from_bytes(data=image_bytes, mime_type=...)`, not base64 data URLs.
  - `extract_from_pdf_images(pdf_bytes)` — for PDFs in `handle_document`. `utils/pdf_converter.py` (`pdf2image`, requires poppler) rasterizes each page to a JPEG; each page is run through `extract_from_image()` individually and the resulting `transactions`/`portfolio_events` lists are concatenated, with `document_type`/`account_hint`/`currency` taken from the first page that reports them. An N-page PDF means N separate Gemini image calls, not one text call.
  - `extract_from_text(text)` — for free-typed Telegram messages only (`handle_text`'s fallback branch, e.g. "Spent 0.5+3.5 on meals today"). The call is always prefixed with the actual current date (`date.today()`) so Gemini can resolve relative dates like "today"/"yesterday" — the model has no other way to know the real date.
- The system prompt instructs Gemini to return **only valid JSON**, no markdown, no explanation; for short natural-language input it's told to evaluate arithmetic in the amount (e.g. `0.5+3.5` → `4.00`) and set `confidence: 1.0` since the user typed it themselves
- `response_mime_type="application/json"` is set in `GenerateContentConfig`, but still strip markdown fences defensively, and parse with `json.JSONDecoder().raw_decode()` rather than `json.loads()` — Gemini occasionally appends trailing content after the JSON object on very large outputs (e.g. consolidated statements with 90+ transactions), and `raw_decode` recovers the first valid JSON value instead of erroring on `Extra data`
- Store the raw Gemini response text in `transactions.raw_text` for every insert

**Expected Gemini output schema:**
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
- **Confirmation messages are chunked**: `send_confirmation()` splits the row list across multiple Telegram messages via `chunk_lines()`, staying under Telegram's 4096-char limit per message (headroom of 4000). Required once PDF statements with 90+ transactions became routine — a single message would silently fail to send (`Message is too long`). Splits happen on line boundaries so each line's Markdown formatting stays self-contained per chunk.
- `source` on each transaction row is set per-handler (`telegram_image` / `telegram_pdf` / `telegram_text`), not hardcoded — read from `data["source"]` when building rows in the `confirm` branch of `handle_text`.
- **Free-text expense entry**: any message in `handle_text` that isn't `confirm`/`cancel`/`edit <n>` falls through to `extract_from_text(raw_text)` (e.g. "Spent 0.5+3.5 on meals today") and joins the same pending/confirmation flow as photos and PDFs — no separate code path, no auto-commit. `raw_text` (original casing) is passed to Gemini, not the lowercased `text` used for command matching, so descriptions keep their natural casing. If Gemini returns no transactions and no portfolio_events (e.g. the message wasn't actually about a transaction), the bot replies with a hint instead of opening a confirmation with nothing in it. Saved rows get `source="telegram_text"`.

---

## Telegram Commands

Registered via `CommandHandler` in `bot/main.py`, all implemented as `handle_*_command` functions in `bot/handlers.py`. Every command checks `is_authorized()` first, same as the media/text handlers. All money figures are reported in `DEFAULT_CURRENCY` (`"SGD"`) — like the weekly report, amounts are summed/displayed without per-transaction currency conversion (a pre-existing simplification; only `/assets`, `/balance`, and `/portfolio` convert, since those read from already-currency-tagged snapshots/prices via `utils/fx.convert`).

- **`/expense [day|week|month|year]`** — `utils/period.py` (`parse_period`) resolves the arg to a trailing window ending today (default `week`); queries `get_transactions` for that range and reuses `scheduler/report_builder.summarize_transactions()` (extracted from `get_weekly_data` so the weekly cron report and this command share one aggregation, not two copies) for income/expenses/net/savings rate/by-category.
- **`/portfolio`** — `utils/portfolio.py` (`compute_holdings_summary`) computes per-ticker **average-cost basis** from full `portfolio_events` history (BUYs roll a running weighted average; SELLs reduce quantity without changing the average — standard average-cost method, not FIFO), prices each holding from the latest `equity_prices` row per ticker, and reports unrealized gain/loss. A ticker with no price available is shown with a ⚠️ rather than silently dropped.
- **`/assets`** — sums the latest `asset_snapshots` per account (reuses `get_latest_snapshots`), converted to `DEFAULT_CURRENCY`.
- **`/balance [account]`** — no arg lists every account; an arg does a case-insensitive substring match on account name. Delegates the actual balance computation to `utils/balances.py::compute_account_balances()`, shared with `GET /api/accounts/balances`. **Balance differs by account type**: `bank`/`ewallet` sum `transactions.amount` for that account (`get_account_cash_totals`); `brokerage` uses the latest `asset_snapshots` market value instead, since brokerage cash flow isn't tracked separately from invested value anywhere in this codebase.
- **`/recent [n]`** — last *n* transactions by `created_at` (default 10, capped at 30 to stay within a couple of chunked messages).
- **`/undo`** — reverts the most recently confirmed `confirm` batch only (one level, not a history). The `confirm` branch of `handle_text` now captures the inserted row IDs (Supabase insert returns generated rows) into a second in-memory dict, `last_saved = {}` (keyed by user ID, same pattern as `pending`), and `/undo` deletes exactly those rows via `delete_transactions`/`delete_portfolio_events`.
- **`/help`** — static list of the above.

---

## Scheduler

- Uses `APScheduler` `AsyncIOScheduler` with `Asia/Singapore` timezone
- Wired into bot in `bot/main.py` via `post_init` hook — runs in the same process
- Schedule: `cron`, `day_of_week="sun"`, `hour=20`, `minute=0`
- Queries the previous Mon–Sun window from Supabase
- Sends Telegram message first, then email (email failure should not crash the job — wrap in try/except)
- Weekly report includes: income, expenses, net, savings rate, spend by category (sorted desc), latest snapshot per account, total assets

---

## Equity Price Updates

- `scheduler/equity_price_updater.py` (`update_equity_prices`) runs hourly via APScheduler `interval` trigger (wired in `bot/main.py` `post_init`, alongside the weekly report job)
- Held tickers are derived from `portfolio_events`, not a manual watchlist: `db.get_held_positions()` nets `BUY` minus `SELL` quantity per `(account_id, ticker)`, excluding positions fully sold off
- Raw tickers (as extracted by Gemini, e.g. `"CSPX"`) are mapped to Yahoo Finance symbols via `TICKER_YFINANCE_MAP` in `utils/constants.py` before calling `yfinance` — needed for non-US listings (SGX → `.SI`, Bursa Malaysia → `.KL`, LSE → `.L`). Add new entries there as new exchanges/tickers are traded; tickers with no mapping fall through unchanged (assumes a plain US listing)
- `utils/equity_pricing.py` (`fetch_prices`) calls `yfinance` and corrects for LSE listings being quoted in GBX/pence (`currency == "GBp"`) — divides by 100 and reports `GBP`
- Every fetch is recorded as a row in `equity_prices` (price history), then holdings are revalued (`quantity × price`, converted to the account's currency via `utils/fx.convert`) and **upserted into `asset_snapshots`** for that account/day via `db.upsert_asset_snapshot()` — this means brokerage accounts with tracked tickers no longer need a manual snapshot; manual snapshots are still expected for accounts holding assets `yfinance` can't price
- If a ticker has no price (`yfinance` lookup failed or unmapped), it's logged and excluded from that account's snapshot total for the run rather than blocking the whole job

---

## Backend API

Entrypoint: `backend/main.py`, run with `python -m uvicorn backend.main:app --reload` locally (`--host 0.0.0.0 --port $PORT` in production). Interactive docs at `/docs`. Every route except `/health` and `POST /api/auth/login` requires `Authorization: Bearer <token>`, enforced via the `get_current_user` FastAPI dependency (`backend/auth.py`) — there's a single shared user, same as the bot/dashboard, so this just validates the JWT rather than looking up a per-user account.

**Auth:** `POST /api/auth/login` checks the submitted email/password against `DASHBOARD_EMAIL`/`DASHBOARD_PASSWORD` (same env vars the legacy dashboard uses) and returns a JWT signed with `JWT_SECRET`, 7-day expiry. No refresh flow — the frontend just re-shows the login form once a request 401s (see `frontend/src/api/client.ts`).

**Routers** (`backend/routers/`), all thin wrappers around `db/supabase.py` / `utils/` — no business logic lives in the routers themselves:
- `meta.py` — `GET /api/meta` returns `CATEGORIES`/`CURRENCIES`/`ACCOUNT_TYPES`/`PORTFOLIO_ACTIONS` from `utils/constants.py`, so the frontend never hardcodes its own copy of these lists.
- `spending.py` — `GET /api/transactions`, `GET /api/transactions/summary` (wraps `scheduler/report_builder.summarize_transactions()`), `PATCH /api/transactions/{id}` (category/description only, same restriction as the dashboard's editable table).
- `investments.py` — `GET /api/snapshots` (adds a `converted_value` field per row via `utils/fx.convert`, since the frontend has no FX calls of its own — pass `?currency=`), `GET`/`POST /api/portfolio-events`, `GET /api/holdings` (wraps `utils/portfolio.py::compute_holdings_summary()` — the `/portfolio` bot command's math, first surfaced outside Telegram here).
- `accounts.py` — `GET /api/accounts` (optional `?type=` comma-separated filter), `GET /api/accounts/balances` (wraps `utils/balances.py::compute_account_balances()` — the `/balance` bot command's math).

Add a new endpoint by adding a route to the relevant router (or a new router registered in `main.py`) that calls an existing `db/supabase.py` / `utils/` function — don't duplicate query logic that already exists for the bot.

---

## Frontend (React)

`frontend/` — Vite + React + TypeScript SPA, deployed to Vercel. Run locally with `npm run dev` (from `frontend/`); needs `VITE_API_URL` pointing at a running `backend/` (see `frontend/.env.example`).

- **Auth:** `src/auth/AuthContext.tsx` holds the JWT (persisted in `localStorage`), `ProtectedRoute` renders `LoginPage` when unauthenticated. `src/api/client.ts` attaches the token to every request and clears it on a 401.
- **Data fetching:** TanStack Query hooks in `src/hooks/api.ts`, one per backend endpoint. Filters are **live** (no Streamlit-style "Apply" button — that pattern existed only to limit Streamlit reruns, which don't apply here).
- **Pages** (`src/pages/`): `SpendingPage` and `InvestmentsPage` mirror the legacy Streamlit pages' charts; `PortfolioPage` (holdings/avg-cost/unrealized P&L) and `BalancesPage` (unified cash+brokerage balances) are new — they surface `/api/holdings` and `/api/accounts/balances`, which the Streamlit dashboard never called even though the underlying bot commands (`/portfolio`, `/balance`) already existed.
- **Charts** (`src/components/charts/`): Recharts, colored via `src/lib/palette.ts`'s fixed categorical order (`CATEGORICAL`) — category colors specifically go through `colorForCategory()`, which maps the 8 expense-relevant categories (`EXPENSE_CATEGORY_COLOR_ORDER`) to the 8 validated hues and folds everything else (income-only categories, "Other") to a neutral rather than wrapping/reusing a hue — a wrapped 9th+ category previously collided with an earlier one (e.g. "Transfer" and "Transport" rendered identically). Two chart-only additions beyond the Streamlit set: `SpendingHeatmap` (daily spend calendar) and `MonthComparisonBarChart` (this month vs previous vs same month last year per category), both pure client-side aggregations over already-fetched transactions (`src/lib/dates.ts`) — no dedicated backend endpoint.
- **Writes:** `TransactionsTable` (category/description edits) and `AddTradeDialog` (new portfolio events, react-hook-form + zod, same validation rules as the Streamlit dialog: ticker required, quantity > 0, price > 0 unless `DIVIDEND`) both call the backend then invalidate the relevant TanStack Query key to refetch. `AddTradeDialog` is only mounted while its dialog is open (not kept alive and hidden) — mounting fresh each open avoids react-hook-form's `defaultValues` (e.g. the default selected account) going stale from an earlier render where the accounts list hadn't loaded yet.

---

## Dashboard (legacy Streamlit)

Being replaced by `frontend/` — kept until the React app is confirmed as a full replacement, then this section and `dashboard/` will be removed. Do not add new functionality here; add it to `frontend/`/`backend/` instead.

Entrypoint: `dashboard/app.py`. Runs with `streamlit run dashboard/app.py`. Multipage via `st.navigation`/`st.Page` (Streamlit 1.36+) — `app.py` itself only does the login gate and declares the two pages; it has no charts or queries of its own.

**Auth:** Gated by `require_login()` in `dashboard/auth.py`, called once at the top of `app.py` before `st.navigation(...).run()` — since every page switch reruns `app.py` from the top, this single check protects every page without each page needing its own login call. The form compares submitted email/password against `DASHBOARD_EMAIL`/`DASHBOARD_PASSWORD` env vars, using `st.session_state` to persist the authenticated flag for the session. This replaced an earlier Cloudflare Access plan: Cloudflare's "Public Hostname" Access apps require a domain you control as a Cloudflare DNS zone, which doesn't work for a `*.streamlit.app` URL you don't own.

**Filters:** `dashboard/components/filters.py` (`render_sidebar_filters(key_prefix, account_types, show_currency=False)`) draws the sidebar widgets inside an `st.sidebar.form(...)` with an "Apply Filters" submit button — widget changes alone do **not** trigger a rerun/requery; only clicking Apply commits new values, which are cached in `st.session_state[f"{key_prefix}_filters"]` so they persist across reruns. Each page calls this with its own `account_types` (so the Account dropdown only lists relevant accounts) and a distinct `key_prefix` (so the two pages' filter state and form keys don't collide). The returned dict also carries `has_applied` (`True` once `f"{key_prefix}_filters"` exists in `st.session_state`, i.e. the user has clicked Apply at least once this session) — this lets a page distinguish "still on defaults" from "user explicitly filtered," e.g. the Investments trade history table (below).

**Pages:**
- **Spending** (`dashboard/views/spending.py`, accounts: `bank`, `ewallet`) — KPI row (Monthly Income, Monthly Spend, Savings Rate), stacked bar (Monthly Spend by Category), donut (Spend by Category), dual line (Income vs Spend), line (Savings Rate % with 50% dashed target), transactions table
- **Investments** (`dashboard/views/investments.py`, accounts: `brokerage`, includes currency selector) — Net Worth KPI, line chart (Net Worth Over Time from `asset_snapshots`), donut (Asset Allocation by Account), trade history table (from `portfolio_events`, previously not surfaced anywhere in the dashboard). The table ignores the sidebar's date range until `filters["has_applied"]` is `True`, showing full unfiltered history by default (`get_portfolio_events()` with no date args) since a handful of trades getting hidden behind a default 180-day window was confusing — once the user applies a filter, `get_portfolio_events(start_date, end_date)` takes over.

Use Plotly for all charts (`plotly.express`). Use `st.columns()` for side-by-side layout. Use `st.divider()` between sections. Any new chart/page-level code goes in the relevant file under `dashboard/views/`, not in `app.py`.

---

## Coding Conventions

- All async functions for bot handlers (required by python-telegram-bot v20+)
- Use `load_dotenv()` at the top of every entry-point file
- All Supabase operations go in `db/supabase.py` — never query Supabase inline in handlers or dashboard
- All formatting helpers (currency, date strings) go in `utils/formatters.py`
- No f-string SQL — all queries go through the Supabase Python client
- Use type hints where practical
- Do not use global state outside of the `pending` and `last_saved` dicts in `handlers.py`
- `backend/` routers are thin — validate with Pydantic (`backend/schemas.py`), call `db/supabase.py`/`utils/`, return. No Supabase calls inline in a router.
- `frontend/` never imports `@supabase/*` or holds a Supabase key — all data access goes through `src/api/client.ts` to `backend/`. New charts go in `src/components/charts/`, colored via `src/lib/palette.ts` (categorical order is fixed — see Frontend section above), not ad-hoc hex values.

---

## What NOT to Do

- Do not auto-insert to Supabase without user confirmation via Telegram
- Do not expose `SUPABASE_SERVICE_KEY` in dashboard or frontend code — dashboard uses `SUPABASE_ANON_KEY` only, `frontend/` never talks to Supabase directly (only `backend/` does), except `db.dashboard_insert_portfolio_event()` and `db.update_transaction()` (see Database Schema conventions above)
- Do not use synchronous Telegram bot patterns (use async throughout)
- Do not put business logic in `bot/main.py` or `backend/main.py` — keep both as thin entry points only
- Do not commit `DASHBOARD_EMAIL`/`DASHBOARD_PASSWORD`/`JWT_SECRET` values — set them only in `.env` locally and in Railway/Streamlit Cloud's secrets in production
- Do not change the `amount` sign convention — negative = expense is used throughout the codebase (bot, backend, both dashboards) and depends on it

---

## Common Tasks

**Add a new expense category:**
→ Update `CATEGORIES` in `utils/constants.py` only. The extraction prompt imports from there.

**Test Gemini extraction without running the bot:**
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

**Trigger the equity price update manually for testing:**
```python
# In a scratch script
from scheduler.equity_price_updater import update_equity_prices
update_equity_prices()
```

**Add a ticker on a new exchange:**
→ Add the raw ticker → Yahoo Finance symbol mapping to `TICKER_YFINANCE_MAP` in `utils/constants.py`.

**Add a new chart to the dashboard (legacy Streamlit):**
→ Add after the existing sections in `dashboard/views/spending.py` or `dashboard/views/investments.py` (whichever it belongs to). Use `plotly.express`. Follow the existing column layout pattern. Prefer adding new charts to `frontend/` instead — see below.

**Run the backend + frontend locally:**
```bash
# Terminal 1 — backend (from repo root, needs SUPABASE_*/DASHBOARD_*/JWT_SECRET/CORS_ALLOWED_ORIGIN in .env)
python -m uvicorn backend.main:app --reload --port 8000

# Terminal 2 — frontend (from frontend/, needs VITE_API_URL=http://localhost:8000 in .env.local)
cd frontend && npm run dev
```

**Add a new chart to the frontend:**
→ Add a component in `frontend/src/components/charts/`, color it via `src/lib/palette.ts` (`colorForCategory`/`colorForKey`/`categoricalColor` — never a raw hex), and drop it into the relevant page under `frontend/src/pages/`. Add a `useQuery` hook in `src/hooks/api.ts` first if it needs new data from the backend.

**Add a new backend endpoint:**
→ Add a route to the relevant file in `backend/routers/` (or a new router registered in `backend/main.py`), backed by an existing (or new) `db/supabase.py`/`utils/` function. Validate the request body with a Pydantic model in `backend/schemas.py` if it's a write.