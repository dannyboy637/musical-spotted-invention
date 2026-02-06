"""
Tests for data route logic.
Tests upload validation, transaction listing, and role-based access.
"""
import os
import sys
from unittest.mock import patch, MagicMock

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")

from middleware.auth import UserPayload
from fastapi import HTTPException


# =============================================
# Upload validation tests
# =============================================


class TestUploadValidation:
    """Test the upload endpoint role and file validation logic."""

    @pytest.mark.asyncio
    async def test_viewer_cannot_upload(self):
        """Viewers should be rejected with 403."""
        from routes.data import upload_csv

        mock_user = UserPayload(
            sub="viewer-1", role="viewer", tenant_id="t-1"
        )
        mock_file = MagicMock()
        mock_file.filename = "data.csv"

        with pytest.raises(HTTPException) as exc_info:
            await upload_csv(
                background_tasks=MagicMock(),
                file=mock_file,
                tenant_id=None,
                user=mock_user,
            )
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_non_csv_rejected(self):
        """Non-CSV files should be rejected with 400."""
        from routes.data import upload_csv

        mock_user = UserPayload(
            sub="owner-1", role="owner", tenant_id="t-1"
        )
        mock_file = MagicMock()
        mock_file.filename = "data.xlsx"

        with pytest.raises(HTTPException) as exc_info:
            await upload_csv(
                background_tasks=MagicMock(),
                file=mock_file,
                tenant_id=None,
                user=mock_user,
            )
        assert exc_info.value.status_code == 400
        assert "csv" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    async def test_owner_cannot_upload_to_different_tenant(self):
        """Owners should not be able to upload to a tenant they don't belong to."""
        from routes.data import upload_csv

        mock_user = UserPayload(
            sub="owner-1", role="owner", tenant_id="t-1"
        )
        mock_file = MagicMock()
        mock_file.filename = "data.csv"

        with pytest.raises(HTTPException) as exc_info:
            await upload_csv(
                background_tasks=MagicMock(),
                file=mock_file,
                tenant_id="t-different",
                user=mock_user,
            )
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_operator_without_tenant_must_specify(self):
        """Operator with no tenant_id and no override should get 400."""
        from routes.data import upload_csv

        mock_user = UserPayload(
            sub="op-1", role="operator", tenant_id=None
        )
        mock_file = MagicMock()
        mock_file.filename = "data.csv"

        with pytest.raises(HTTPException) as exc_info:
            await upload_csv(
                background_tasks=MagicMock(),
                file=mock_file,
                tenant_id=None,
                user=mock_user,
            )
        assert exc_info.value.status_code == 400


# =============================================
# Transaction listing tests
# =============================================


class TestListTransactions:
    @pytest.mark.asyncio
    async def test_viewer_without_tenant_gets_empty(self):
        """Users with no tenant_id should get an empty list."""
        from routes.data import list_transactions

        mock_user = UserPayload(sub="u-1", role="viewer", tenant_id=None)

        result = await list_transactions(user=mock_user)
        assert result == []

    @pytest.mark.asyncio
    async def test_returns_data_for_tenant(self):
        """Should return transaction data for the user's tenant."""
        from routes.data import list_transactions

        mock_user = UserPayload(sub="u-1", role="owner", tenant_id="t-1")

        mock_transactions = [
            {"id": "txn-1", "item_name": "Coffee", "gross_revenue": 15000},
            {"id": "txn-2", "item_name": "Tea", "gross_revenue": 12000},
        ]

        mock_query = MagicMock()
        mock_query.select.return_value = mock_query
        mock_query.eq.return_value = mock_query
        mock_query.gte.return_value = mock_query
        mock_query.lte.return_value = mock_query
        mock_query.order.return_value = mock_query
        mock_query.range.return_value = mock_query
        mock_result = MagicMock()
        mock_result.data = mock_transactions
        mock_query.execute.return_value = mock_result

        mock_sb = MagicMock()
        mock_sb.table.return_value = mock_query

        with patch("routes.data.supabase", mock_sb):
            result = await list_transactions(user=mock_user)
            assert len(result) == 2
            assert result[0]["item_name"] == "Coffee"

    @pytest.mark.asyncio
    async def test_applies_date_filters(self):
        """Should apply start_date and end_date filters."""
        from routes.data import list_transactions

        mock_user = UserPayload(sub="u-1", role="owner", tenant_id="t-1")

        mock_query = MagicMock()
        mock_query.select.return_value = mock_query
        mock_query.eq.return_value = mock_query
        mock_query.gte.return_value = mock_query
        mock_query.lte.return_value = mock_query
        mock_query.order.return_value = mock_query
        mock_query.range.return_value = mock_query
        mock_result = MagicMock()
        mock_result.data = []
        mock_query.execute.return_value = mock_result

        mock_sb = MagicMock()
        mock_sb.table.return_value = mock_query

        with patch("routes.data.supabase", mock_sb):
            await list_transactions(
                user=mock_user,
                start_date="2025-01-01",
                end_date="2025-01-31",
            )
            # Verify gte and lte were called for date filtering
            mock_query.gte.assert_called_with("receipt_timestamp", "2025-01-01")
            mock_query.lte.assert_called_with("receipt_timestamp", "2025-01-31")


