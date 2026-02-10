"""
Tests for analytics route logic.
Tests filter parsing, quadrant calculation, tenant ID resolution, and response shapes.
"""
import os
import sys
from unittest.mock import patch, MagicMock

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")

from routes.analytics import (
    parse_filters,
    AnalyticsFilters,
    calculate_quadrant,
    get_daypart,
    OverviewResponse,
    MenuEngineeringItem,
    MenuEngineeringResponse,
)
from middleware.auth import UserPayload
from middleware.auth_helpers import get_effective_tenant_id
from fastapi import HTTPException


# =============================================
# parse_filters tests
# =============================================


class TestParseFilters:
    def test_all_none(self):
        f = parse_filters()
        assert f.start_date is None
        assert f.end_date is None
        assert f.branches is None
        assert f.categories is None

    def test_date_range(self):
        f = parse_filters(start_date="2025-01-01", end_date="2025-01-31")
        assert f.start_date == "2025-01-01"
        assert f.end_date == "2025-01-31"

    def test_branches_comma_separated(self):
        f = parse_filters(branches="Main,Downtown,Mall")
        assert f.branches == ["Main", "Downtown", "Mall"]

    def test_categories_comma_separated(self):
        f = parse_filters(categories="Coffee,Tea")
        assert f.categories == ["Coffee", "Tea"]

    def test_single_branch(self):
        f = parse_filters(branches="OnlyBranch")
        assert f.branches == ["OnlyBranch"]

    def test_all_params(self):
        f = parse_filters(
            start_date="2025-06-01",
            end_date="2025-06-30",
            branches="A,B",
            categories="Food,Drink",
        )
        assert f.start_date == "2025-06-01"
        assert f.end_date == "2025-06-30"
        assert f.branches == ["A", "B"]
        assert f.categories == ["Food", "Drink"]


# =============================================
# calculate_quadrant tests
# =============================================


class TestCalculateQuadrant:
    def test_star(self):
        assert calculate_quadrant(100, 5000, 50, 3000) == "Star"

    def test_plowhorse(self):
        assert calculate_quadrant(100, 2000, 50, 3000) == "Plowhorse"

    def test_puzzle(self):
        assert calculate_quadrant(30, 5000, 50, 3000) == "Puzzle"

    def test_dog(self):
        assert calculate_quadrant(30, 2000, 50, 3000) == "Dog"

    def test_exact_median_is_star(self):
        """Items at exactly the median should be classified as Star."""
        assert calculate_quadrant(50, 3000, 50, 3000) == "Star"

    def test_zero_values(self):
        assert calculate_quadrant(0, 0, 50, 3000) == "Dog"

    def test_equal_medians(self):
        """When median is 0, everything >= 0 is high."""
        assert calculate_quadrant(0, 0, 0, 0) == "Star"


# =============================================
# get_effective_tenant_id tests
# =============================================


class TestGetEffectiveTenantId:
    def test_operator_with_override(self):
        user = UserPayload(sub="u1", role="operator", tenant_id="own-tenant")
        result = get_effective_tenant_id(user, "override-tenant")
        assert result == "override-tenant"

    def test_operator_without_override_uses_own(self):
        user = UserPayload(sub="u1", role="operator", tenant_id="own-tenant")
        result = get_effective_tenant_id(user, None)
        assert result == "own-tenant"

    def test_operator_no_tenant_no_override_raises_400(self):
        user = UserPayload(sub="u1", role="operator", tenant_id=None)
        with pytest.raises(HTTPException) as exc_info:
            get_effective_tenant_id(user)
        assert exc_info.value.status_code == 400

    def test_owner_uses_own_tenant(self):
        user = UserPayload(sub="u1", role="owner", tenant_id="owner-tenant")
        result = get_effective_tenant_id(user)
        assert result == "owner-tenant"

    def test_owner_ignores_override(self):
        """Non-operators should use their own tenant even if override passed."""
        user = UserPayload(sub="u1", role="owner", tenant_id="owner-tenant")
        result = get_effective_tenant_id(user, "override")
        assert result == "owner-tenant"

    def test_viewer_no_tenant_raises_403(self):
        """Viewers without tenant_id should get 403, not be allowed to use override."""
        user = UserPayload(sub="u1", role="viewer", tenant_id=None)
        with pytest.raises(HTTPException) as exc_info:
            get_effective_tenant_id(user)
        assert exc_info.value.status_code == 403
        assert "no tenant" in exc_info.value.detail.lower()

    def test_viewer_with_override_still_raises_403(self):
        """Non-operators without tenant_id must NOT fall back to override (security fix)."""
        user = UserPayload(sub="u1", role="viewer", tenant_id=None)
        with pytest.raises(HTTPException) as exc_info:
            get_effective_tenant_id(user, "attacker-tenant")
        assert exc_info.value.status_code == 403


