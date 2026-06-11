from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import Column, DateTime, UniqueConstraint
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(UTC)


class User(SQLModel, table=True):
    """A "shadow account": we store who the user is and where (subdomain),
    but NEVER their EduPage password."""

    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("subdomain", "username", name="uq_user_subdomain_username"),)

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    subdomain: str = Field(index=True, max_length=63)
    username: str = Field(max_length=255)
    created_at: datetime = Field(
        default_factory=_utcnow, sa_column=Column(DateTime(timezone=True), nullable=False)
    )
    last_login_at: datetime = Field(
        default_factory=_utcnow, sa_column=Column(DateTime(timezone=True), nullable=False)
    )


class Session(SQLModel, table=True):
    """Server-side session. The opaque `id` is what travels in the JWT; the
    EduPage PHPSESSID cookie is Fernet-encrypted in `encrypted_cookie`."""

    __tablename__ = "sessions"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", index=True)
    encrypted_cookie: str
    created_at: datetime = Field(
        default_factory=_utcnow, sa_column=Column(DateTime(timezone=True), nullable=False)
    )
    expires_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
    revoked: bool = Field(default=False)
