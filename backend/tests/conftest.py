"""
Shared test fixtures for backend tests.
Provides mock Supabase client, FastAPI test client, and auth fixtures.
"""
import os
import sys
from unittest.mock import MagicMock, patch, AsyncMock

import pytest

# Ensure backend root is on the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# ---------------------------------------------------------------------------
# Environment stubs (must be set before any app-level imports)
# ---------------------------------------------------------------------------
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-jwt-secret")
os.environ.setdefault("FRONTEND_URL", "http://localhost:5173")
os.environ.setdefault("DEBUG", "true")
os.environ.setdefault("SKIP_STARTUP_TASKS", "true")


# ---------------------------------------------------------------------------
# Mock Supabase helpers
# ---------------------------------------------------------------------------

class MockQueryBuilder:
    """Chainable mock for Supabase query builder pattern."""

    def __init__(self, data=None, count=None):
        self._data = data if data is not None else []
        self._count = count

    # Every builder method returns self so chains work
    def select(self, *args, **kwargs):
        return self

    def insert(self, *args, **kwargs):
        return self

    def update(self, *args, **kwargs):
        return self

    def delete(self, *args, **kwargs):
        return self

    def eq(self, *args, **kwargs):
        return self

    def neq(self, *args, **kwargs):
        return self

    def gte(self, *args, **kwargs):
        return self

    def lte(self, *args, **kwargs):
        return self

    def in_(self, *args, **kwargs):
        return self

    def not_(self, *args, **kwargs):
        return self

    def is_(self, *args, **kwargs):
        return self

    def order(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    def range(self, *args, **kwargs):
        return self

    def single(self):
        return self

    def execute(self):
        result = MagicMock()
        result.data = self._data
        result.count = self._count
        return result


class MockSupabase:
    """Mock Supabase client that returns predictable data."""

    def __init__(self):
        self._table_data = {}
        self._rpc_data = {}
        self.storage = MagicMock()

    def table(self, name):
        data = self._table_data.get(name, [])
        count = len(data) if isinstance(data, list) else None
        return MockQueryBuilder(data=data, count=count)

    def rpc(self, name, params=None):
        data = self._rpc_data.get(name, {})
        return MockQueryBuilder(data=data)

    def set_table_data(self, table_name, data):
        """Configure mock data for a specific table."""
        self._table_data[table_name] = data

    def set_rpc_data(self, rpc_name, data):
        """Configure mock data for a specific RPC call."""
        self._rpc_data[rpc_name] = data


@pytest.fixture
def mock_supabase():
    """Provide a fresh MockSupabase instance and patch the global singleton."""
    client = MockSupabase()
    with patch("db.supabase.supabase", client):
        yield client


# ---------------------------------------------------------------------------
# Auth fixtures
# ---------------------------------------------------------------------------

MOCK_USER_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
MOCK_TENANT_ID = "11111111-2222-3333-4444-555555555555"


@pytest.fixture
def mock_operator_user():
    """Return a UserPayload dict representing an operator."""
    from middleware.auth import UserPayload
    return UserPayload(
        sub=MOCK_USER_ID,
        email="operator@test.com",
        role="operator",
        tenant_id=MOCK_TENANT_ID,
    )


@pytest.fixture
def mock_owner_user():
    """Return a UserPayload representing a restaurant owner."""
    from middleware.auth import UserPayload
    return UserPayload(
        sub="owner-0001-0001-0001-000000000001",
        email="owner@restaurant.com",
        role="owner",
        tenant_id=MOCK_TENANT_ID,
    )


@pytest.fixture
def mock_viewer_user():
    """Return a UserPayload representing a read-only viewer."""
    from middleware.auth import UserPayload
    return UserPayload(
        sub="viewer-0001-0001-0001-000000000001",
        email="viewer@restaurant.com",
        role="viewer",
        tenant_id=MOCK_TENANT_ID,
    )


# ---------------------------------------------------------------------------
# FastAPI test client
# ---------------------------------------------------------------------------

@pytest.fixture
def app():
    """Create a FastAPI app instance with mocked dependencies."""
    # Patch supabase before importing main so the lifespan doesn't hit real DB
    mock_sb = MockSupabase()
    with patch("db.supabase.supabase", mock_sb), \
         patch.dict(os.environ, {
             "SUPABASE_URL": "https://test.supabase.co",
             "SUPABASE_SERVICE_ROLE_KEY": "test-key",
         }):
        # Re-import to get a clean app
        from main import app as fastapi_app
        yield fastapi_app


@pytest.fixture
def client(app):
    """Synchronous test client using httpx."""
    from httpx import ASGITransport, AsyncClient
    # We yield a factory that callers use inside async with
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")
