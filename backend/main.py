from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from backend.config import CORS_ALLOWED_ORIGINS  # noqa: E402
from backend.routers import accounts, auth_routes, investments, meta, spending  # noqa: E402

app = FastAPI(title="Personal Finance API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router)
app.include_router(meta.router)
app.include_router(spending.router)
app.include_router(investments.router)
app.include_router(accounts.router)


@app.get("/health")
def health():
    return {"status": "ok"}
