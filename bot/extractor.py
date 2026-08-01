import json
import os
from datetime import date

from dotenv import load_dotenv
from google import genai
from google.genai import types

from bot.deepseek_client import client as deepseek_client
from utils.constants import CATEGORIES, PORTFOLIO_ACTIONS
from utils.logger import get_logger

load_dotenv()
logger = get_logger(__name__)

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

MODEL = "gemini-3.5-flash"  # multimodal extraction (extract_from_image / extract_from_pdf_images)
DEEPSEEK_EXTRACTOR_MODEL = os.getenv("DEEPSEEK_EXTRACTOR_MODEL", "deepseek-v4-pro")  # text-only extraction

def _build_system_prompt(categories: list[str], default_currency: str = "SGD") -> str:
    return f"""
You are a financial document parser.
Extract ALL transactions visible in the provided document (image or text).

Return ONLY a valid JSON object — no explanation, no markdown, no backticks.

Schema:
{{
  "document_type": "bank_statement" | "trade_screenshot" | "receipt" | "unknown",
  "account_hint": "string or null",
  "currency": "SGD" | "MYR" | "USD" | "other",
  "transactions": [
    {{
      "date": "YYYY-MM-DD",
      "description": "string",
      "amount": float,
      "category": one of {categories},
      "confidence": float between 0 and 1
    }}
  ],
  "portfolio_events": [
    {{
      "ticker": "string",
      "action": "BUY" | "SELL" | "DIVIDEND",
      "quantity": float,
      "price": float,
      "currency": "string",
      "fees": float,
      "date": "YYYY-MM-DD"
    }}
  ]
}}

Rules:
- amount is NEGATIVE for expenses/debits, POSITIVE for income/credits
- portfolio_events is an empty list [] if no trades are present
- If date is not visible, use today's date
- If the input is a short natural-language message rather than a document (e.g. "Spent 0.5+3.5 on
  meals today"), treat it as a single manually-typed expense: evaluate any arithmetic in the
  amount (e.g. 0.5+3.5 evaluates to 4.00), resolve relative dates ("today", "yesterday") against
  the current date given in the message, and set confidence to 1.0 since the user typed it
  themselves
- If no currency is explicitly stated or otherwise clearly implied by the document/message,
  default to {default_currency}
- confidence reflects how clearly you can read each field
"""


REQUIRED_TXN_FIELDS = {"date", "description", "amount", "category", "confidence"}
REQUIRED_EVENT_FIELDS = {"ticker", "action", "quantity", "price", "currency", "date"}


def _validate_schema(obj: dict, categories: list[str]) -> None:
    """Raises ValueError with a specific message if Gemini's JSON doesn't match the
    expected schema — catching this here, right after the call, avoids a bare KeyError
    surfacing later in unrelated formatting code (or a bad row reaching Supabase)."""
    txns = obj.get("transactions", [])
    events = obj.get("portfolio_events", [])
    if not isinstance(txns, list):
        raise ValueError("'transactions' must be a list")
    if not isinstance(events, list):
        raise ValueError("'portfolio_events' must be a list")

    for i, t in enumerate(txns):
        if not isinstance(t, dict):
            raise ValueError(f"transactions[{i}] is not an object")
        missing = REQUIRED_TXN_FIELDS - t.keys()
        if missing:
            raise ValueError(f"transactions[{i}] missing field(s): {missing}")
        if not isinstance(t["amount"], (int, float)):
            raise ValueError(f"transactions[{i}].amount is not numeric: {t['amount']!r}")
        if t["category"] not in categories:
            raise ValueError(f"transactions[{i}].category {t['category']!r} not in {categories}")

    for i, e in enumerate(events):
        if not isinstance(e, dict):
            raise ValueError(f"portfolio_events[{i}] is not an object")
        missing = REQUIRED_EVENT_FIELDS - e.keys()
        if missing:
            raise ValueError(f"portfolio_events[{i}] missing field(s): {missing}")
        if e["action"] not in PORTFOLIO_ACTIONS:
            raise ValueError(f"portfolio_events[{i}].action {e['action']!r} not in {PORTFOLIO_ACTIONS}")


