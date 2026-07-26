# CLAUDE.md — Personal Finance Tracker

## Project Overview

This is a personal finance tracker, originally built for one user and now open to a small, **invite-only** group of trusted users (friends/family) who each sign up for their own account, own set of accounts/transactions/holdings, and their own linked Telegram chat. It has these components:
1. A Telegram bot (one shared `BOT_TOKEN`) for data ingestion (images, PDFs, text) and conversational finance Q&A, scoped per user via a Telegram-chat-to-account link
2. Gemini VLM for extracting structured transaction data from screenshots/statements (multimodal); DeepSeek for text-only work — free-typed extraction, intent routing, and the finance Q&A agent
3. A Supabase Postgres database as the single source of truth, with a `users` table and `accounts.user_id` as the tenant-scoping boundary
4. A FastAPI backend (`backend/`) exposing that data over a JSON API with real signup/login and JWT auth
5. A React dashboard (`frontend/`) for visualisation and account management (including linking Telegram) — the primary web UI, replacing the legacy Streamlit dashboard (`dashboard/`, kept until the React app is confirmed as a full replacement, then removed). **`dashboard/` remains single-tenant and untouched** — it is not part of the multi-tenancy work and still serves only the original owner via `DASHBOARD_EMAIL`/`DASHBOARD_PASSWORD`
6. An APScheduler job that sends weekly reports and daily check-ins via Telegram and email, once per linked user

