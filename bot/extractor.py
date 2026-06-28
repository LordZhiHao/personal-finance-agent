import json
import os

from dotenv import load_dotenv
from google import genai
from google.genai import types

from utils.constants import CATEGORIES

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

MODEL = "gemini-3.5-flash"

SYSTEM_PROMPT = f"""
You are a financial document parser for a user based in Singapore.
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
      "category": one of {CATEGORIES},
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
- confidence reflects how clearly you can read each field
"""


def _parse_response(raw: str) -> dict:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    # Gemini occasionally appends trailing content after the JSON object on
    # very large outputs; raw_decode parses just the first valid JSON value
    # instead of erroring on that trailing data.
    obj, _ = json.JSONDecoder().raw_decode(raw.strip())
    return obj


def extract_from_image(image_bytes: bytes, mime_type: str = "image/jpeg") -> dict:
    response = client.models.generate_content(
        model=MODEL,
        contents=[
            types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
            "Extract all transactions from this financial document.",
        ],
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            response_mime_type="application/json",
        ),
    )
    return _parse_response(response.text)


def extract_from_text(text: str) -> dict:
    response = client.models.generate_content(
        model=MODEL,
        contents=[f"Extract all transactions from this financial document:\n\n{text}"],
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            response_mime_type="application/json",
        ),
    )
    return _parse_response(response.text)


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