def _parse_response(raw: str, categories: list[str]) -> dict:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    # Gemini occasionally appends trailing content after the JSON object on
    # very large outputs; raw_decode parses just the first valid JSON value
    # instead of erroring on that trailing data.
    try:
        obj, _ = json.JSONDecoder().raw_decode(raw.strip())
    except json.JSONDecodeError:
        logger.exception("LLM response could not be parsed as JSON (length=%d)", len(raw))
        raise
    _validate_schema(obj, categories)
    return obj


def extract_from_pdf_images(pdf_bytes: bytes, categories: list[str] = CATEGORIES, default_currency: str = "SGD") -> dict:
    from utils.pdf_converter import pdf_to_images

    page_images = pdf_to_images(pdf_bytes)
    logger.info("extract_from_pdf_images: %d page(s) to process with %s", len(page_images), MODEL)

    merged: dict = {"document_type": None, "account_hint": None, "currency": None, "transactions": [], "portfolio_events": []}
    for i, img in enumerate(page_images, 1):
        page_data = extract_from_image(img, mime_type="image/jpeg", categories=categories, default_currency=default_currency)
        logger.info("extract_from_pdf_images: page %d — %d txn(s), %d event(s)", i, len(page_data.get("transactions", [])), len(page_data.get("portfolio_events", [])))
        for key in ("document_type", "account_hint", "currency"):
            if merged[key] is None and page_data.get(key):
                merged[key] = page_data[key]
        merged["transactions"].extend(page_data.get("transactions", []))
        merged["portfolio_events"].extend(page_data.get("portfolio_events", []))

    logger.info(
        "extract_from_pdf_images: merged total — %d transaction(s), %d portfolio event(s)",
        len(merged["transactions"]), len(merged["portfolio_events"]),
    )
    return merged


def extract_from_image(
    image_bytes: bytes, mime_type: str = "image/jpeg", categories: list[str] = CATEGORIES, default_currency: str = "SGD"
) -> dict:
    logger.info("extract_from_image: calling %s (%d bytes, %s)", MODEL, len(image_bytes), mime_type)
    today = date.today().isoformat()
    response = client.models.generate_content(
        model=MODEL,
        contents=[
            types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
            f"Today's date is {today}. Extract all transactions from this financial document.",
        ],
        config=types.GenerateContentConfig(
            system_instruction=_build_system_prompt(categories, default_currency),
            response_mime_type="application/json",
        ),
    )
    data = _parse_response(response.text, categories)
    logger.info(
        "extract_from_image: document_type=%s, %d transaction(s), %d portfolio event(s)",
        data.get("document_type"), len(data.get("transactions", [])), len(data.get("portfolio_events", [])),
    )
    return data


def extract_from_text(text: str, categories: list[str] = CATEGORIES, default_currency: str = "SGD") -> dict:
    logger.info("extract_from_text: calling %s (%d chars)", DEEPSEEK_EXTRACTOR_MODEL, len(text))
    today = date.today().isoformat()
    response = deepseek_client.chat.completions.create(
        model=DEEPSEEK_EXTRACTOR_MODEL,
        messages=[
            {"role": "system", "content": _build_system_prompt(categories, default_currency)},
            {"role": "user", "content": f"Today's date is {today}. Extract all transactions from this text:\n\n{text}"},
        ],
        response_format={"type": "json_object"},
    )
    data = _parse_response(response.choices[0].message.content, categories)
    logger.info(
        "extract_from_text: document_type=%s, %d transaction(s), %d portfolio event(s)",
        data.get("document_type"), len(data.get("transactions", [])), len(data.get("portfolio_events", [])),
    )
    return data


# Run: python -m bot.extractor <path_to_image>
if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python -m bot.extractor <path_to_image>")
        sys.exit(1)
    path = sys.argv[1]
    mime = "image/png" if path.lower().endswith(".png") else "image/jpeg"
    with open(path, "rb") as f:
        result = extract_from_image(f.read(), mime_type=mime)
    print(json.dumps(result, indent=2))
