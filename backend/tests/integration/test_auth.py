"""Hermetic auth-endpoint tests: no live Postgres or EduPage required.

The DB dependency is overridden and the EduPage call is monkeypatched, so these
exercise the endpoint's guardrails (input validation, error mapping, no cookie on
failure) in isolation.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.api.v1.endpoints import auth as auth_endpoint
from app.core.security import decode_access_token
from app.db.session import get_session
from app.main import app
from app.services.edupage_service import EduPageAuthError


async def _fake_session():
    # The failure paths under test return before touching the DB.
    yield None


@pytest.fixture(autouse=True)
def override_db():
    app.dependency_overrides[get_session] = _fake_session
    yield
    app.dependency_overrides.pop(get_session, None)


def test_login_rejects_malformed_subdomain(client):
    """A subdomain that isn't a valid DNS label is rejected before any network call."""
    res = client.post(
        "/api/v1/auth/login",
        json={"username": "u", "password": "p", "subdomain": "not a domain!"},
    )
    assert res.status_code == 422
    assert "astropage_session" not in res.cookies


def test_login_bad_credentials_returns_401_without_cookie(client, monkeypatch):
    async def fake_login(username, password, subdomain):
        raise EduPageAuthError("bad_credentials", "Invalid username, password, or school domain.")

    monkeypatch.setattr(auth_endpoint.edupage_service, "login", fake_login)

    res = client.post(
        "/api/v1/auth/login",
        json={"username": "u", "password": "p", "subdomain": "spsezochova"},
    )
    assert res.status_code == 401
    assert res.json()["detail"] == "Invalid username, password, or school domain."
    # No session cookie may be set on a failed login.
    assert "astropage_session" not in res.cookies


def test_login_success_sets_jwt_cookie(client, monkeypatch):
    """The success path: validate → persist session → issue JWT in an HttpOnly cookie.

    EduPage and the DB are mocked so this stays hermetic, but it exercises the real
    session-id → JWT → Set-Cookie wiring in the endpoint.
    """
    session_id = uuid4()

    async def fake_login(username, password, subdomain):
        return "PHPSESSID123"

    async def fake_upsert_user(db, subdomain, username):
        return SimpleNamespace(id=uuid4())

    async def fake_create_session(db, user, edupage_cookie):
        # The encrypted cookie would normally be derived from edupage_cookie.
        return SimpleNamespace(id=session_id)

    monkeypatch.setattr(auth_endpoint.edupage_service, "login", fake_login)
    monkeypatch.setattr(auth_endpoint.auth_service, "upsert_user", fake_upsert_user)
    monkeypatch.setattr(auth_endpoint.auth_service, "create_session", fake_create_session)

    # Success path awaits db.commit(), so the session must be awaitable, not None.
    async def _mock_session():
        yield AsyncMock()

    app.dependency_overrides[get_session] = _mock_session

    res = client.post(
        "/api/v1/auth/login",
        json={"username": "alice", "password": "pw", "subdomain": "spsezochova"},
    )

    assert res.status_code == 200
    assert res.json() == {"username": "alice", "subdomain": "spsezochova"}

    token = res.cookies.get("astropage_session")
    assert token is not None
    claims = decode_access_token(token)
    assert claims is not None
    assert claims["sid"] == str(session_id)
    assert claims["sub"] == "alice"
    assert claims["subdomain"] == "spsezochova"