# =============================================
# get_daypart tests
# =============================================


class TestGetDaypart:
    def test_breakfast_hours(self):
        for hour in [6, 7, 8, 9, 10]:
            assert get_daypart(hour) == "breakfast"

    def test_lunch_hours(self):
        for hour in [11, 12, 13, 14]:
            assert get_daypart(hour) == "lunch"

    def test_dinner_hours(self):
        for hour in [15, 16, 17, 18, 19, 20]:
            assert get_daypart(hour) == "dinner"

    def test_late_night_hours(self):
        for hour in [21, 22, 23, 0, 1, 2, 3, 4, 5]:
            assert get_daypart(hour) == "late_night"


# =============================================
# Response model tests
# =============================================


class TestOverviewResponse:
    def test_can_build_from_typical_data(self):
        resp = OverviewResponse(
            total_revenue=1500000,
            total_transactions=500,
            unique_receipts=300,
            avg_ticket=5000,
            unique_items=45,
            period_growth=12.5,
            filters_applied={"start_date": "2025-01-01"},
            generated_at="2025-01-15T10:00:00",
        )
        assert resp.total_revenue == 1500000
        assert resp.period_growth == 12.5

    def test_nullable_growth(self):
        resp = OverviewResponse(
            total_revenue=0,
            total_transactions=0,
            unique_receipts=0,
            avg_ticket=0,
            unique_items=0,
            period_growth=None,
            filters_applied={},
            generated_at="2025-01-15T10:00:00",
        )
        assert resp.period_growth is None


class TestMenuEngineeringResponse:
    def test_empty_items(self):
        resp = MenuEngineeringResponse(
            items=[],
            quadrant_summary={"Star": 0, "Plowhorse": 0, "Puzzle": 0, "Dog": 0},
            median_quantity=0,
            median_price=0,
            filters_applied={},
            generated_at="2025-01-15T10:00:00",
        )
        assert len(resp.items) == 0

    def test_with_items(self):
        item = MenuEngineeringItem(
            item_name="Iced Latte",
            category="Coffee",
            macro_category="BEVERAGE",
            quadrant="Star",
            total_quantity=500,
            total_revenue=7500000,
            avg_price=15000,
            order_count=400,
            is_core_menu=True,
            is_current_menu=True,
        )
        resp = MenuEngineeringResponse(
            items=[item],
            quadrant_summary={"Star": 1, "Plowhorse": 0, "Puzzle": 0, "Dog": 0},
            median_quantity=500,
            median_price=15000,
            filters_applied={},
            generated_at="2025-01-15T10:00:00",
        )
        assert len(resp.items) == 1
        assert resp.items[0].item_name == "Iced Latte"
        assert resp.items[0].quadrant == "Star"


# =============================================
# Endpoint integration tests (mocked Supabase)
# =============================================


class TestOverviewEndpoint:
    @pytest.mark.asyncio
    async def test_overview_returns_correct_shape(self):
        """Test that the overview endpoint returns data matching OverviewResponse."""
        from routes.analytics import get_overview

        mock_user = UserPayload(
            sub="test-user", role="owner", tenant_id="test-tenant"
        )

        mock_overview_data = {
            "total_revenue": 2000000,
            "total_transactions": 800,
            "unique_receipts": 500,
            "avg_ticket": 2500,
        }

        mock_unique_items_data = [{"unique_items": 42}]

        # Mock the supabase RPC calls - return different data per RPC name
        mock_sb = MagicMock()

        def mock_rpc(name, params=None):
            mock_execute_chain = MagicMock()
            mock_result = MagicMock()
            if name == "get_analytics_overview_v2":
                mock_result.data = mock_overview_data
            elif name == "get_analytics_unique_items_v2":
                mock_result.data = mock_unique_items_data
            else:
                mock_result.data = {}
            mock_execute_chain.execute.return_value = mock_result
            return mock_execute_chain

        mock_sb.rpc.side_effect = mock_rpc

        with patch("routes.analytics.supabase", mock_sb), \
             patch("routes.analytics.data_cache") as mock_cache:
            # Make cache pass through to the fetch function
            mock_cache.get_or_fetch.side_effect = lambda prefix, fetch_fn, **kw: fetch_fn()

            result = await get_overview(
                user=mock_user,
                tenant_id=None,
                start_date="2025-01-01",
                end_date="2025-01-31",
                branches=None,
                categories=None,
            )

            assert isinstance(result, OverviewResponse)
            assert result.total_revenue == 2000000
            assert result.total_transactions == 800
            assert result.unique_items == 42


