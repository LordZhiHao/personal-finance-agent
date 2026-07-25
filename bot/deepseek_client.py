import os

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

# Shared client for all DeepSeek-backed components (router, extractor, finance agent).
# DeepSeek's API is OpenAI-compatible, so the existing `openai` SDK is reused as-is.
# Each component picks its own model via its own env var (see bot/router.py,
# bot/extractor.py, bot/finance_agent.py) so they can be swapped independently.
client = OpenAI(base_url="https://api.deepseek.com", api_key=os.getenv("DEEPSEEK_API_KEY"))