The bot and scheduler run together on Railway. The backend (`backend/`) runs as a second Railway service in the same project (`web: python -m uvicorn backend.main:app ...` in the `Procfile`). The React frontend is deployed on Vercel and talks only to the backend API — it never touches Supabase directly. The legacy Streamlit dashboard, while still present, runs on Streamlit Community Cloud behind a simple email/password login form built into the Streamlit app itself, and only ever shows the original owner's data (see "Multi-Tenancy" below for why it was left this way).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Bot framework | python-telegram-bot v20+ (async) |
| VLM extraction (multimodal) | Gemini API (`gemini-3.5-flash`), `google-genai` SDK — image/PDF only |
| Text-only LLM (extraction, intent routing, Q&A) | DeepSeek API (`deepseek-v4-pro` by default), via the OpenAI-compatible `openai` SDK pointed at `https://api.deepseek.com` (`bot/deepseek_client.py`). Model id is independently overridable per component via `DEEPSEEK_ROUTER_MODEL`/`DEEPSEEK_EXTRACTOR_MODEL`/`DEEPSEEK_AGENT_MODEL` |
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
| Auth (backend/frontend) | Real signup/login against a `users` table (`backend/routers/auth_routes.py`, passwords hashed with `bcrypt` in `backend/auth.py`), issuing a JWT whose `sub` claim is the user's id; frontend sends it as `Authorization: Bearer <token>` |
| Auth (legacy dashboard) | Email/password login form inside `dashboard/app.py`, checked against `DASHBOARD_EMAIL`/`DASHBOARD_PASSWORD` env vars, session-only (no token) — unchanged, single-tenant, out of scope for multi-tenancy |
| Password hashing | `bcrypt` (used directly, not via `passlib` — `passlib` 1.7.4 is unmaintained and incompatible with `bcrypt` ≥4.1's stricter 72-byte-password behavior) |

---

## Project File Structure

```
expense-tracker/
├── bot/
│   ├── main.py              # Bot entry point + APScheduler wired here
│   ├── handlers.py          # Telegram handlers: photo, document, text
│   ├── extractor.py         # Gemini (image/PDF) + DeepSeek (extract_from_text) calls + JSON parsing
│   ├── router.py            # classify_intent(): DeepSeek call deciding chat vs. record for free text
│   ├── finance_agent.py     # answer_question(): DeepSeek tool-calling Q&A agent over spending/holdings/balances
│   └── deepseek_client.py   # Shared DeepSeek (OpenAI-compatible) client, used by extractor/router/finance_agent
├── db/
│   └── supabase.py          # All Supabase read/write functions — every account/transaction/
│                             # portfolio/snapshot function takes a user_id (see Multi-Tenancy)
├── backend/                 # FastAPI API — the only thing frontend/ talks to
│   ├── main.py               # FastAPI app, CORS, PermissionError/LookupError exception handlers, router registration — thin, like bot/main.py
│   ├── config.py              # env var loading (JWT_SECRET, CORS_ALLOWED_ORIGIN, ...)
│   ├── auth.py                 # hash_password/verify_password (bcrypt), create_access_token / get_current_user (JWT, PyJWT)
│   ├── schemas.py                # Pydantic request models (signup, login, account create, transaction update, portfolio event)
│   └── routers/
│       ├── auth_routes.py         # POST /api/auth/signup, POST /api/auth/login, GET /api/auth/me
│       ├── telegram_link.py        # POST /api/telegram-link — generates a short-lived code for /link in the bot
│       ├── meta.py                 # GET /api/meta — CATEGORIES/CURRENCIES/etc. from utils/constants.py
│       ├── spending.py               # GET/PATCH /api/transactions, GET /api/transactions/summary
│       ├── investments.py             # GET/POST /api/portfolio-events, GET /api/snapshots, GET /api/holdings
│       └── accounts.py                 # GET/POST /api/accounts, GET /api/accounts/balances
├── frontend/                 # React SPA (Vite + TS) — deployed to Vercel
│   └── src/
│       ├── api/client.ts       # fetch wrapper: attaches JWT, base URL from VITE_API_URL
│       ├── auth/                # AuthContext, LoginPage, SignupPage, ProtectedRoute
│       ├── hooks/api.ts          # useQuery/useMutation hooks per backend endpoint
│       ├── pages/                  # SpendingPage, InvestmentsPage, PortfolioPage, BalancesPage, SettingsPage
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
│   ├── weekly_report.py     # Loops every user with a linked Telegram/email, sends each their own report
│   ├── daily_checkin.py     # Loops every user with a linked Telegram chat, sends each their own check-in
│   ├── report_builder.py    # Supabase queries for weekly summary (per user_id) + summarize_transactions()
│   ├── emailer.py           # Gmail HTML email sender, takes an explicit to_email per call
│   └── equity_price_updater.py  # Hourly yfinance price pull (global) + per-account, per-owner asset_snapshots refresh
├── migrations/               # Versioned SQL schema changes — see migrations/README.md for convention
├── scripts/
│   └── backfill_owner.py     # One-off: creates the users row for the original owner from legacy env vars
├── utils/
│   ├── constants.py         # CATEGORIES, CURRENCIES, ACCOUNT_TYPES, TICKER_YFINANCE_MAP, DASHBOARD_URL
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

Seven tables in Supabase (five original + `users` + `telegram_link_codes`, added in `migrations/0001_multi_tenancy_schema.sql`). Always use these exact column names. Schema changes are now tracked as versioned SQL files in `migrations/` (see its `README.md`) — this is the first thing this project has ever had beyond prose documentation, so keep it up going forward instead of letting `CLAUDE.md` drift out of sync with reality again.

```
users              id, email, password_hash, telegram_chat_id, notify_email, created_at
telegram_link_codes  code, user_id, expires_at, used_at, created_at
accounts           id, name, type, currency, is_active, user_id, created_at
transactions       id, account_id, date, description, amount, category, currency, raw_text, source, created_at
portfolio_events   id, account_id, date, ticker, action, quantity, price, currency, fees, created_at
asset_snapshots    id, account_id, snapshot_date, total_value, currency, notes, created_at
equity_prices      id, ticker, price, currency, fetched_at, created_at
```

**Key conventions:**
- `amount` in `transactions` is **negative for expenses, positive for income**
- `action` in `portfolio_events` is one of: `BUY | SELL | DIVIDEND`
- `source` in `transactions` is one of: `telegram_image | telegram_pdf | telegram_text | manual`
- Always use `SUPABASE_SERVICE_KEY` for bot writes, `SUPABASE_ANON_KEY` for dashboard reads. Exceptions: `db.dashboard_insert_portfolio_event()` (investments page "Add Entry" dialog, and `backend/routers/investments.py`'s `POST /api/portfolio-events`) and `db.update_transaction()` (spending page's editable transactions table, and `backend/routers/spending.py`'s `PATCH /api/transactions/{id}`) both use `SUPABASE_SERVICE_KEY` — the anon key has no INSERT/UPDATE grant via RLS on `portfolio_events`/`transactions`, and adding those grants was judged a bigger surface change than reusing the service key for these single, already-login-gated write paths. The browser never holds a Supabase key at all — `backend/` is the only thing that calls `db/supabase.py`, so `SUPABASE_SERVICE_KEY` stays server-side by construction for the React frontend
- `asset_snapshots` has a unique constraint on `(account_id, snapshot_date)` — required for the hourly equity price job to upsert rather than duplicate a snapshot per run. `ticker` in `equity_prices` stores the Yahoo Finance symbol (post-`TICKER_YFINANCE_MAP` lookup), not the raw broker ticker
- `users.telegram_chat_id` and `users.email` are both unique — a Telegram chat can only ever be linked to one account at a time (`db.consume_telegram_link_code()` clears it from any previous owner before assigning it), and signup rejects a duplicate email with 409

---

## Multi-Tenancy

Tenant isolation flows through **`accounts.user_id` only** — `transactions`, `portfolio_events`, and `asset_snapshots` are *not* given their own `user_id` column; they're scoped transitively via their existing `account_id`. `equity_prices` stays fully global (shared market data, no owner). No Supabase Row-Level Security is used for tenant isolation (RLS in this project is only the pre-existing anon-vs-service-key write grants, unrelated to per-user isolation) — isolation is enforced entirely in the `db/supabase.py` application layer, which every caller (`backend/`, `bot/`, `scheduler/`) goes through.

- **`db/supabase.py`** — `get_account_ids_for_user(user_id)` is the core primitive; every scoped function resolves owned account ids first, then filters with `.in_("account_id", owned_ids)`. Two signature patterns:
  - Functions the **legacy `dashboard/` calls** (`get_accounts`, `get_transactions`, `update_transaction`, `dashboard_insert_portfolio_event`, `get_latest_snapshots`, `get_portfolio_events`) take `user_id: str | None = None` as a **trailing, optional** param — `None` preserves the exact unscoped/global behavior `dashboard/` and the system-wide equity price job depend on. **Never make `user_id` required on these** — `dashboard/` calls them with its original, pre-multi-tenancy signatures and must keep working unmodified.
  - Every other function that touches `accounts`/`transactions`/`portfolio_events`/`asset_snapshots` (`insert_transactions`, `insert_portfolio_events`, `get_all_portfolio_events`, `get_recent_transactions`, `get_account_cash_totals`, `delete_transactions`, `delete_portfolio_events`, `upsert_asset_snapshot`) takes a **required** `user_id: str` and raises `PermissionError` if a write targets an account the caller doesn't own.
- **Backend**: `backend/main.py` registers `PermissionError` → 403 and `LookupError` → 404 exception handlers so routers never need per-call try/except. Every router thread `user_id = Depends(get_current_user)` into its `db/supabase.py`/`utils/` calls.
- **Bot**: `bot/handlers.py::_resolve_user(update)` looks up the `users` row for `update.effective_user.id` (via `get_user_by_telegram_chat_id`) in place of the old single-ID `ALLOWED_USER_IDS` allowlist; every handler replies with a "link your account" prompt if unresolved, otherwise threads the resolved `user_id` into its calls. `pending`/`last_saved`/`chat_history` stay keyed by the raw Telegram id (unchanged — they were already per-chat-safe).
- **Linking a Telegram chat**: the web dashboard's Settings page (`POST /api/telegram-link`) generates a 6-digit code (10-minute TTL) stored in `telegram_link_codes`; the user sends `/link <code>` to the bot, which calls `db.consume_telegram_link_code()` in-process (no HTTP "consume" endpoint exists — the bot already has service-key Supabase access like everything else in `bot/`).
- **Scheduler**: `weekly_report.py`/`daily_checkin.py` loop `get_all_users()`/`get_users_with_telegram()` and build/send each user's report independently, with a per-user try/except so one user's failure doesn't block the rest. `equity_price_updater.py` needed the least change — it already looped per-account; it now just looks up each account's `user_id` before calling `upsert_asset_snapshot()`.
- **New users have zero accounts by default** — `/newaccount <name> <type> <currency>` in the bot (or `POST /api/accounts` from the dashboard) is how a freshly signed-up or newly-linked user creates their first one. `handle_text`'s `confirm` branch checks for this and tells the user to run `/newaccount` first rather than silently failing, keeping their pending extraction intact so `confirm` can be retried afterward.
- **Rollout**: apply `migrations/0001_multi_tenancy_schema.sql` → run `python -m scripts.backfill_owner` once → apply `migrations/0002_lock_accounts_owner.sql` → deploy `backend/`+`bot/`+`scheduler/`+`db/`+`utils/` together (they must not run with mismatched `db/supabase.py` signatures against each other) → deploy `frontend/`. The one pre-existing owner must log out and back in after the deploy, since their old JWT's `sub` claim is an email string, not a `user_id`.
- **Verification**: `python -m tests.test_tenant_isolation` seeds two throwaway users, asserts no cross-tenant read/write leakage, and cleans up after itself (same manual-script convention as `tests/test_supabase_connection.py` — there's no pytest harness in this repo).

---

## Environment Variables

All secrets are in `.env`. Reference them via `os.getenv()` with `load_dotenv()`.

```
BOT_TOKEN
YOUR_TELEGRAM_CHAT_ID
GEMINI_API_KEY
DEEPSEEK_API_KEY
DEEPSEEK_ROUTER_MODEL
DEEPSEEK_EXTRACTOR_MODEL
DEEPSEEK_AGENT_MODEL
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

`DEEPSEEK_ROUTER_MODEL`/`DEEPSEEK_EXTRACTOR_MODEL`/`DEEPSEEK_AGENT_MODEL` are optional per-component model overrides — each defaults to `"deepseek-v4-pro"` in code if unset, so they only need to be set in `.env` to pin a component to a different model.

`JWT_SECRET` and `CORS_ALLOWED_ORIGIN` (comma-separated allowed frontend origins) are used only by `backend/`. The React frontend has its own env var, set in `frontend/.env.local` / Vercel project settings, not `.env`: `VITE_API_URL` — the backend's base URL.

**Multi-tenancy note:** `DASHBOARD_EMAIL`/`DASHBOARD_PASSWORD` are permanent, not legacy — `dashboard/auth.py` still reads them directly for its own untouched single-tenant login, and `scripts/backfill_owner.py` reads them once to create the original owner's `users` row. `YOUR_TELEGRAM_CHAT_ID` and `NOTIFY_EMAIL` are now **backfill-only**: read once by `scripts/backfill_owner.py` to seed the owner's `telegram_chat_id`/`notify_email`, no longer read anywhere in `bot/` or `scheduler/` (which now look up every user's chat id/email from the `users` table instead). Every other user's password, Telegram chat id, and notify email live in the `users` table, not in env vars.

Never hardcode any of these. Never print them in logs.

---

## Categories

Always use this exact list for the `category` field in transactions and in the extraction prompt (shared by both the Gemini and DeepSeek extraction paths — see below). Defined in `utils/constants.py`:

```python
CATEGORIES = [
    "Food & Drink", "Transport", "Shopping", "Groceries",
    "Entertainment", "Health", "Utilities", "Salary",
    "Investment", "Transfer", "Other"
]
```

---

## LLM Extraction, Routing & Q&A

`bot/extractor.py` has three extraction entry points sharing one `SYSTEM_PROMPT`/JSON schema, split across two providers:

**Gemini (multimodal, image/PDF only):**
- Model: `gemini-3.5-flash`, via the `google-genai` SDK (`google.genai.Client`), not the OpenAI SDK
- `extract_from_image(image_bytes, mime_type)` — for `handle_photo`, non-PDF documents, and each rasterized PDF page (see `extract_from_pdf_images` below). Images are sent via `types.Part.from_bytes(data=image_bytes, mime_type=...)`, not base64 data URLs.
- `extract_from_pdf_images(pdf_bytes)` — for PDFs in `handle_document`. `utils/pdf_converter.py` (`pdf2image`, requires poppler) rasterizes each page to a JPEG; each page is run through `extract_from_image()` individually and the resulting `transactions`/`portfolio_events` lists are concatenated, with `document_type`/`account_hint`/`currency` taken from the first page that reports them. An N-page PDF means N separate Gemini image calls, not one text call.

**DeepSeek (text-only):**
- `extract_from_text(text)` — for free-typed Telegram messages that the router (`bot/router.py`) classified as a record attempt (e.g. "Spent 0.5+3.5 on meals today"). Uses the shared client in `bot/deepseek_client.py`, model `DEEPSEEK_EXTRACTOR_MODEL` (env override, defaults to `deepseek-v4-pro`). Calls `deepseek_client.chat.completions.create(..., response_format={"type": "json_object"})` with `SYSTEM_PROMPT` as the system message. The call is always prefixed with the actual current date (`date.today()`) so the model can resolve relative dates like "today"/"yesterday" — it has no other way to know the real date.
- `bot/router.py`'s `classify_intent(raw_text)` — a separate, cheap DeepSeek call (model `DEEPSEEK_ROUTER_MODEL`, defaults to `deepseek-v4-pro`) that decides whether a free-text message is `"chat"` (a question) or `"record"` (an expense/trade to log), before `handle_text` decides which path to take. See "Telegram Bot Behaviour" below.
- `bot/finance_agent.py`'s `answer_question(uid, raw_text, user_id)` — the conversational finance Q&A agent (model `DEEPSEEK_AGENT_MODEL`, defaults to `deepseek-v4-pro`). `uid` (the raw Telegram id) still keys `chat_history`; `user_id` (the resolved `users.id`) is threaded into every tool call so answers are scoped to the caller's own data. See its own subsection below.

**Shared across both providers:**
- The system prompt instructs the model to return **only valid JSON**, no markdown, no explanation; for short natural-language input it's told to evaluate arithmetic in the amount (e.g. `0.5+3.5` → `4.00`) and set `confidence: 1.0` since the user typed it themselves
- JSON mode is requested from both providers (`response_mime_type="application/json"` for Gemini, `response_format={"type": "json_object"}` for DeepSeek), but responses are still parsed defensively: strip markdown fences, then use `json.JSONDecoder().raw_decode()` rather than `json.loads()` — large outputs (e.g. consolidated statements with 90+ transactions) occasionally have trailing content after the JSON object, and `raw_decode` recovers the first valid JSON value instead of erroring on `Extra data`. `_parse_response()`/`_validate_schema()` in `bot/extractor.py` are provider-agnostic and shared by every extraction call.
- Store the raw response text in `transactions.raw_text` for every insert

**Expected output schema (both providers):**
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

### Finance Q&A Agent (`bot/finance_agent.py`)

- `answer_question(uid, raw_text, user_id) -> str` runs a bounded DeepSeek tool-calling loop (`MAX_TOOL_ROUNDS = 4`) so the bot can answer questions like "how much did I spend on food this month" or "what's my portfolio doing" using real Supabase-backed data rather than guessing.
- Six tools, all thin wrappers around existing query functions, each implicitly scoped to `user_id` via `_run_tool(name, args, user_id)`:
  - `get_spending_summary(period)` → `utils/period.py::parse_period` + `db.supabase.get_transactions(..., user_id)` + `scheduler/report_builder.py::summarize_transactions`. `period` accepts `day|week|month|year|month_to_date`.
  - `get_transactions_list(period)` → `db.supabase.get_transactions(..., user_id)` directly, returning the itemized rows (not aggregated) for a period — used when the user wants to see/list transactions (e.g. "what are this month's transactions") rather than a summary. Same `period` enum as `get_spending_summary`.
  - `get_holdings()` → `utils/portfolio.py::compute_holdings_summary(user_id, DEFAULT_CURRENCY)`. Already returns per-ticker `avg_cost`, `market_value`, `unrealized_gain`/`unrealized_gain_pct`, so single-ticker questions ("how's CSPX doing") are answered by calling this and filtering — no separate single-ticker tool.
  - `get_balances()` → `utils/balances.py::compute_account_balances(user_id, DEFAULT_CURRENCY)`
  - `get_recent_transactions_tool(limit)` → `db.supabase.get_recent_transactions(limit, user_id)`, capped 1–30 like `/recent`
  - `get_portfolio_trades(period)` → `db.supabase.get_portfolio_events(..., user_id=user_id)`, optionally bounded via `parse_period`
- `AGENT_SYSTEM_PROMPT` also hardcodes the web dashboard URL (`utils/constants.py::DASHBOARD_URL`) so "guide me to my dashboard"-style questions get answered directly without a tool call, and instructs the model to map "this/current month" to the `month_to_date` period rather than the trailing `month` window.
- One agent, not three separate ones — it naturally covers general enquiry, transaction questions, and investment questions through tool selection, since a message can pull from any combination of tools.
- Maintains a small per-user rolling chat history (`chat_history: dict[int, list[dict]]`, capped at `MAX_HISTORY_TURNS = 6` turns) for multi-turn context — same dict-keyed-by-`user_id` pattern as `pending`/`last_saved` in `handlers.py`.
- Any exception during the loop (network failure, malformed tool call, etc.) is caught and turned into an apology string — this path never raises into `handle_text`.
- Replies are sent as **plain text**, not `parse_mode="Markdown"` — unlike the confirmation messages (built from escaped, controlled strings via `_escape_md`), the agent's reply is arbitrary LLM-generated prose that could contain unescaped `_`/`*`/`` ` ``/`[` and break Telegram's legacy Markdown parser. Still chunked via `chunk_lines()` for the 4096-char limit.

---

## Telegram Bot Behaviour

- **Any linked user is allowed**: `bot/handlers.py::_resolve_user(update)` looks up the `users` row for `update.effective_user.id` via `db.get_user_by_telegram_chat_id()`. If unresolved, the handler replies with instructions to link via the dashboard's Settings page + `/link <code>`, instead of the old silent-return single-owner allowlist.
- **Never auto-commit to DB** — always show a confirmation message first
- Pending extractions are stored in a dict keyed by user ID: `pending = {}`
- Confirmation flow: bot shows extracted rows → user replies `confirm`, `cancel`, or `edit <n>`
- Flag rows with `confidence < 0.7` with a ⚠️ in the confirmation message
- After `confirm`: write to Supabase, clear from `pending`, reply with count of saved entries
- After `cancel`: clear from `pending`, reply with cancellation message
- Handlers: `handle_photo`, `handle_document`, `handle_text` in `bot/handlers.py`
- **Confirmation messages are chunked**: `send_confirmation()` splits the row list across multiple Telegram messages via `chunk_lines()`, staying under Telegram's 4096-char limit per message (headroom of 4000). Required once PDF statements with 90+ transactions became routine — a single message would silently fail to send (`Message is too long`). Splits happen on line boundaries so each line's Markdown formatting stays self-contained per chunk.
- `source` on each transaction row is set per-handler (`telegram_image` / `telegram_pdf` / `telegram_text`), not hardcoded — read from `data["source"]` when building rows in the `confirm` branch of `handle_text`.
- **Free-text routing**: any message in `handle_text` that isn't `confirm`/`cancel`/`edit <n>` first goes through `bot/router.py::classify_intent(raw_text)` (a cheap DeepSeek call) to decide `"chat"` vs. `"record"`. Any classification failure defaults to `"record"` — the older, fully-tested path — rather than the narrower exception handling used elsewhere in this file.
- **Chat path**: if intent is `"chat"`, `bot/finance_agent.py::answer_question(uid, raw_text)` answers directly using real account data (see "Finance Q&A Agent" above) and replies in plain text — no `pending` state, no confirmation, no DB write.
- **Record path (free-text expense entry)**: if intent is `"record"`, the message falls through to `extract_from_text(raw_text)` (e.g. "Spent 0.5+3.5 on meals today", now DeepSeek-backed) and joins the same pending/confirmation flow as photos and PDFs — no separate code path, no auto-commit. `raw_text` (original casing) is passed to the model, not the lowercased `text` used for command matching, so descriptions keep their natural casing. If extraction returns no transactions and no portfolio_events (e.g. the message wasn't actually about a transaction), the bot replies with a hint instead of opening a confirmation with nothing in it. Saved rows get `source="telegram_text"`.

---

## Telegram Commands

Registered via `CommandHandler` in `bot/main.py`, all implemented as `handle_*_command` functions in `bot/handlers.py`. Every command except `/link`, `/dashboard`, and `/help` resolves the caller via `_resolve_user()` first, same as the media/text handlers. All money figures are reported in `DEFAULT_CURRENCY` (`"SGD"`) — like the weekly report, amounts are summed/displayed without per-transaction currency conversion (a pre-existing simplification; only `/assets`, `/balance`, and `/portfolio` convert, since those read from already-currency-tagged snapshots/prices via `utils/fx.convert`).

- **`/link <code>`** — the one command that runs without user resolution (that's its purpose). Redeems a code generated on the dashboard's Settings page via `db.consume_telegram_link_code()`, binding this Telegram chat to that web account. Invalid/expired codes get a plain error reply.
- **`/dashboard`** — replies with the web dashboard URL (`utils/constants.py::DASHBOARD_URL`). Also runs without user resolution, same as `/help` — it's not account-scoped data. The chat agent (`bot/finance_agent.py`) answers the same request in plain English too (see "Finance Q&A Agent" above).
- **`/newaccount <name> <bank|brokerage|ewallet> <currency>`** — creates the caller's first (or Nth) account via `db.create_account()`. Needed because signup no longer auto-creates an account — a brand-new or newly-linked user has zero accounts until they run this (or use `POST /api/accounts` from the dashboard).
- **`/expense [day|week|month|year|month_to_date]`** — `utils/period.py` (`parse_period`) resolves the arg to a date window ending today (default `week`); `month` is trailing ~30 days, `month_to_date` is the current calendar month from the 1st. Queries `get_transactions` for that range and reuses `scheduler/report_builder.summarize_transactions()` (extracted from `get_weekly_data` so the weekly cron report and this command share one aggregation, not two copies) for income/expenses/net/savings rate/by-category.
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
- **Runs once per user**, not once globally: `send_weekly_report(bot)` loops `db.get_all_users()`, builds each user's own `get_weekly_data(user_id)`, and sends to that user's `telegram_chat_id`/`notify_email` individually — wrapped in a per-user try/except so one user's Supabase/Telegram/email failure doesn't block the others' reports. Same pattern in `scheduler/daily_checkin.py` (loops `get_users_with_telegram()`).
- Within each user's report: queries their previous Mon–Sun window from Supabase (scoped via `get_account_ids_for_user`)
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

Entrypoint: `backend/main.py`, run with `python -m uvicorn backend.main:app --reload` locally (`--host 0.0.0.0 --port $PORT` in production). Interactive docs at `/docs`. Every route except `/health`, `POST /api/auth/signup`, and `POST /api/auth/login` requires `Authorization: Bearer <token>`, enforced via the `get_current_user` FastAPI dependency (`backend/auth.py`), which returns the JWT's `sub` claim — a real per-user `user_id` (uuid), threaded into every `db/supabase.py`/`utils/` call each router makes so requests only ever see that user's own data.

**Auth:** `POST /api/auth/signup` creates a `users` row (`bcrypt`-hashed password via `backend/auth.py::hash_password`, 409 if the email already exists) and returns a JWT. `POST /api/auth/login` checks the submitted email/password against the `users` table (`verify_password`) and returns a JWT signed with `JWT_SECRET`, 7-day expiry, whose `sub` claim is the user's id. `GET /api/auth/me` returns `{id, email, telegram_linked}` for the current token — used by the frontend to hydrate `AuthContext` on load/refresh. No refresh flow — the frontend just re-shows the login form once a request 401s (see `frontend/src/api/client.ts`).

**Telegram linking:** `POST /api/telegram-link` (`backend/routers/telegram_link.py`) generates a 6-digit code with a 10-minute TTL, stored in `telegram_link_codes`. The user redeems it via `/link <code>` in the bot — there's no HTTP "consume" endpoint; the bot calls `db.consume_telegram_link_code()` directly, since it already holds service-key Supabase access.

**Routers** (`backend/routers/`), all thin wrappers around `db/supabase.py` / `utils/` — no business logic lives in the routers themselves:
- `meta.py` — `GET /api/meta` returns `CATEGORIES`/`CURRENCIES`/`ACCOUNT_TYPES`/`PORTFOLIO_ACTIONS` from `utils/constants.py`, so the frontend never hardcodes its own copy of these lists.
- `spending.py` — `GET /api/transactions`, `GET /api/transactions/summary` (wraps `scheduler/report_builder.summarize_transactions()`), `PATCH /api/transactions/{id}` (category/description only, same restriction as the dashboard's editable table).
- `investments.py` — `GET /api/snapshots` (adds a `converted_value` field per row via `utils/fx.convert`, since the frontend has no FX calls of its own — pass `?currency=`), `GET`/`POST /api/portfolio-events`, `GET /api/holdings` (wraps `utils/portfolio.py::compute_holdings_summary()` — the `/portfolio` bot command's math, first surfaced outside Telegram here).
- `accounts.py` — `GET /api/accounts` (optional `?type=` comma-separated filter), `POST /api/accounts` (create an account — the dashboard-side equivalent of the bot's `/newaccount`), `GET /api/accounts/balances` (wraps `utils/balances.py::compute_account_balances()` — the `/balance` bot command's math).

`PermissionError`/`LookupError` raised from `db/supabase.py`'s ownership checks are translated to 403/404 by exception handlers registered in `backend/main.py` — routers don't need their own try/except for cross-tenant access attempts.

Add a new endpoint by adding a route to the relevant router (or a new router registered in `main.py`) that calls an existing `db/supabase.py` / `utils/` function — don't duplicate query logic that already exists for the bot.

---

## Frontend (React)

`frontend/` — Vite + React + TypeScript SPA, deployed to Vercel. Run locally with `npm run dev` (from `frontend/`); needs `VITE_API_URL` pointing at a running `backend/` (see `frontend/.env.example`).

- **Auth:** `src/auth/AuthContext.tsx` holds the JWT (persisted in `localStorage`) plus `userId`/`email`/`telegramLinked`, hydrated from `GET /api/auth/me` on load (`refreshMe()`). `ProtectedRoute` renders `LoginPage` or `SignupPage` (toggled locally, no route change) when unauthenticated, and renders nothing while the initial `/me` check is in flight. `src/api/client.ts` attaches the token to every request and clears it on a 401.
- **Settings page** (`src/pages/SettingsPage.tsx`): "Link Telegram" — calls `POST /api/telegram-link` (`useGenerateTelegramLinkCode` in `src/hooks/api.ts`), displays the code and `/link <code>` instructions. Since generating a code doesn't itself complete the link (the user still has to message the bot), a "refresh status" action re-calls `refreshMe()` rather than assuming success.
- **Data fetching:** TanStack Query hooks in `src/hooks/api.ts`, one per backend endpoint. Filters are **live** (no Streamlit-style "Apply" button — that pattern existed only to limit Streamlit reruns, which don't apply here).
- **Pages** (`src/pages/`): `SpendingPage` and `InvestmentsPage` mirror the legacy Streamlit pages' charts; `PortfolioPage` (holdings/avg-cost/unrealized P&L) and `BalancesPage` (unified cash+brokerage balances) are new — they surface `/api/holdings` and `/api/accounts/balances`, which the Streamlit dashboard never called even though the underlying bot commands (`/portfolio`, `/balance`) already existed.
- **Charts** (`src/components/charts/`): Recharts, colored via `src/lib/palette.ts`'s fixed categorical order (`CATEGORICAL`) — category colors specifically go through `colorForCategory()`, which maps the 8 expense-relevant categories (`EXPENSE_CATEGORY_COLOR_ORDER`) to the 8 validated hues and folds everything else (income-only categories, "Other") to a neutral rather than wrapping/reusing a hue — a wrapped 9th+ category previously collided with an earlier one (e.g. "Transfer" and "Transport" rendered identically). Two chart-only additions beyond the Streamlit set: `SpendingHeatmap` (daily spend calendar) and `MonthComparisonBarChart` (this month vs previous vs same month last year per category), both pure client-side aggregations over already-fetched transactions (`src/lib/dates.ts`) — no dedicated backend endpoint.
- **Writes:** `TransactionsTable` (category/description edits) and `AddTradeDialog` (new portfolio events, react-hook-form + zod, same validation rules as the Streamlit dialog: ticker required, quantity > 0, price > 0 unless `DIVIDEND`) both call the backend then invalidate the relevant TanStack Query key to refetch. `AddTradeDialog` is only mounted while its dialog is open (not kept alive and hidden) — mounting fresh each open avoids react-hook-form's `defaultValues` (e.g. the default selected account) going stale from an earlier render where the accounts list hadn't loaded yet.

---

## Dashboard (legacy Streamlit)

Being replaced by `frontend/` — kept until the React app is confirmed as a full replacement, then this section and `dashboard/` will be removed. Do not add new functionality here; add it to `frontend/`/`backend/` instead.

**Deliberately excluded from multi-tenancy.** `dashboard/` still authenticates against `DASHBOARD_EMAIL`/`DASHBOARD_PASSWORD` and always shows the original owner's data — it calls `db/supabase.py` functions (`get_accounts`, `get_transactions`, `update_transaction`, `dashboard_insert_portfolio_event`, `get_latest_snapshots`, `get_portfolio_events`) with their pre-multi-tenancy call signatures (no `user_id` argument). Those six functions keep `user_id: str | None = None` as a trailing optional param specifically so `dashboard/`'s existing calls keep working unmodified — **never make `user_id` required on them**, and never edit anything under `dashboard/` as part of multi-tenancy work.

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
- Do not use global state outside of the `pending` and `last_saved` dicts in `handlers.py`, and `chat_history` in `bot/finance_agent.py` (bounded rolling per-Telegram-chat state, keyed by the raw Telegram id — still fine post-multi-tenancy since each dict entry only ever holds one linked user's in-flight data)
- `backend/` routers are thin — validate with Pydantic (`backend/schemas.py`), call `db/supabase.py`/`utils/`, return. No Supabase calls inline in a router.
- `frontend/` never imports `@supabase/*` or holds a Supabase key — all data access goes through `src/api/client.ts` to `backend/`. New charts go in `src/components/charts/`, colored via `src/lib/palette.ts` (categorical order is fixed — see Frontend section above), not ad-hoc hex values.
- Any new or modified `db/supabase.py` function that touches `accounts`/`transactions`/`portfolio_events`/`asset_snapshots` must take a `user_id` and scope its query/write accordingly (see "Multi-Tenancy" above) — unscoped queries are a cross-tenant data leak, not just a bug. The only exceptions are the six functions `dashboard/` calls (which keep `user_id` optional for backward compatibility) and `equity_prices` functions (genuinely global market data).

---

## What NOT to Do

- Do not auto-insert to Supabase without user confirmation via Telegram
- Do not expose `SUPABASE_SERVICE_KEY` in dashboard or frontend code — dashboard uses `SUPABASE_ANON_KEY` only, `frontend/` never talks to Supabase directly (only `backend/` does), except `db.dashboard_insert_portfolio_event()` and `db.update_transaction()` (see Database Schema conventions above)
- Do not use synchronous Telegram bot patterns (use async throughout)
- Do not put business logic in `bot/main.py` or `backend/main.py` — keep both as thin entry points only
- Do not commit `DASHBOARD_EMAIL`/`DASHBOARD_PASSWORD`/`JWT_SECRET` values — set them only in `.env` locally and in Railway/Streamlit Cloud's secrets in production
- Do not change the `amount` sign convention — negative = expense is used throughout the codebase (bot, backend, both dashboards) and depends on it
- Do not edit anything under `dashboard/` as part of multi-tenancy work, and never make `user_id` a required parameter on the six `db/supabase.py` functions it calls (see "Multi-Tenancy" and "Dashboard (legacy Streamlit)" above)
- Do not add a `user_id` column to `transactions`/`portfolio_events`/`asset_snapshots` — tenant scoping flows through `accounts.user_id` only, by design (see "Multi-Tenancy" above)
- Do not reintroduce `passlib` for password hashing — it's unmaintained and incompatible with modern `bcrypt`; use `backend/auth.py`'s `hash_password`/`verify_password` (thin wrappers over `bcrypt` directly)

---

## Common Tasks

**Add a new expense category:**
→ Update `CATEGORIES` in `utils/constants.py` only. The extraction prompt imports from there.

**Test Gemini extraction without running the bot:**
```bash
python -m bot.extractor /path/to/screenshot.jpg
```

**Test DeepSeek intent routing, text extraction, or the Q&A agent without running the bot:**
```python
# In a scratch script
from bot.router import classify_intent
from bot.extractor import extract_from_text
from bot.finance_agent import answer_question

print(classify_intent("how much did I spend on food this month"))  # "chat"
print(classify_intent("spent 12 on lunch"))                          # "record"
print(extract_from_text("Spent 0.5+3.5 on meals today"))
print(answer_question(uid=0, raw_text="what's my portfolio doing", user_id="<a real users.id>"))
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
→ Add a route to the relevant file in `backend/routers/` (or a new router registered in `backend/main.py`), backed by an existing (or new) `db/supabase.py`/`utils/` function. Validate the request body with a Pydantic model in `backend/schemas.py` if it's a write. Thread `user_id = Depends(get_current_user)` into every `db/supabase.py`/`utils/` call — see "Multi-Tenancy" above.

**Add a new schema migration:**
→ Add `migrations/000N_snake_case_description.sql` (next number after the highest existing file), idempotent DDL, ending with an insert into `schema_migrations`. See `migrations/README.md` for the full convention. Apply manually via the Supabase SQL editor or `psql "$SUPABASE_DB_URL" -f migrations/000N_....sql`.

**Verify tenant isolation after a `db/supabase.py` change:**
```bash
python -m tests.test_tenant_isolation
```
Seeds two throwaway users, asserts no cross-tenant leakage in reads/writes, then cleans up after itself against the real Supabase project.