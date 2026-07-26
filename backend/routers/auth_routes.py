from fastapi import APIRouter, Depends, HTTPException, status

from backend.auth import create_access_token, get_current_user, hash_password, verify_password
from backend.schemas import LoginRequest, SignupRequest
from db.supabase import create_user, get_user_by_email, get_user_by_id
from utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest):
    if get_user_by_email(payload.email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists")
    user = create_user(payload.email, hash_password(payload.password))
    logger.info("signup: created user %s", payload.email)
    token = create_access_token(user_id=user["id"], email=user["email"])
    return {"access_token": token, "token_type": "bearer"}


@router.post("/login")
def login(payload: LoginRequest):
    user = get_user_by_email(payload.email)
    if not user or not verify_password(payload.password, user["password_hash"]):
        logger.warning("login: failed login attempt for %s", payload.email)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    logger.info("login: successful login for %s", payload.email)
    token = create_access_token(user_id=user["id"], email=user["email"])
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me")
def me(user_id: str = Depends(get_current_user)):
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return {
        "id": user["id"],
        "email": user["email"],
        "telegram_linked": user["telegram_chat_id"] is not None,
    }
