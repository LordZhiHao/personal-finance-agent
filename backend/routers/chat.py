from fastapi import APIRouter, Depends
from fastapi.concurrency import run_in_threadpool

from backend.auth import get_current_user
from backend.schemas import ChatRequest, ChatResponse
from bot.finance_agent import answer_question

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest, user_id: str = Depends(get_current_user)):
    """answer_question runs a blocking DeepSeek tool-calling loop, so it's invoked in a
    threadpool, same reason as /api/refresh-prices and /api/dividend-forecast in investments.py."""
    reply = await run_in_threadpool(answer_question, user_id, payload.message, user_id, channel="web")
    return ChatResponse(reply=reply)
