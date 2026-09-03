repo: LordZhiHao/personal-finance-agent
branch: main
path: frontend/

## Last sync
date: 2026-08-29T08:12:00Z

### Updated in this project
- Read the React frontend (routes, Layout, Spending/Chat pages, UI primitives, `index.css` tokens) as source material for the mockups.
- Copied `frontend/public/logo-mark.png` and `icons.svg` into `assets/`.
- Built a redesign doc covering Overview, Spending, Investments, Finn chat, Settings, Onboarding and Login in desktop + iPhone.
- Corrected the account model: accounts are manually entered and maintained, not bank-linked.
- Read `backend/routers/chat.py` and `bot/router.py` to design a rich-reply (blocks + actions) contract for the agent across web and Telegram.
- Read `backend/main.py` and all of `backend/routers/` to write the proposed-endpoints section of the mockup doc.

## Screen map
| Project screen | Repo files |
| --- | --- |
| 1a Overview (new) | `frontend/src/components/Layout.tsx`, `frontend/src/index.css` |
| 1b/1c Spending | `frontend/src/pages/SpendingPage.tsx`, `components/ChartCard.tsx`, `StatCard.tsx`, `TransactionsList.tsx`, `FilterBar.tsx`, `MobileSectionTabs.tsx` |
| 1d Investments | `frontend/src/pages/` investments page, `components/charts/*` |
| 1e Finn chat | `frontend/src/pages/ChatPage.tsx`, `components/FinnAvatar.tsx` |
| 1f Settings | `frontend/src/pages/` settings page, `components/ui/Card.tsx`, `Button.tsx` |
| 1g Onboarding | new — no repo equivalent |
| 1i Finn on desktop (dock + ⌘K) | `frontend/src/pages/ChatPage.tsx`, `components/Layout.tsx` |
| 1h Login | `frontend/src/auth/` |
| api — proposed endpoints | `backend/main.py`, `backend/routers/*.py`, `utils/balances.py` |
| rich — agent reply envelope | `backend/routers/chat.py`, `bot/router.py`, `bot/finance_agent.py`, `bot/handlers.py`, `backend/schemas.py` |
