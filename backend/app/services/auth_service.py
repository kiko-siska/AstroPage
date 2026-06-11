"""Auth orchestration: validate input, upsert the shadow user, and persist an
encrypted server-side session. No passwords are ever stored or logged."""

import re
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import decrypt_secret, encrypt_secret
from app.models.user import Session, User

# EduPage subdomains are simple host labels, e.g. "spsezochova" — not full URLs.
_SUBDOMAIN_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$")


def normalize_subdomain(raw: str) -> str | None:
    """Lowercase, strip an accidental full URL, and validate as a DNS label.

    Returns the clean subdomain, or None if it can't be a valid EduPage label.
    """
    value = raw.strip().lower()
    # Tolerate users pasting "https://school.edupage.org" or "school.edupage.org".
    value = re.sub(r"^https?://", "", value)
    value = value.split(".edupage.org")[0]
    value = value.strip("/")
    if not _SUBDOMAIN_RE.match(value):
        return None
    return value


async def upsert_user(db: AsyncSession, subdomain: str, username: str) -> User:
    result = await db.execute(
        select(User).where(User.subdomain == subdomain, User.username == username)
    )
    user = result.scalar_one_or_none()
    now = datetime.now(UTC)
    if user is None:
        user = User(subdomain=subdomain, username=username, last_login_at=now)
        db.add(user)
    else:
        user.last_login_at = now
        db.add(user)
    await db.flush()
    return user


async def create_session(db: AsyncSession, user: User, edupage_cookie: str) -> Session:
    """Encrypt the EduPage PHPSESSID and store it as a revocable server-side session."""
    session = Session(
        user_id=user.id,
        encrypted_cookie=encrypt_secret(edupage_cookie),
        expires_at=datetime.now(UTC) + timedelta(minutes=settings.jwt_ttl_minutes),
    )
    db.add(session)
    await db.flush()
    return session


async def get_active_session(db: AsyncSession, session_id: UUID) -> Session | None:
    session = await db.get(Session, session_id)
    if session is None or session.revoked:
        return None
    if session.expires_at <= datetime.now(UTC):
        return None
    return session


def decrypt_session_cookie(session: Session) -> str | None:
    return decrypt_secret(session.encrypted_cookie)
