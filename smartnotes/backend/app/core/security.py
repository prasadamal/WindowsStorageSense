"""
JWT token creation / verification and password hashing utilities.
"""

from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

settings = get_settings()

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Password helpers ──────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)


# ── Token helpers ─────────────────────────────────────────────────────────────

def _create_token(data: dict[str, Any], expire_minutes: int) -> str:
    payload = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=expire_minutes)
    payload.update({"exp": expire})
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_access_token(user_id: int) -> str:
    return _create_token(
        {"sub": str(user_id), "type": "access"},
        settings.ACCESS_TOKEN_EXPIRE_MINUTES,
    )


def create_refresh_token(user_id: int) -> str:
    return _create_token(
        {"sub": str(user_id), "type": "refresh"},
        settings.REFRESH_TOKEN_EXPIRE_MINUTES,
    )


def decode_token(token: str) -> dict[str, Any]:
    """
    Decode and validate a JWT.

    Raises:
        JWTError: if the token is invalid or expired.
    """
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
