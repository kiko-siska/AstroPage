"""Thin async wrapper around the synchronous `edupage-api` library.

Every call into edupage-api uses `requests` under the hood and blocks, so we run
it in a worker thread via `asyncio.to_thread` to avoid stalling the event loop.
"""

import asyncio
import logging

import requests
from edupage_api import Edupage
from edupage_api.exceptions import (
    BadCredentialsException,
    CaptchaException,
)

logger = logging.getLogger("app.edupage")


class EduPageAuthError(Exception):
    """Raised when EduPage rejects the login. `reason` is a stable, client-safe code."""

    def __init__(self, reason: str, message: str):
        self.reason = reason
        self.message = message
        super().__init__(message)


def _extract_session_id(edupage: Edupage) -> str:
    """Pull the PHPSESSID cookie out of the authenticated requests session."""
    for cookie in edupage.session.cookies:
        if cookie.name == "PHPSESSID":
            return cookie.value
    raise EduPageAuthError("no_session", "Login succeeded but no session cookie was returned.")


def _login_blocking(username: str, password: str, subdomain: str) -> str:
    edupage = Edupage()
    # Returns a TwoFactorLogin object when 2FA is enabled, else None.
    two_factor = edupage.login(username, password, subdomain)
    if two_factor is not None:
        raise EduPageAuthError(
            "two_factor_required",
            "This account uses two-factor authentication, which isn't supported yet.",
        )
    return _extract_session_id(edupage)


async def login(username: str, password: str, subdomain: str) -> str:
    """Authenticate against `{subdomain}.edupage.org` and return the PHPSESSID.

    The password exists only for the duration of this call and is never returned,
    stored, or logged. Raises EduPageAuthError on any failure.
    """
    try:
        return await asyncio.to_thread(_login_blocking, username, password, subdomain)
    except EduPageAuthError:
        raise  # already a clean, client-safe error (2FA, no session)
    except BadCredentialsException:
        raise EduPageAuthError("bad_credentials", "Invalid username, password, or school domain.")
    except CaptchaException:
        raise EduPageAuthError(
            "captcha", "EduPage requires a captcha. Please log in directly on EduPage and retry."
        )
    except requests.RequestException as exc:
        # DNS failure, timeout, connection refused — usually a wrong/dead subdomain.
        logger.info("edupage unreachable: subdomain=%s err=%s", subdomain, type(exc).__name__)
        raise EduPageAuthError(
            "unreachable",
            "Could not reach EduPage for that school domain. Check the domain and try again.",
        )
    except Exception as exc:
        # edupage-api parses HTML/JSON positionally and raises IndexError/KeyError/etc.
        # when the page isn't the expected login page (e.g. a 404 for a non-existent
        # subdomain). Map all of these to one clean error instead of a 500.
        logger.warning(
            "edupage login parse/unexpected error: subdomain=%s err=%s",
            subdomain,
            type(exc).__name__,
        )
        raise EduPageAuthError(
            "login_failed",
            "Login failed. Double-check your school domain, username, and password.",
        )


def _verify_blocking(session_id: str, subdomain: str, username: str) -> bool:
    try:
        Edupage.from_session_id(session_id, subdomain, username)
        return True
    except BadCredentialsException:
        return False


async def session_is_valid(session_id: str, subdomain: str, username: str) -> bool:
    """Check whether a stored PHPSESSID still authenticates against EduPage."""
    return await asyncio.to_thread(_verify_blocking, session_id, subdomain, username)
