"""
Authentication middleware for JWT validation and tenant context.
Uses Supabase JWKS endpoint for ES256 token verification.
"""
import os
import ssl
import time
import certifi
from typing import Optional
from urllib.request import urlopen
import json
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from jwt import PyJWK
from pydantic import BaseModel

SUPABASE_URL = os.getenv("SUPABASE_URL")
JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json" if SUPABASE_URL else None

# Cache the JWKS keys
_jwks_keys: Optional[dict] = None
_jwks_fetched_at: float = 0
JWKS_CACHE_TTL = 3600  # Refresh JWKS every hour

security = HTTPBearer()


def fetch_jwks() -> dict:
    """Fetch JWKS from Supabase with proper SSL handling."""
    global _jwks_keys, _jwks_fetched_at

    if not JWKS_URL:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_URL not configured",
        )

    # Return cached keys if still valid
    if _jwks_keys is not None and (time.time() - _jwks_fetched_at) < JWKS_CACHE_TTL:
        return _jwks_keys

    # Fetch with proper SSL context
    ssl_context = ssl.create_default_context(cafile=certifi.where())
    with urlopen(JWKS_URL, context=ssl_context) as response:
        _jwks_keys = json.loads(response.read().decode())
        _jwks_fetched_at = time.time()

    return _jwks_keys


def get_signing_key(token: str) -> PyJWK:
    """Get the signing key for a token from JWKS."""
    # Get the key ID from token header
    unverified_header = jwt.get_unverified_header(token)
    kid = unverified_header.get("kid")

    jwks = fetch_jwks()

    for key_data in jwks.get("keys", []):
        if key_data.get("kid") == kid:
            return PyJWK.from_dict(key_data)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unable to find matching key",
        headers={"WWW-Authenticate": "Bearer"},
    )


class UserPayload(BaseModel):
    """Decoded JWT payload representing the authenticated user."""
    sub: str  # User ID (UUID)
    email: Optional[str] = None
    role: str = "authenticated"
    tenant_id: Optional[str] = None  # Will be populated from database


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token using Supabase JWKS."""
    try:
        # Get the signing key from JWKS
        signing_key = get_signing_key(token)

        # Decode and verify the token
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "HS256"],  # Support both for compatibility
            audience="authenticated",
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token validation failed: {str(e)}",
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


async def require_operator(user: UserPayload = Depends(get_current_user)) -> UserPayload:
    """
    Dependency that requires the user to have operator role.
    Use this for operator-only endpoints.
    """
    # Import here to avoid circular imports
    from db.supabase import supabase

    # Fetch user's role from database (more reliable than JWT claim)
    result = supabase.table("users").select("role").eq("id", user.sub).single().execute()

    if not result.data or result.data.get("role") != "operator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operator access required",
        )

    return user


async def get_user_with_tenant(user: UserPayload = Depends(get_current_user)) -> UserPayload:
    """
    Dependency that fetches user with their tenant_id from database.
    Returns UserPayload enriched with tenant information.
    """
    # Import here to avoid circular imports
    from db.supabase import supabase

    result = supabase.table("users").select("role, tenant_id").eq("id", user.sub).single().execute()

    if result.data:
        user.role = result.data.get("role", "viewer")
        user.tenant_id = result.data.get("tenant_id")

    return user
