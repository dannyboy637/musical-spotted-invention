"""
Tests for authentication middleware.
Tests token decoding, role-based access, tenant extraction, and user cache.
"""
import os
import sys
from unittest.mock import patch, MagicMock

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")

from middleware.auth import (
    UserPayload,
    decode_token,
    get_current_user,
    get_user_with_tenant,
    require_operator,
    invalidate_user_cache,
    _user_cache,
)
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials


# =============================================
# UserPayload model tests
# =============================================


class TestUserPayload:
    def test_default_role_is_authenticated(self):
        user = UserPayload(sub="user-123")
        assert user.role == "authenticated"
        assert user.tenant_id is None

    def test_custom_fields(self):
        user = UserPayload(
            sub="user-123",
            email="test@test.com",
            role="operator",
            tenant_id="tenant-abc",
        )
        assert user.sub == "user-123"
        assert user.email == "test@test.com"
        assert user.role == "operator"
        assert user.tenant_id == "tenant-abc"


# =============================================
# decode_token tests
# =============================================


class TestDecodeToken:
    @patch("middleware.auth.get_signing_key")
    @patch("middleware.auth.jwt.decode")
    def test_valid_token_returns_payload(self, mock_jwt_decode, mock_get_key):
        mock_key = MagicMock()
        mock_key.key = "test-key"
        mock_get_key.return_value = mock_key
        mock_jwt_decode.return_value = {
            "sub": "user-123",
            "email": "test@test.com",
            "role": "authenticated",
        }

        result = decode_token("valid-token")
        assert result["sub"] == "user-123"
        assert result["email"] == "test@test.com"

    @patch("middleware.auth.get_signing_key")
    @patch("middleware.auth.jwt.decode")
    def test_expired_token_raises_401(self, mock_jwt_decode, mock_get_key):
        import jwt as pyjwt

        mock_key = MagicMock()
        mock_key.key = "test-key"
        mock_get_key.return_value = mock_key
        mock_jwt_decode.side_effect = pyjwt.ExpiredSignatureError()

        with pytest.raises(HTTPException) as exc_info:
            decode_token("expired-token")
        assert exc_info.value.status_code == 401
        assert "expired" in exc_info.value.detail.lower()

    @patch("middleware.auth.get_signing_key")
    @patch("middleware.auth.jwt.decode")
    def test_invalid_token_raises_401(self, mock_jwt_decode, mock_get_key):
        import jwt as pyjwt

        mock_key = MagicMock()
        mock_key.key = "test-key"
        mock_get_key.return_value = mock_key
        mock_jwt_decode.side_effect = pyjwt.InvalidTokenError("bad token")

        with pytest.raises(HTTPException) as exc_info:
            decode_token("garbage-token")
        assert exc_info.value.status_code == 401
        assert "invalid" in exc_info.value.detail.lower()


# =============================================
# get_current_user tests
# =============================================


class TestGetCurrentUser:
    @pytest.mark.asyncio
    @patch("middleware.auth.decode_token")
    async def test_extracts_user_from_valid_token(self, mock_decode):
        mock_decode.return_value = {
            "sub": "user-456",
            "email": "hello@test.com",
            "role": "authenticated",
        }
        credentials = HTTPAuthorizationCredentials(
            scheme="Bearer", credentials="valid-token"
        )
        user = await get_current_user(credentials)
        assert user.sub == "user-456"
        assert user.email == "hello@test.com"

    @pytest.mark.asyncio
    @patch("middleware.auth.decode_token")
    async def test_defaults_role_to_authenticated(self, mock_decode):
        mock_decode.return_value = {"sub": "user-789"}
        credentials = HTTPAuthorizationCredentials(
            scheme="Bearer", credentials="token"
        )
        user = await get_current_user(credentials)
        assert user.role == "authenticated"


# =============================================
# require_operator tests
# =============================================


