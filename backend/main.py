from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

load_dotenv()

from backend.config import CORS_ALLOWED_ORIGINS  # noqa: E402
from backend.routers import (  # noqa: E402
    accounts,
    auth_routes,
    budgets,
    categories,
    chat,
    investments,
    memories,
    meta,
    preferences,
    spending,
    telegram_link,
)
from utils.constants import CURRENCIES  # noqa: E402
from utils.fx import warm_cache  # noqa: E402

app = FastAPI(title="Personal Finance API")


@app.on_event("startup")
def _warm_fx_cache() -> None:
    """Pre-fetches FX rates for every supported currency so the first real request
    after a deploy/restart doesn't hit a cold cache — see utils/fx.py's warm_cache."""
    warm_cache(CURRENCIES)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(PermissionError)
def _forbidden(request: Request, exc: PermissionError):
    return JSONResponse(status_code=403, content={"detail": str(exc)})


@app.exception_handler(LookupError)
def _not_found(request: Request, exc: LookupError):
    return JSONResponse(status_code=404, content={"detail": str(exc)})


app.include_router(auth_routes.router)
app.include_router(telegram_link.router)
app.include_router(meta.router)
app.include_router(spending.router)
app.include_router(investments.router)
app.include_router(accounts.router)
app.include_router(categories.router)
app.include_router(chat.router)
app.include_router(memories.router)
app.include_router(budgets.router)
app.include_router(budgets.goals_router)
app.include_router(preferences.router)


@app.get("/health")
def health():
    return {"status": "ok"}
