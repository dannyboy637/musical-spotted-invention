import os
from unittest.mock import patch, MagicMock

import pytest
import httpx

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-jwt-secret")
os.environ.setdefault("FRONTEND_URL", "http://localhost:5173")
os.environ.setdefault("DEBUG", "true")
os.environ.setdefault("SKIP_STARTUP_TASKS", "true")


@pytest.mark.asyncio
async def test_health_endpoint():
    mock_sb = MagicMock()
    with patch("db.supabase.supabase", mock_sb):
        from main import app

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/health")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "healthy"
            assert "timestamp" in data
