"""
Auth context middleware for optional JWT decoding and tenant context.
Populates request.state.user and request.state.tenant_id when possible.
"""
import logging
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from db.supabase import supabase
from middleware.auth import decode_token, _user_cache

logger = logging.getLogger(__name__)


class AuthContextMiddleware(BaseHTTPMiddleware):
    """
    Middleware that attempts to decode JWTs and attach user/tenant context.
    Does not enforce authentication - failures are ignored so public endpoints work.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if request.method == "OPTIONS":
            return await call_next(request)

        auth_header = request.headers.get("authorization", "")
        if not auth_header.startswith("Bearer "):
            return await call_next(request)

        token = auth_header[7:]
        try:
            payload = decode_token(token)
        except Exception as exc:
            # Don't block requests here; auth dependencies will enforce as needed.
            logger.warning("AuthContextMiddleware: token decode failed: %s", exc)
            return await call_next(request)

        request.state.user = payload

        user_id = payload.get("sub")
        tenant_id = payload.get("tenant_id")

        if not tenant_id and user_id:
            cache_key = f"user:{user_id}"
            cached = _user_cache.get(cache_key)
            if cached:
                tenant_id = cached.get("tenant_id")
            else:
                try:
                    result = (
                        supabase
                        .table("users")
                        .select("role, tenant_id")
                        .eq("id", user_id)
                        .single()
                        .execute()
                    )
                    if result.data:
                        tenant_id = result.data.get("tenant_id")
                        _user_cache[cache_key] = {
                            "role": result.data.get("role"),
                            "tenant_id": tenant_id,
                        }
                except Exception as exc:
                    logger.debug("AuthContextMiddleware failed to load tenant_id: %s", exc)

        if tenant_id:
            request.state.tenant_id = tenant_id

        return await call_next(request)
