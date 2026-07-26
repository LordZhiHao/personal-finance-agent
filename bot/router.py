import json
import os

from bot.deepseek_client import client
from utils.logger import get_logger

logger = get_logger(__name__)

ROUTER_MODEL = os.getenv("DEEPSEEK_ROUTER_MODEL", "deepseek-v4-pro")

VALID_INTENTS = {"chat", "record"}
DEFAULT_INTENT = "record"  # graceful degradation: falls back to the existing, tested record-entry path

INTENT_PROMPT = """You are an intent classifier for a personal finance Telegram bot.
Decide whether the user's message is:
- "record": the user is reporting a new expense, income, or investment trade to be logged
  (e.g. "spent 12 on lunch", "bought 10 CSPX at 500", "got paid 3000 salary").
- "chat": the user is asking a question, requesting a summary/analysis, or having a general
  conversation about their existing finances (e.g. "how much did I spend on food this month",
  "what's my portfolio doing", "am I saving enough"), or asking for the web dashboard link/URL
  (e.g. "take me to my dashboard", "what's the link to the site").

Return ONLY a JSON object: {"intent": "record"} or {"intent": "chat"}.
If the message could plausibly be either, prefer "record"."""


def classify_intent(raw_text: str) -> str:
    """Single cheap DeepSeek call. Any failure (network, malformed JSON, unexpected
    value) is swallowed and defaults to "record" — deliberately broader than the
    narrow (json.JSONDecodeError, ValueError) catch used elsewhere in this codebase,
    because the fallback here is itself the fully working, already-tested path."""
    try:
        response = client.chat.completions.create(
            model=ROUTER_MODEL,
            messages=[
                {"role": "system", "content": INTENT_PROMPT},
                {"role": "user", "content": raw_text},
            ],
            response_format={"type": "json_object"},
            temperature=0,
        )
        obj = json.loads(response.choices[0].message.content)
        intent = obj.get("intent")
        if intent not in VALID_INTENTS:
            logger.warning("classify_intent: unexpected intent %r, defaulting to %r", intent, DEFAULT_INTENT)
            return DEFAULT_INTENT
        return intent
    except Exception:
        logger.exception("classify_intent: classification call failed, defaulting to %r", DEFAULT_INTENT)
        return DEFAULT_INTENT
