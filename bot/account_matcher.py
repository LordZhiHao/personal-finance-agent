import json
import os

from bot.deepseek_client import client
from utils.logger import get_logger

logger = get_logger(__name__)

MATCHER_MODEL = os.getenv("DEEPSEEK_ACCOUNT_MATCHER_MODEL", "deepseek-v4-pro")

MATCHER_PROMPT = """You are matching a newly extracted financial entry to the correct account
for a personal finance tracker user who has multiple accounts.

You'll be given:
- A summary of the extracted transaction(s)/trade(s) (date, description or ticker, amount or
  quantity, currency).
- A list of the user's accounts, each with an id, name, type (bank/brokerage/ewallet),
  currency, and an optional freeform "comments" field the user wrote describing what they use
  that account for (e.g. "for US stock trades", "daily groceries card").

Decide which account this entry most likely belongs to, using the comments as the strongest
signal, plus currency/type as supporting evidence. Only pick a single confident account_id if
you are reasonably sure — if the comments don't clearly point to one account, or multiple
accounts seem equally plausible, do NOT guess: return account_id as null and list the plausible
candidate_ids instead (or leave candidate_ids empty if you have no basis to narrow it down at
all — the caller will then offer all accounts).

Return ONLY a JSON object: {"account_id": "<uuid> or null", "candidate_ids": ["<uuid>", ...]}"""


def _summarize_entry(data: dict) -> str:
    lines = []
    for t in data.get("transactions", []):
        lines.append(f"- transaction: {t['date']} | {t['description']} | {t['amount']} | category={t['category']}")
    for e in data.get("portfolio_events", []):
        lines.append(f"- trade: {e['date']} | {e['action']} {e['quantity']} {e['ticker']} @ {e['price']} {e['currency']}")
    return "\n".join(lines) or "(no line items)"


def match_account(data: dict, accounts: list[dict]) -> dict:
    """Returns {"account_id": str | None, "candidates": list[dict]}. A single account is
    the trivial match — no LLM call needed. Otherwise asks DeepSeek to pick the best account
    (using each account's freeform `comments` as the strongest signal), falling back to
    "unsure, here are all the accounts" on any failure — this must never block a save, only
    possibly prompt the user to choose an account before committing."""
    if len(accounts) == 1:
        return {"account_id": accounts[0]["id"], "candidates": accounts}

    accounts_by_id = {a["id"]: a for a in accounts}
    accounts_desc = "\n".join(
        f"- id={a['id']} name={a['name']!r} type={a['type']} currency={a['currency']} "
        f"comments={(a.get('comments') or '(none)')!r}"
        for a in accounts
    )
    prompt = f"Entry:\n{_summarize_entry(data)}\n\nAccounts:\n{accounts_desc}"

    try:
        response = client.chat.completions.create(
            model=MATCHER_MODEL,
            messages=[
                {"role": "system", "content": MATCHER_PROMPT},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0,
        )
        obj = json.loads(response.choices[0].message.content)
        account_id = obj.get("account_id")
        if account_id not in accounts_by_id:
            account_id = None
        candidate_ids = [cid for cid in obj.get("candidate_ids", []) if cid in accounts_by_id]
        if account_id:
            return {"account_id": account_id, "candidates": [accounts_by_id[account_id]]}
        candidates = [accounts_by_id[cid] for cid in candidate_ids] or accounts
        return {"account_id": None, "candidates": candidates}
    except Exception:
        logger.exception("match_account: DeepSeek call failed, falling back to all accounts")
        return {"account_id": None, "candidates": accounts}
