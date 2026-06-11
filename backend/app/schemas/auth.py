from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=255)
    # SecretStr deliberately avoided so it never lands in a model dump / log by habit;
    # we read it once and discard it in the endpoint.
    password: str = Field(..., min_length=1, max_length=255)
    subdomain: str = Field(..., min_length=1, max_length=255, examples=["spsezochova"])


class LoginResponse(BaseModel):
    """Returned on success. The JWT travels in an HttpOnly cookie, not the body."""

    username: str
    subdomain: str


class AuthError(BaseModel):
    reason: str
    detail: str