class TestMenuEngineeringEndpoint:
    @pytest.mark.asyncio
    async def test_empty_data_returns_empty_response(self):
        """When no menu items exist, endpoint should return empty items list."""
        from routes.analytics import get_menu_engineering

        mock_user = UserPayload(
            sub="test-user", role="owner", tenant_id="test-tenant"
        )

        mock_sb = MagicMock()
        mock_rpc_chain = MagicMock()
        mock_rpc_result = MagicMock()
        mock_rpc_result.data = []
        mock_rpc_chain.execute.return_value = mock_rpc_result
        mock_sb.rpc.return_value = mock_rpc_chain

        with patch("routes.analytics.supabase", mock_sb):
            result = await get_menu_engineering(
                user=mock_user,
                tenant_id=None,
                start_date=None,
                end_date=None,
                branches=None,
                categories=None,
                macro_category=None,
                min_price=None,
                max_price=None,
                min_quantity=None,
                core_only=False,
                current_only=False,
            )

            assert isinstance(result, MenuEngineeringResponse)
            assert len(result.items) == 0
            assert result.quadrant_summary == {"Star": 0, "Plowhorse": 0, "Puzzle": 0, "Dog": 0}

    @pytest.mark.asyncio
    async def test_items_get_quadrants_assigned(self):
        """Items should be assigned quadrants based on filtered medians."""
        from routes.analytics import get_menu_engineering

        mock_user = UserPayload(
            sub="test-user", role="owner", tenant_id="test-tenant"
        )

        # 3 items with v2 RPC shape: total_revenue instead of total_gross_revenue
        mock_items = [
            {
                "item_name": "Star Item",
                "category": "Food",
                "macro_category": "FOOD",
                "total_quantity": 200,
                "total_revenue": 4000000,
                "avg_price": 20000,
                "order_count": 180,
                "is_core_menu": True,
                "is_current_menu": True,
                "first_sale_date": "2025-01-01",
                "last_sale_date": "2025-01-31",
                "cost_cents": None,
                "cost_percentage": None,
            },
            {
                "item_name": "Plowhorse Item",
                "category": "Food",
                "macro_category": "FOOD",
                "total_quantity": 150,
                "total_revenue": 1500000,
                "avg_price": 10000,
                "order_count": 140,
                "is_core_menu": True,
                "is_current_menu": True,
                "first_sale_date": "2025-01-01",
                "last_sale_date": "2025-01-31",
                "cost_cents": None,
                "cost_percentage": None,
            },
            {
                "item_name": "Dog Item",
                "category": "Food",
                "macro_category": "FOOD",
                "total_quantity": 10,
                "total_revenue": 50000,
                "avg_price": 5000,
                "order_count": 8,
                "is_core_menu": True,
                "is_current_menu": True,
                "first_sale_date": "2025-01-01",
                "last_sale_date": "2025-01-31",
                "cost_cents": None,
                "cost_percentage": None,
            },
        ]

        mock_sb = MagicMock()
        mock_rpc_chain = MagicMock()
        mock_rpc_result = MagicMock()
        mock_rpc_result.data = mock_items
        mock_rpc_chain.execute.return_value = mock_rpc_result
        mock_sb.rpc.return_value = mock_rpc_chain

        with patch("routes.analytics.supabase", mock_sb):
            result = await get_menu_engineering(
                user=mock_user,
                tenant_id=None,
                start_date=None,
                end_date=None,
                branches=None,
                categories=None,
                macro_category=None,
                min_price=None,
                max_price=None,
                min_quantity=None,
                core_only=False,
                current_only=False,
            )

            assert len(result.items) == 3
            # Verify quadrants are assigned (not None)
            for item in result.items:
                assert item.quadrant in ("Star", "Plowhorse", "Puzzle", "Dog")

            # The star item (highest qty and price) should be Star
            star_item = next(i for i in result.items if i.item_name == "Star Item")
            assert star_item.quadrant == "Star"

            # Dog item (lowest qty and price) should be Dog
            dog_item = next(i for i in result.items if i.item_name == "Dog Item")
            assert dog_item.quadrant == "Dog"
