"""
Rate limiting middleware for API protection.
Uses slowapi with user identification from JWT.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request


def get_user_identifier(request: Request) -> str:
    """
    Extract user identifier from JWT for rate limiting.
    Falls back to IP address if no user is authenticated.
    """
    # Try to get user from request state (set by auth middleware)
    if hasattr(request.state, "user") and request.state.user:
        return f"user:{request.state.user.get('sub', get_remote_address(request))}"

    # Try to get from authorization header
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        # Use a hash of the token for identification (not the full token)
        token = auth_header[7:]
        return f"token:{hash(token) % 10000000}"  # Use truncated hash

    # Fall back to IP address
    return f"ip:{get_remote_address(request)}"


# Create limiter instance
# Default: 100 requests per minute per user
limiter = Limiter(key_func=get_user_identifier, default_limits=["100/minute"])


# Rate limit decorators for specific use cases
def rate_limit_standard():
    """Standard rate limit: 100/minute (default)"""
    return limiter.limit("100/minute")


def rate_limit_heavy():
    """Heavy operations rate limit: 20/minute (reports, imports)"""
    return limiter.limit("20/minute")


def rate_limit_auth():
    """Auth operations rate limit: 10/minute (login, password reset)"""
    return limiter.limit("10/minute")
