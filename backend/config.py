import os

from dotenv import load_dotenv

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 7

DASHBOARD_EMAIL = os.getenv("DASHBOARD_EMAIL")
DASHBOARD_PASSWORD = os.getenv("DASHBOARD_PASSWORD")

# Comma-separated list of allowed frontend origins, e.g. "https://myapp.vercel.app,http://localhost:5173"
CORS_ALLOWED_ORIGINS = [o.strip() for o in os.getenv("CORS_ALLOWED_ORIGIN", "").split(",") if o.strip()]
