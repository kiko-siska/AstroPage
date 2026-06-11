from typing import Annotated

from fastapi import Header, HTTPException, status

from app.core.security import verify_signature


async def verify_hmac_signature(
    x_signature: Annotated[str | None, Header()] = None,
    x_payload: Annotated[str | None, Header()] = None,
) -> None:
    """Optional dependency: verify HMAC signature on signed endpoints."""
    if x_signature is None or x_payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing signature headers"
        )
    if not verify_signature(x_payload, x_signature):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid signature")