class TestRequireOperator:
    @pytest.mark.asyncio
    async def test_operator_from_cache(self):
        """Operator found in cache should succeed without DB lookup."""
        user = UserPayload(sub="cached-op", email="op@test.com", role="authenticated")
        cache_key = f"user:{user.sub}"
        _user_cache[cache_key] = {"role": "operator", "tenant_id": "t-123"}

        try:
            result = await require_operator(user)
            assert result.role == "operator"
            assert result.tenant_id == "t-123"
        finally:
            _user_cache.pop(cache_key, None)

    @pytest.mark.asyncio
    async def test_non_operator_in_cache_raises_403(self):
        """Non-operator in cache should raise 403."""
        user = UserPayload(sub="cached-viewer", email="v@test.com", role="authenticated")
        cache_key = f"user:{user.sub}"
        _user_cache[cache_key] = {"role": "viewer", "tenant_id": "t-123"}

        try:
            with pytest.raises(HTTPException) as exc_info:
                await require_operator(user)
            assert exc_info.value.status_code == 403
        finally:
            _user_cache.pop(cache_key, None)

    @pytest.mark.asyncio
    async def test_operator_from_db(self):
        """Operator not in cache should be fetched from DB."""
        user = UserPayload(sub="db-op", email="op@test.com", role="authenticated")
        mock_result = MagicMock()
        mock_result.data = {"role": "operator", "tenant_id": "t-456"}

        mock_query = MagicMock()
        mock_query.select.return_value = mock_query
        mock_query.eq.return_value = mock_query
        mock_query.single.return_value = mock_query
        mock_query.execute.return_value = mock_result

        mock_sb = MagicMock()
        mock_sb.table.return_value = mock_query

        with patch("db.supabase.supabase", mock_sb):
            result = await require_operator(user)
            assert result.role == "operator"
            assert result.tenant_id == "t-456"

        # Clean up cache entry
        _user_cache.pop(f"user:{user.sub}", None)

    @pytest.mark.asyncio
    async def test_non_operator_from_db_raises_403(self):
        """Non-operator from DB should raise 403."""
        user = UserPayload(sub="db-viewer", email="v@test.com", role="authenticated")
        mock_result = MagicMock()
        mock_result.data = {"role": "viewer", "tenant_id": "t-789"}

        mock_query = MagicMock()
        mock_query.select.return_value = mock_query
        mock_query.eq.return_value = mock_query
        mock_query.single.return_value = mock_query
        mock_query.execute.return_value = mock_result

        mock_sb = MagicMock()
        mock_sb.table.return_value = mock_query

        with patch("db.supabase.supabase", mock_sb):
            with pytest.raises(HTTPException) as exc_info:
                await require_operator(user)
            assert exc_info.value.status_code == 403


# =============================================
# get_user_with_tenant tests
# =============================================


class TestGetUserWithTenant:
    @pytest.mark.asyncio
    async def test_returns_cached_user(self):
        """Should return cached tenant info without DB call."""
        user = UserPayload(sub="cached-tenant-user", email="u@test.com")
        cache_key = f"user:{user.sub}"
        _user_cache[cache_key] = {"role": "owner", "tenant_id": "t-cached"}

        try:
            result = await get_user_with_tenant(user)
            assert result.role == "owner"
            assert result.tenant_id == "t-cached"
        finally:
            _user_cache.pop(cache_key, None)

    @pytest.mark.asyncio
    async def test_fetches_from_db_on_cache_miss(self):
        user = UserPayload(sub="db-tenant-user", email="u@test.com")
        mock_result = MagicMock()
        mock_result.data = {"role": "owner", "tenant_id": "t-from-db"}

        mock_query = MagicMock()
        mock_query.select.return_value = mock_query
        mock_query.eq.return_value = mock_query
        mock_query.single.return_value = mock_query
        mock_query.execute.return_value = mock_result

        mock_sb = MagicMock()
        mock_sb.table.return_value = mock_query

        with patch("db.supabase.supabase", mock_sb):
            result = await get_user_with_tenant(user)
            assert result.role == "owner"
            assert result.tenant_id == "t-from-db"

        # Verify it was cached
        cache_key = f"user:{user.sub}"
        assert cache_key in _user_cache
        _user_cache.pop(cache_key, None)


# =============================================
# invalidate_user_cache tests
# =============================================


class TestInvalidateUserCache:
    def test_removes_cached_entry(self):
        cache_key = "user:to-invalidate"
        _user_cache[cache_key] = {"role": "viewer", "tenant_id": "t-1"}
        assert cache_key in _user_cache

        invalidate_user_cache("to-invalidate")
        assert cache_key not in _user_cache

    def test_no_error_when_not_cached(self):
        # Should not raise
        invalidate_user_cache("nonexistent-user-id")