# =============================================
# Delete transactions tests
# =============================================


class TestDeleteTransactions:
    @pytest.mark.asyncio
    async def test_viewer_cannot_delete(self):
        """Viewers should be rejected with 403."""
        from routes.data import delete_transactions

        mock_user = UserPayload(sub="v-1", role="viewer", tenant_id="t-1")

        with pytest.raises(HTTPException) as exc_info:
            await delete_transactions(user=mock_user)
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_no_tenant_raises_400(self):
        """Users without a tenant should get 400."""
        from routes.data import delete_transactions

        mock_user = UserPayload(sub="o-1", role="owner", tenant_id=None)

        with pytest.raises(HTTPException) as exc_info:
            await delete_transactions(user=mock_user)
        assert exc_info.value.status_code == 400


# =============================================
# Cancel import job tests
# =============================================


class TestCancelImportJob:
    @pytest.mark.asyncio
    async def test_viewer_cannot_cancel(self):
        """Viewers should be rejected with 403."""
        from routes.data import cancel_import_job

        mock_user = UserPayload(sub="v-1", role="viewer", tenant_id="t-1")

        with pytest.raises(HTTPException) as exc_info:
            await cancel_import_job(job_id="job-1", user=mock_user)
        assert exc_info.value.status_code == 403


# =============================================
# Menu items endpoint tests
# =============================================


class TestListMenuItems:
    @pytest.mark.asyncio
    async def test_no_tenant_returns_empty(self):
        """Users without tenant_id should get an empty list."""
        from routes.data import list_menu_items

        mock_user = UserPayload(sub="u-1", role="viewer", tenant_id=None)
        result = await list_menu_items(user=mock_user)
        assert result == []

    @pytest.mark.asyncio
    async def test_returns_items_for_tenant(self):
        """Should return menu items for the user's tenant."""
        from routes.data import list_menu_items

        mock_user = UserPayload(sub="u-1", role="owner", tenant_id="t-1")

        mock_items = [
            {"id": "mi-1", "item_name": "Latte", "total_gross_revenue": 500000},
        ]

        mock_query = MagicMock()
        mock_query.select.return_value = mock_query
        mock_query.eq.return_value = mock_query
        mock_query.order.return_value = mock_query
        mock_query.range.return_value = mock_query
        mock_result = MagicMock()
        mock_result.data = mock_items
        mock_query.execute.return_value = mock_result

        mock_sb = MagicMock()
        mock_sb.table.return_value = mock_query

        with patch("routes.data.supabase", mock_sb):
            result = await list_menu_items(user=mock_user)
            assert len(result) == 1
            assert result[0]["item_name"] == "Latte"


# =============================================
# Regenerate menu items tests
# =============================================


class TestRegenerateMenuItems:
    @pytest.mark.asyncio
    async def test_viewer_cannot_regenerate(self):
        """Viewers should be rejected with 403."""
        from routes.data import regenerate_menu_items

        mock_user = UserPayload(sub="v-1", role="viewer", tenant_id="t-1")

        with pytest.raises(HTTPException) as exc_info:
            await regenerate_menu_items(user=mock_user)
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_no_tenant_raises_400(self):
        """Users without a tenant should get 400."""
        from routes.data import regenerate_menu_items

        mock_user = UserPayload(sub="o-1", role="owner", tenant_id=None)

        with pytest.raises(HTTPException) as exc_info:
            await regenerate_menu_items(user=mock_user)
        assert exc_info.value.status_code == 400
