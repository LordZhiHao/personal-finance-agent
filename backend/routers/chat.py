from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, status
from fastapi.concurrency import run_in_threadpool

from backend.auth import get_current_user
from backend.schemas import ChatRequest, ChatResponse
from bot.extractor import extract_from_image, extract_from_pdf_images
from bot.finance_agent import answer_question
from bot.handlers import save_extraction
from db.supabase import get_categories_for_user

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest, user_id: str = Depends(get_current_user)):
    """answer_question runs a blocking DeepSeek tool-calling loop, so it's invoked in a
    threadpool, same reason as /api/refresh-prices and /api/dividend-forecast in investments.py."""
    reply = await run_in_threadpool(answer_question, user_id, payload.message, user_id, channel="web")
    return ChatResponse(reply=reply)


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


@router.post("/chat/upload")
async def upload_file(
    file: UploadFile,
    account_id: str = Form(...),
    user_id: str = Depends(get_current_user),
):
    """Web-dashboard equivalent of the Telegram bot's handle_photo/handle_document — runs
    the same Gemini extraction and auto-commits immediately (no confirm step, matching
    bot/handlers.py's save_extraction), against the account the user picked in the chat
    page's account selector."""
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
        return {"summary": "I couldn't find a transaction in that file.", "lines": [], "transaction_ids": [], "portfolio_event_ids": []}

    data["raw_text"] = str(data)
    data["source"] = source
    result = save_extraction(data, user_id, account_id)
    return {
        "summary": f"✅ Saved — {data.get('document_type') or 'entry'} ({data.get('currency', '')})",
        "lines": _format_saved_lines(data),
        "transaction_ids": result["transaction_ids"],
        "portfolio_event_ids": result["portfolio_event_ids"],
    }
