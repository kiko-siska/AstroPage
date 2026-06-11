import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.rate_limit import limiter
from app.core.security import create_access_token
from app.db.session import get_session
from app.schemas.auth import LoginRequest, LoginResponse
from app.services import auth_service, edupage_service
from app.services.edupage_service import EduPageAuthError

logger = logging.getLogger("app.auth")

router = APIRouter(prefix="/auth", tags=["auth"])

COOKIE_NAME = "astropage_session"


@router.post("/login", response_model=LoginResponse)
@limiter.limit("5/minute")
async def login(
    request: Request,
    response: Response,
    payload: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> LoginResponse:
    """Validate credentials against the user's EduPage instance and start a session.

    The password is used once to authenticate, then discarded — never stored or logged.
    On success a JWT holding only an opaque session id (plus username/subdomain) is set
    as an HttpOnly cookie.
    """
    subdomain = auth_service.normalize_subdomain(payload.subdomain)
    if subdomain is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid school domain. Use just the subdomain, e.g. 'spsezochova'.",
        )

    try:
        edupage_cookie = await edupage_service.login(payload.username, payload.password, subdomain)
    except EduPageAuthError as exc:
        # Log the reason and username — never the password.
        logger.info(
            "login failed: reason=%s user=%s subdomain=%s", exc.reason, payload.username, subdomain
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=exc.message)

    user = await auth_service.upsert_user(db, subdomain, payload.username)
    session = await auth_service.create_session(db, user, edupage_cookie)
    await db.commit()

    token = create_access_token(
        {"sid": str(session.id), "sub": payload.username, "subdomain": subdomain}
    )
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
        max_age=settings.jwt_ttl_minutes * 60,
    )
    logger.info("login ok: user=%s subdomain=%s", payload.username, subdomain)
    return LoginResponse(username=payload.username, subdomain=subdomain)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME)
