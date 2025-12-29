"""
Authentication middleware for JWT validation.
"""
import os
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from pydantic import BaseModel

SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")
ALGORITHM = "HS256"

security = HTTPBearer()


class UserPayload(BaseModel):
    """Decoded JWT payload representing the authenticated user."""
    sub: str  # User ID (UUID)
    email: Optional[str] = None
    role: str = "authenticated"


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token."""
    if not SUPABASE_JWT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="JWT secret not configured",
        )

    try:
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=[ALGORITHM],
            audience="authenticated",
        )
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> UserPayload:
    """
    Dependency that extracts and validates the JWT from the Authorization header.
    Returns the decoded user payload.
    """
    token = credentials.credentials
    payload = decode_token(token)

    return UserPayload(
        sub=payload.get("sub"),
        email=payload.get("email"),
        role=payload.get("role", "authenticated"),
    )


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
) -> Optional[UserPayload]:
    """
    Dependency that optionally extracts and validates the JWT.
    Returns None if no token is provided.
    """
    if credentials is None:
        return None

    token = credentials.credentials
    try:
        payload = decode_token(token)
        return UserPayload(
            sub=payload.get("sub"),
            email=payload.get("email"),
            role=payload.get("role", "authenticated"),
        )
    except HTTPException:
        return None
