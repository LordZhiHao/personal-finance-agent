import json

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.concurrency import run_in_threadpool

from backend.auth import get_current_user
from backend.schemas import ChatCommitRequest, ChatRequest, ChatResponse
from bot.account_matcher import match_account
from bot.extractor import extract_from_image, extract_from_pdf_images, extract_from_text
from bot.finance_agent import answer_question
from bot.handlers import save_extraction
from bot.router import classify_intent
from db.supabase import get_accounts, get_categories_for_user

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest, user_id: str = Depends(get_current_user)):
    """Mirrors bot/handlers.py::handle_text's routing: classify_intent decides chat (Q&A,
    via answer_question, run in a threadpool same as /api/refresh-prices/
    /api/dividend-forecast in investments.py) vs record (an expense/trade to log, via
    extract_from_text -> match_account -> save_extraction, same building blocks as
    /chat/upload below). Unlike the bot, there's no Telegram inline keyboard for an unsure
    account match, so an unsure match returns needs_account_selection the same way
    /chat/upload already does, for the frontend to resolve via POST /api/chat/commit."""
    intent = await run_in_threadpool(classify_intent, payload.message)

    if intent == "chat":
        reply = await run_in_threadpool(answer_question, user_id, payload.message, user_id, channel="web")
        return ChatResponse(reply=reply)

    categories = get_categories_for_user(user_id)
    try:
        data = await run_in_threadpool(extract_from_text, payload.message, categories)
    except (json.JSONDecodeError, ValueError):
        return ChatResponse(reply="Couldn't parse that — try rephrasing, e.g. 'spent 12 on lunch'.")

    if not data.get("transactions") and not data.get("portfolio_events"):
        return ChatResponse(
            reply="I couldn't find a transaction in that. Try something like "
            "'Spent 0.5+3.5 on meals today', or attach a screenshot/PDF."
        )

    data["raw_text"] = str(data)
    data["source"] = "web_text"

    accounts = get_accounts(user_id=user_id)
    if not accounts:
        return ChatResponse(reply="You don't have any accounts yet — create one in Settings first.")

    match = await run_in_threadpool(match_account, data, accounts)
    if not match["account_id"]:
        return ChatResponse(
            needs_account_selection=True,
            data=data,
            candidates=[
                {"id": a["id"], "name": a["name"], "type": a["type"], "currency": a["currency"]}
                for a in match["candidates"]
            ],
        )

    result = save_extraction(data, user_id, match["account_id"])
    return ChatResponse(**_build_saved_response(data, result))


def _format_saved_lines(data: dict) -> list[str]:
    """Plain-text (no Markdown) equivalent of bot/handlers.py::build_saved_lines — the
    chat page renders this as plain whitespace-pre-wrap text, not Telegram Markdown."""
    lines = []
    for i, t in enumerate(data.get("transactions", []), 1):
        flag = "⚠️" if t["confidence"] < 0.7 else "✅"
        sign = "+" if t["amount"] > 0 else ""
        lines.append(f"{flag} {i}. {t['date']} | {t['description']} | {sign}{t['amount']:.2f} | {t['category']}")
    for t in data.get("portfolio_events", []):
        lines.append(f"📈 {t['date']} | {t['action']} {t['quantity']} {t['ticker']} @ {t['price']} {t['currency']}")
    return lines


def _build_saved_response(data: dict, result: dict) -> dict:
    return {
        "needs_account_selection": False,
        "summary": f"✅ Saved — {data.get('document_type') or 'entry'} ({data.get('currency', '')})",
        "lines": _format_saved_lines(data),
        "transaction_ids": result["transaction_ids"],
        "portfolio_event_ids": result["portfolio_event_ids"],
    }


@router.post("/chat/upload")
async def upload_file(file: UploadFile, user_id: str = Depends(get_current_user)):
    """Web-dashboard equivalent of the Telegram bot's handle_photo/handle_document — runs
    the same Gemini extraction and auto-commits immediately (no confirm step, matching
    bot/handlers.py's save_extraction). Which account it commits to is resolved the same
    way as the bot: bot/account_matcher.py::match_account, using each account's freeform
    `comments` as the strongest signal. If unsure, nothing is committed yet — the response
    asks the frontend to prompt the user, which then calls POST /api/chat/commit."""
    file_bytes = await file.read()
    categories = get_categories_for_user(user_id)
    try:
        if file.content_type == "application/pdf":
            data = await run_in_threadpool(extract_from_pdf_images, file_bytes, categories)
            source = "web_pdf"
        else:
            data = await run_in_threadpool(
                extract_from_image, file_bytes, file.content_type or "image/jpeg", categories
            )
            source = "web_image"
    except (ValueError, KeyError):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Couldn't parse that file — try again, or a clearer photo/PDF.",
        )

    if not data.get("transactions") and not data.get("portfolio_events"):
        return {
            "needs_account_selection": False,
            "summary": "I couldn't find a transaction in that file.",
            "lines": [], "transaction_ids": [], "portfolio_event_ids": [],
        }

    data["raw_text"] = str(data)
    data["source"] = source

    accounts = get_accounts(user_id=user_id)
    if not accounts:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="You don't have any accounts yet — create one in Settings first.",
        )

    match = await run_in_threadpool(match_account, data, accounts)
    if not match["account_id"]:
        return {
            "needs_account_selection": True,
            "data": data,
            "candidates": [
                {"id": a["id"], "name": a["name"], "type": a["type"], "currency": a["currency"]}
                for a in match["candidates"]
            ],
        }

    result = save_extraction(data, user_id, match["account_id"])
    return _build_saved_response(data, result)


@router.post("/chat/commit")
def commit_upload(payload: ChatCommitRequest, user_id: str = Depends(get_current_user)):
    """Finalizes an upload that POST /api/chat/upload flagged needs_account_selection —
    no re-extraction, just commits the already-extracted data to the chosen account."""
    result = save_extraction(payload.data, user_id, payload.account_id)
    return _build_saved_response(payload.data, result)
