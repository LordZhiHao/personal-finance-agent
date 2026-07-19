from fastapi import APIRouter, HTTPException, status

from backend.auth import create_access_token
from backend.config import DASHBOARD_EMAIL, DASHBOARD_PASSWORD
from backend.schemas import LoginRequest
from utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
def login(payload: LoginRequest):
    if payload.email != DASHBOARD_EMAIL or payload.password != DASHBOARD_PASSWORD:
        logger.warning("login: failed login attempt for %s", payload.email)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    logger.info("login: successful login for %s", payload.email)
    token = create_access_token(subject=payload.email)
    return {"access_token": token, "token_type": "bearer"}
