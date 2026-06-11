import base64
import hashlib
import hmac
from datetime import UTC, datetime, timedelta
from functools import lru_cache

import jwt
from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


def sign_payload(payload: str) -> str:
    """HMAC-SHA256 sign a string payload using the app secret key."""
    return hmac.new(
        settings.secret_key.encode(),
        payload.encode(),
        hashlib.sha256,
    ).hexdigest()


def verify_signature(payload: str, signature: str) -> bool:
    expected = sign_payload(payload)
    return hmac.compare_digest(expected, signature)


# ── JWT ─────────────────────────────────────────────────────────────────────


def create_access_token(claims: dict, ttl_minutes: int | None = None) -> str:
    """Issue a signed JWT. `claims` must NOT contain secrets (no passwords)."""
    expire = datetime.now(UTC) + timedelta(
        minutes=ttl_minutes if ttl_minutes is not None else settings.jwt_ttl_minutes
    )
    payload = {**claims, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict | None:
    """Decode and verify a JWT. Returns claims, or None if invalid/expired."""
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        return None


# ── Fernet (encrypt EduPage session cookies at rest) ──────────────────────────


@lru_cache(maxsize=1)
def _fernet() -> Fernet:
    """Build the Fernet cipher. Uses FERNET_KEY if set, else derives a key from
    SECRET_KEY (convenient for dev — set an explicit FERNET_KEY in production)."""
    if settings.fernet_key:
        return Fernet(settings.fernet_key.encode())
    derived = base64.urlsafe_b64encode(hashlib.sha256(settings.secret_key.encode()).digest())
    return Fernet(derived)


def encrypt_secret(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt_secret(token: str) -> str | None:
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken:
        return None
