"""
Analytics API routes.
Provides dashboard data endpoints for menu engineering, dayparting, and performance analytics.
"""
import asyncio
from typing import Optional, List
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel

from middleware.auth import get_user_with_tenant, require_operator, UserPayload
from middleware.auth_helpers import get_effective_tenant_id
from db.supabase import supabase
from utils.cache import data_cache

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

# ============================================
# COMMON FILTER PARSING
# ============================================

class AnalyticsFilters(BaseModel):
    """Common filters for all analytics endpoints."""
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    branches: Optional[List[str]] = None
    categories: Optional[List[str]] = None


def parse_filters(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    branches: Optional[str] = None,
    categories: Optional[str] = None,
) -> AnalyticsFilters:
    """Parse query params into filters object."""
    return AnalyticsFilters(
        start_date=start_date,
        end_date=end_date,
        branches=branches.split(",") if branches else None,
        categories=categories.split(",") if categories else None,
    )


async def _cached_trends(effective_tenant_id: str, filters: AnalyticsFilters) -> dict:
    """Shared cached helper for get_analytics_trends_v2 RPC."""
    def fetch():
        return supabase.rpc("get_analytics_trends_v2", {
            "p_tenant_id": effective_tenant_id,
            "p_start_date": filters.start_date,
            "p_end_date": filters.end_date,
            "p_branches": filters.branches,
            "p_categories": filters.categories,
        }).execute().data or {}
    return await data_cache.get_or_fetch_async(
        prefix="analytics_trends",
        fetch_fn=fetch,
        ttl="short",
        tenant_id=effective_tenant_id,
        start_date=filters.start_date,
        end_date=filters.end_date,
        branches=str(filters.branches),
        categories=str(filters.categories),
    )


async def _cached_quadrants(effective_tenant_id: str, filters: AnalyticsFilters, item_name: str = None) -> list:
    """Shared cached helper for get_item_monthly_quadrants_v1 RPC."""
    def fetch():
        return supabase.rpc("get_item_monthly_quadrants_v1", {
            "p_tenant_id": effective_tenant_id,
            "p_start_date": filters.start_date,
            "p_end_date": filters.end_date,
            "p_branches": filters.branches,
            "p_categories": filters.categories,
            "p_item_name": item_name,
        }).execute().data or []
    return await data_cache.get_or_fetch_async(
        prefix="analytics_quadrant_timeline" if item_name is None else "analytics_item_history",
        fetch_fn=fetch,
        ttl="short",
        tenant_id=effective_tenant_id,
        start_date=filters.start_date,
        end_date=filters.end_date,
        branches=str(filters.branches),
        categories=str(filters.categories),
        item_name=item_name,
    )


def apply_transaction_filters(query, tenant_id: str, filters: AnalyticsFilters):
    """Apply common filters to a transactions query."""
    query = query.eq("tenant_id", tenant_id)

    if filters.start_date:
        query = query.gte("receipt_timestamp", filters.start_date)
    if filters.end_date:
        # Add time to include full end date
        query = query.lte("receipt_timestamp", f"{filters.end_date}T23:59:59")
    if filters.branches:
        query = query.in_("store_name", filters.branches)
    if filters.categories:
        query = query.in_("category", filters.categories)

    return query


# ============================================
# RESPONSE MODELS
# ============================================

class OverviewResponse(BaseModel):
    """KPI summary response."""
    total_revenue: float  # now float for v2 compatibility
    total_transactions: int
    unique_receipts: int
    avg_ticket: float  # now float for v2 compatibility
    unique_items: int
    period_growth: Optional[float] = None  # percentage vs previous period
    filters_applied: dict
    generated_at: str


class MenuEngineeringItem(BaseModel):
    """Single item in menu engineering analysis."""
    item_name: str
    category: str = "Uncategorized"
    macro_category: str = "OTHER"
    quadrant: str = "Dog"
    total_quantity: int
    total_revenue: int  # cents
    avg_price: int  # cents
    order_count: int
    is_core_menu: bool
    is_current_menu: bool
    first_sale_date: Optional[str] = None
    last_sale_date: Optional[str] = None
    # Cost fields (nullable until populated)
    cost_cents: Optional[int] = None
    cost_percentage: Optional[float] = None


class MenuEngineeringResponse(BaseModel):
    """Menu engineering analysis response."""
    items: List[MenuEngineeringItem]
    quadrant_summary: dict
    median_quantity: float
    median_price: float
    filters_applied: dict
    generated_at: str


class DaypartData(BaseModel):
    """Data for a single daypart."""
    daypart: str
    revenue: int  # cents
    transactions: int
    quantity: int
    avg_ticket: float  # cents (float from v2 aggregation)
    percentage_of_total: float


class DaypartingResponse(BaseModel):
    """Dayparting analysis response."""
    dayparts: List[DaypartData]
    peak_daypart: str
    filters_applied: dict
    generated_at: str


class HourlyHeatmapData(BaseModel):
    """Data for a single hour/day cell in heatmap."""
    day: int  # 0=Monday, 6=Sunday
    hour: int  # 0-23
    revenue: int  # cents
    transactions: int


class HourlyHeatmapResponse(BaseModel):
    """Hourly heatmap response."""
    data: List[HourlyHeatmapData]
    filters_applied: dict
    generated_at: str


class DailyBreakdownItem(BaseModel):
    """Daily revenue reconciliation breakdown."""
    date: str
    net_sales: int
    tax: int
    service_charge: int
    discounts: int
    transactions: int


class DailyBreakdownResponse(BaseModel):
    """Daily breakdown response."""
    days: List[DailyBreakdownItem]
    filters_applied: dict
    generated_at: str


class CategoryData(BaseModel):
    """Data for a single category."""
    category: str
    macro_category: str
    revenue: int  # cents
    quantity: int
    item_count: int
    avg_price: float  # cents (float from v2 aggregation)
    percentage_of_revenue: float


class CategoriesResponse(BaseModel):
    """Category breakdown response."""
    categories: List[CategoryData]
    macro_totals: dict
    filters_applied: dict
    generated_at: str


class CategoryItemData(BaseModel):
    """Individual item within a category."""
    item_name: str
    quantity: int
    revenue: int  # cents
    avg_price: float  # cents
    percentage_of_category: float


class CategoryItemsResponse(BaseModel):
    """Items within a specific category."""
    category: str
    items: List[CategoryItemData]
    total_items: int
    total_revenue: int
    total_quantity: int
    truncated: bool = False
    max_rows: Optional[int] = None
    filters_applied: dict
    generated_at: str


class BranchCategoryData(BaseModel):
    """Performance of a category at a specific branch."""
    branch: str
    revenue: int  # cents
    quantity: int
    avg_price: float  # cents
    item_count: int
    percentage_of_branch: float  # What % of this branch's total is this category
    top_item: str


class CategoryByBranchResponse(BaseModel):
    """Category performance across branches."""
    category: str
    branches: List[BranchCategoryData]
    truncated: bool = False
    max_rows: Optional[int] = None
    filters_applied: dict
    generated_at: str


class BundlePair(BaseModel):
    """A frequently purchased item pair."""
    item_a: str
    item_b: str
    frequency: int  # times purchased together
    support: float  # percentage of receipts containing this pair


class BundlesResponse(BaseModel):
    """Market basket analysis response."""
    pairs: List[BundlePair]
    total_receipts_analyzed: int
    filters_applied: dict
    generated_at: str


class PerformanceResponse(BaseModel):
    """Condensed performance overview."""
    summary: dict
    trends: dict
    branches: Optional[List[dict]] = None
    filters_applied: dict
    generated_at: str


class TrendsResponse(BaseModel):
    """Detailed time trends."""
    daily: List[dict]
    weekly: List[dict]
    monthly: List[dict]
    growth_metrics: dict
    filters_applied: dict
    generated_at: str


class BranchesResponse(BaseModel):
    """Detailed branch comparison."""
    branches: List[dict]
    comparison_metrics: dict
    filters_applied: dict
    generated_at: str


class DayOfWeekAverage(BaseModel):
    """Average metrics for a specific day of week."""
    day: int  # 0=Monday, 6=Sunday
    day_name: str
    avg_revenue: int  # cents
    avg_transactions: int
    total_days: int


class SameDayDataPoint(BaseModel):
    """Revenue for a specific day instance."""
    date: str
    day_name: str
    revenue: int  # cents
    transactions: int


class DayOfWeekResponse(BaseModel):
    """Day of week analysis response."""
    daily_averages: List[DayOfWeekAverage]
    same_day_trend: List[SameDayDataPoint]
    best_day: dict
    worst_day: dict
    filters_applied: dict
    generated_at: str


class YearOverYearPeriod(BaseModel):
    """Data for a specific year/month."""
    year: int
    month: int
    month_name: str
    revenue: int  # cents
    transactions: int
    avg_ticket: int  # cents


class YearOverYearResponse(BaseModel):
    """Year over year comparison response."""
    periods: List[YearOverYearPeriod]
    growth_yoy: Optional[float]  # percentage
    month: int
    month_name: str
    filters_applied: dict
    generated_at: str


class HourlyBreakdownItem(BaseModel):
    """Data for a single hour of the day."""
    hour: int  # 0-23
    revenue: int  # cents
    transactions: int
    quantity: int


class TopItemData(BaseModel):
    """Single item in top/bottom lists."""
    item_name: str
    quantity: int
    revenue: int  # cents


class DayComparisonData(BaseModel):
    """Comparison to the same day last week."""
    prior_date: str
    prior_revenue: int
    prior_transactions: int
    revenue_change_pct: Optional[float] = None
    transactions_change_pct: Optional[float] = None
    top_items_overlap: int  # How many top 10 items appear in both


class DayBreakdownResponse(BaseModel):
    """Complete breakdown of a single day's performance."""
    date: str  # YYYY-MM-DD
    day_name: str  # "Monday", "Tuesday", etc.

    # Summary metrics
    total_revenue: int  # cents
    total_transactions: int
    total_quantity: int
    avg_ticket: int  # cents

    # Hourly breakdown (24 data points)
    hourly: List[HourlyBreakdownItem]
    peak_hour: int  # Hour with highest revenue

    # Item performance
    top_items: List[TopItemData]  # Top 10
    bottom_items: List[TopItemData]  # Bottom 10

    # Week-over-week comparison
    comparison: Optional[DayComparisonData] = None

    filters_applied: dict
    generated_at: str


# ============================================
# OVERVIEW ENDPOINT
# ============================================

@router.get("/overview", response_model=OverviewResponse)
async def get_overview(
    user: UserPayload = Depends(get_user_with_tenant),
    tenant_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    branches: Optional[str] = None,
    categories: Optional[str] = None,
):
    """
    Get KPI summary cards data.

    Returns total revenue, transaction count, average ticket, etc.
    Uses database-level aggregation via RPC for fast performance.
    Cached for 30 seconds.
    """
    effective_tenant_id = get_effective_tenant_id(user, tenant_id)
    filters = parse_filters(start_date, end_date, branches, categories)

    def fetch_overview():
        return supabase.rpc("get_analytics_overview_v2", {
            "p_tenant_id": effective_tenant_id,
            "p_start_date": filters.start_date,
            "p_end_date": filters.end_date,
            "p_branches": filters.branches,
            "p_categories": filters.categories,
        }).execute().data or {}

    def fetch_unique_items():
        result = supabase.rpc("get_analytics_unique_items_v2", {
            "p_tenant_id": effective_tenant_id,
            "p_start_date": filters.start_date,
            "p_end_date": filters.end_date,
            "p_branches": filters.branches,
            "p_categories": filters.categories,
        }).execute()
        return result.data

    async def _get_overview():
        return await data_cache.get_or_fetch_async(
            prefix="analytics_overview",
            fetch_fn=fetch_overview,
            ttl="short",
            tenant_id=effective_tenant_id,
            start_date=filters.start_date,
            end_date=filters.end_date,
            branches=str(filters.branches),
            categories=str(filters.categories),
        )

    async def _get_unique_items():
        return await data_cache.get_or_fetch_async(
            prefix="analytics_unique_items",
            fetch_fn=fetch_unique_items,
            ttl="short",
            tenant_id=effective_tenant_id,
            start_date=filters.start_date,
            end_date=filters.end_date,
            branches=str(filters.branches),
            categories=str(filters.categories),
        )

    async def _get_prev_period():
        if not (filters.start_date and filters.end_date):
            return None
        try:
            start = datetime.fromisoformat(filters.start_date.replace("Z", ""))
            end = datetime.fromisoformat(filters.end_date.replace("Z", ""))
            period_days = (end - start).days + 1
            prev_end = start - timedelta(days=1)
            prev_start = prev_end - timedelta(days=period_days - 1)

            def fetch_prev():
                return supabase.rpc("get_analytics_overview_v2", {
                    "p_tenant_id": effective_tenant_id,
                    "p_start_date": prev_start.isoformat()[:10],
                    "p_end_date": prev_end.isoformat()[:10],
                    "p_branches": filters.branches,
                    "p_categories": filters.categories,
                }).execute().data or {}

            return await data_cache.get_or_fetch_async(
                prefix="analytics_overview_prev",
                fetch_fn=fetch_prev,
                ttl="short",
                tenant_id=effective_tenant_id,
                start_date=prev_start.isoformat()[:10],
                end_date=prev_end.isoformat()[:10],
                branches=str(filters.branches),
                categories=str(filters.categories),
            )
        except Exception:
            return None

    # Run all 3 concurrently
    data, unique_raw, prev_data = await asyncio.gather(
        _get_overview(), _get_unique_items(), _get_prev_period()
    )

    # Parse unique_items (keep existing isinstance logic)
    unique_items = 0
    try:
        unique_data = unique_raw
        if isinstance(unique_data, int):
            unique_items = unique_data
        elif isinstance(unique_data, list) and unique_data:
            if isinstance(unique_data[0], dict):
                unique_items = unique_data[0].get("unique_items", 0) or unique_data[0].get("count", 0) or 0
            else:
                unique_items = unique_data[0] or 0
        elif isinstance(unique_data, dict):
            unique_items = unique_data.get("unique_items", 0) or 0
    except Exception:
        pass

    # Calculate growth from prev_data
    period_growth = None
    if prev_data is not None:
        try:
            prev_revenue = prev_data.get("total_revenue", 0)
            current_revenue = data.get("total_revenue", 0)
            if prev_revenue > 0:
                period_growth = round(((current_revenue - prev_revenue) / prev_revenue) * 100, 1)
        except Exception:
            pass

    return OverviewResponse(
        total_revenue=data.get("total_revenue", 0),
        total_transactions=data.get("total_transactions", 0),
        unique_receipts=data.get("unique_receipts", 0),
        avg_ticket=data.get("avg_ticket", 0),
        unique_items=unique_items,
        period_growth=period_growth,
        filters_applied=filters.model_dump(exclude_none=True),
        generated_at=datetime.utcnow().isoformat(),
    )


# ============================================
# MENU ENGINEERING ENDPOINT
# ============================================

def calculate_quadrant(quantity: int, price: int, median_quantity: float, median_price: float) -> str:
    """
    Calculate menu engineering quadrant based on quantity and price vs medians.

    Quadrants:
    - Star: High popularity (qty >= median) AND High profitability (price >= median)
    - Plowhorse: High popularity AND Low profitability
    - Puzzle: Low popularity AND High profitability
    - Dog: Low popularity AND Low profitability
    """
    high_popularity = quantity >= median_quantity
    high_profitability = price >= median_price

    if high_popularity and high_profitability:
        return "Star"
    elif high_popularity and not high_profitability:
        return "Plowhorse"
    elif not high_popularity and high_profitability:
        return "Puzzle"
    else:
        return "Dog"


@router.get("/menu-engineering", response_model=MenuEngineeringResponse)
async def get_menu_engineering(
    user: UserPayload = Depends(get_user_with_tenant),
    tenant_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    branches: Optional[str] = None,
    categories: Optional[str] = None,
    macro_category: Optional[str] = None,
    min_price: Optional[int] = None,
    max_price: Optional[int] = None,
    min_quantity: Optional[int] = None,
    core_only: bool = False,
    current_only: bool = False,
):
    """
    Get menu engineering quadrant analysis.

    Returns items classified into Star, Plowhorse, Puzzle, Dog quadrants
    based on popularity (quantity) and profitability (avg price as proxy).

    Quadrants are calculated DYNAMICALLY based on the filtered dataset's medians,
    not pre-stored values. This means an item's quadrant may change based on filters.

    Args:
        macro_category: Filter by macro category (FOOD, BEVERAGE, ALCOHOL, SWEETS, RETAIL, OTHER).
                       Pass 'ALL' or omit to include all items.
        min_price: Minimum average price in cents (e.g., 10000 = ₱100)
        max_price: Maximum average price in cents
        min_quantity: Minimum quantity sold
    """
    effective_tenant_id = get_effective_tenant_id(user, tenant_id)
    filters = parse_filters(start_date, end_date, branches, categories)

    def fetch_menu_engineering():
        return supabase.rpc("get_item_totals_v2", {
            "p_tenant_id": effective_tenant_id,
            "p_start_date": filters.start_date,
            "p_end_date": filters.end_date,
            "p_branches": filters.branches,
            "p_categories": filters.categories,
            "p_macro_category": macro_category,
            "p_core_only": core_only,
            "p_current_only": current_only,
            "p_min_price": min_price,
            "p_max_price": max_price,
            "p_min_quantity": min_quantity,
            "p_exclude_excluded": True,
        }).execute().data or []

    data = await data_cache.get_or_fetch_async(
        prefix="analytics_menu_engineering",
        fetch_fn=fetch_menu_engineering,
        ttl="short",
        tenant_id=effective_tenant_id,
        start_date=filters.start_date,
        end_date=filters.end_date,
        branches=str(filters.branches),
        categories=str(filters.categories),
        macro_category=macro_category,
        core_only=core_only,
        current_only=current_only,
        min_price=min_price,
        max_price=max_price,
        min_quantity=min_quantity,
    )

    if not data:
        return MenuEngineeringResponse(
            items=[],
            quadrant_summary={"Star": 0, "Plowhorse": 0, "Puzzle": 0, "Dog": 0},
            median_quantity=0,
            median_price=0,
            filters_applied=filters.model_dump(exclude_none=True),
            generated_at=datetime.utcnow().isoformat(),
        )

    # Calculate medians from FILTERED data
    quantities = sorted([row.get("total_quantity", 0) or 0 for row in data])
    prices = sorted([row.get("avg_price", 0) or 0 for row in data])

    mid = len(quantities) // 2
    median_quantity = quantities[mid] if len(quantities) % 2 else (quantities[mid-1] + quantities[mid]) / 2
    median_price = prices[mid] if len(prices) % 2 else (prices[mid-1] + prices[mid]) / 2

    # Build response items with DYNAMICALLY calculated quadrants
    items = []
    quadrant_counts = {"Star": 0, "Plowhorse": 0, "Puzzle": 0, "Dog": 0}

    for row in data:
        # Calculate quadrant based on filtered medians (not pre-stored value)
        item_quantity = row.get("total_quantity", 0) or 0
        item_price = row.get("avg_price", 0) or 0
        quadrant = calculate_quadrant(item_quantity, item_price, median_quantity, median_price)

        quadrant_counts[quadrant] += 1

        items.append(MenuEngineeringItem(
            item_name=row.get("item_name") or "Unknown",
            category=row.get("category") or "Uncategorized",
            macro_category=row.get("macro_category") or "OTHER",
            quadrant=quadrant,
            total_quantity=item_quantity,
            total_revenue=row.get("total_revenue", 0) or 0,
            avg_price=item_price,
            order_count=row.get("order_count", 0) or 0,
            is_core_menu=row.get("is_core_menu") or False,
            is_current_menu=row.get("is_current_menu") or False,
            first_sale_date=row.get("first_sale_date"),
            last_sale_date=row.get("last_sale_date"),
            cost_cents=row.get("cost_cents"),
            cost_percentage=row.get("cost_percentage"),
        ))

    return MenuEngineeringResponse(
        items=items,
        quadrant_summary=quadrant_counts,
        median_quantity=median_quantity,
        median_price=median_price,
        filters_applied=filters.model_dump(exclude_none=True),
        generated_at=datetime.utcnow().isoformat(),
    )


# ============================================
# MENU ENGINEERING DEBUG ENDPOINT
# ============================================

@router.get("/menu-engineering/debug")
async def debug_menu_engineering(
    user: UserPayload = Depends(require_operator),
    tenant_id: Optional[str] = None,
):
    """
    Debug endpoint for diagnosing menu engineering data issues.
    Operator-only - returns diagnostic data for troubleshooting.

    Returns counts and sample data to identify why data might not be displaying.
    """
    effective_tenant_id = get_effective_tenant_id(user, tenant_id)

    debug_info = {
        "tenant_id": effective_tenant_id,
        "counts": {},
        "sample_items": [],
        "diagnosis": [],
    }

    # Count total menu items for tenant
    total_result = supabase.table("menu_items").select("id", count="exact") \
        .eq("tenant_id", effective_tenant_id).execute()
    debug_info["counts"]["total"] = total_result.count or 0

    # Count by is_excluded
    excluded_result = supabase.table("menu_items").select("id", count="exact") \
        .eq("tenant_id", effective_tenant_id).eq("is_excluded", True).execute()
    debug_info["counts"]["is_excluded_true"] = excluded_result.count or 0

    not_excluded_result = supabase.table("menu_items").select("id", count="exact") \
        .eq("tenant_id", effective_tenant_id).eq("is_excluded", False).execute()
    debug_info["counts"]["is_excluded_false"] = not_excluded_result.count or 0

    # Count by is_core_menu
    core_result = supabase.table("menu_items").select("id", count="exact") \
        .eq("tenant_id", effective_tenant_id).eq("is_core_menu", True).execute()
    debug_info["counts"]["is_core_menu_true"] = core_result.count or 0

    # Count items with NULL quadrant
    null_quadrant_result = supabase.table("menu_items").select("id", count="exact") \
        .eq("tenant_id", effective_tenant_id).is_("quadrant", "null").execute()
    debug_info["counts"]["quadrant_null"] = null_quadrant_result.count or 0

    # Count items with non-NULL quadrant
    has_quadrant_result = supabase.table("menu_items").select("id", count="exact") \
        .eq("tenant_id", effective_tenant_id).not_.is_("quadrant", "null").execute()
    debug_info["counts"]["quadrant_set"] = has_quadrant_result.count or 0

    # Sample items (first 10)
    sample_result = supabase.table("menu_items") \
        .select("item_name, is_excluded, is_core_menu, quadrant, total_quantity, avg_price") \
        .eq("tenant_id", effective_tenant_id) \
        .limit(10) \
        .execute()
    debug_info["sample_items"] = sample_result.data or []

    # Generate diagnosis messages
    counts = debug_info["counts"]
    if counts["total"] == 0:
        debug_info["diagnosis"].append("No menu items found for this tenant. Run /data/menu-items/regenerate")
    elif counts["is_excluded_false"] == 0:
        debug_info["diagnosis"].append("All items are marked as excluded. Check transaction is_excluded values.")
    elif counts["quadrant_null"] == counts["is_excluded_false"]:
        debug_info["diagnosis"].append(
            "All non-excluded items have NULL quadrant. "
            "Current aggregation only sets quadrant for is_core_menu=TRUE items. "
            "Run migration 010 to fix this, then regenerate."
        )
    elif counts["quadrant_set"] > 0 and counts["is_excluded_false"] > 0:
        debug_info["diagnosis"].append(
            f"Data looks OK: {counts['is_excluded_false']} non-excluded items, "
            f"{counts['quadrant_set']} with quadrants. Check frontend filters or errors."
        )

    return debug_info


# ============================================
# DAYPARTING ENDPOINT
# ============================================

# Daypart definitions (Philippines Time - UTC+8)
DAYPARTS = {
    "breakfast": (6, 11),   # 6:00 AM - 10:59 AM
    "lunch": (11, 15),      # 11:00 AM - 2:59 PM
    "dinner": (15, 21),     # 3:00 PM - 8:59 PM
    "late_night": (21, 6),  # 9:00 PM - 5:59 AM (wraps around midnight)
}


def get_daypart(hour: int) -> str:
    """Assign hour to daypart. Hour should be in local timezone (UTC+8)."""
    if 6 <= hour < 11:
        return "breakfast"
    elif 11 <= hour < 15:
        return "lunch"
    elif 15 <= hour < 21:
        return "dinner"
    else:  # 21-23 or 0-5
        return "late_night"


@router.get("/dayparting", response_model=DaypartingResponse)
async def get_dayparting(
    user: UserPayload = Depends(get_user_with_tenant),
    tenant_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    branches: Optional[str] = None,
    categories: Optional[str] = None,
):
    """
    Get sales breakdown by time of day.

    Aggregates transactions into 4 dayparts:
    - Breakfast (6:00-11:00)
    - Lunch (11:00-15:00)
    - Dinner (15:00-21:00)
    - Late Night (21:00-6:00)
    Cached for 30 seconds.
    """
    effective_tenant_id = get_effective_tenant_id(user, tenant_id)
    filters = parse_filters(start_date, end_date, branches, categories)

    def fetch_dayparting():
        return supabase.rpc("get_analytics_dayparting_v2", {
            "p_tenant_id": effective_tenant_id,
            "p_start_date": filters.start_date,
            "p_end_date": filters.end_date,
            "p_branches": filters.branches,
            "p_categories": filters.categories,
        }).execute().data or {}

    data = await data_cache.get_or_fetch_async(
        prefix="analytics_dayparting",
        fetch_fn=fetch_dayparting,
        ttl="short",
        tenant_id=effective_tenant_id,
        start_date=filters.start_date,
        end_date=filters.end_date,
        branches=str(filters.branches),
        categories=str(filters.categories),
    )
    dayparts_data = data.get("dayparts") or []

    dayparts = []
    for dp in dayparts_data:
        dayparts.append(DaypartData(
            daypart=dp.get("daypart", ""),
            revenue=dp.get("revenue", 0),
            transactions=dp.get("transactions", 0),
            quantity=dp.get("quantity", 0),
            avg_ticket=dp.get("avg_ticket", 0),
            percentage_of_total=dp.get("percentage_of_total", 0),
        ))

    return DaypartingResponse(
        dayparts=dayparts,
        peak_daypart=data.get("peak_daypart", "lunch"),
        filters_applied=filters.model_dump(exclude_none=True),
        generated_at=datetime.utcnow().isoformat(),
    )


# ============================================
# HOURLY HEATMAP ENDPOINT
# ============================================

@router.get("/hourly-heatmap", response_model=HourlyHeatmapResponse)
async def get_hourly_heatmap(
    user: UserPayload = Depends(get_user_with_tenant),
    tenant_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    branches: Optional[str] = None,
    categories: Optional[str] = None,
):
    """
    Get sales data aggregated by day of week and hour.

    Returns a 7x24 grid (day x hour) of revenue and transaction counts.
    Uses database-level aggregation via RPC for fast performance.
    Cached for 30 seconds.
    """
    effective_tenant_id = get_effective_tenant_id(user, tenant_id)
    filters = parse_filters(start_date, end_date, branches, categories)

    def fetch_heatmap():
        # V2 returns {"data": [...]} so extract the data array
        result = supabase.rpc("get_analytics_heatmap_v2", {
            "p_tenant_id": effective_tenant_id,
            "p_start_date": filters.start_date,
            "p_end_date": filters.end_date,
            "p_branches": filters.branches,
            "p_categories": filters.categories,
        }).execute().data or {}
        return result.get("data", []) if isinstance(result, dict) else []

    raw_data = await data_cache.get_or_fetch_async(
        prefix="analytics_heatmap",
        fetch_fn=fetch_heatmap,
        ttl="short",
        tenant_id=effective_tenant_id,
        start_date=filters.start_date,
        end_date=filters.end_date,
        branches=str(filters.branches),
        categories=str(filters.categories),
    )

    # Convert to response format - fill in missing day/hour combinations with zeros
    grid = {}
    for day in range(7):
        for hour in range(24):
            grid[(day, hour)] = {"revenue": 0, "transactions": 0}

    for item in raw_data:
        # PostgreSQL DOW: 0=Sunday, 6=Saturday. Convert to 0=Monday, 6=Sunday
        pg_dow = item.get("day", 0)
        day = (pg_dow + 6) % 7  # Convert Sunday=0 to Sunday=6
        hour = item.get("hour", 0)
        grid[(day, hour)] = {
            "revenue": item.get("revenue", 0),
            "transactions": item.get("transactions", 0),
        }

    heatmap_data = [
        HourlyHeatmapData(day=day, hour=hour, revenue=cell["revenue"], transactions=cell["transactions"])
        for (day, hour), cell in grid.items()
    ]

    return HourlyHeatmapResponse(
        data=heatmap_data,
        filters_applied=filters.model_dump(exclude_none=True),
        generated_at=datetime.utcnow().isoformat(),
    )


# ============================================
# CATEGORIES ENDPOINT
# ============================================

@router.get("/categories", response_model=CategoriesResponse)
async def get_categories(
    user: UserPayload = Depends(get_user_with_tenant),
    tenant_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    branches: Optional[str] = None,
    include_excluded: bool = False,
):
    """
    Get category breakdown with revenue and quantity.

    Groups data by category and macro_category.
    By default excludes categories marked for exclusion (drinks, extras, etc.)
    Cached for 30 seconds.
    """
    effective_tenant_id = get_effective_tenant_id(user, tenant_id)
    filters = parse_filters(start_date, end_date, branches, None)  # Don't filter by category here

    def fetch_categories():
        # v2 uses summary tables which exclude is_excluded items.
        # If include_excluded is requested, fall back to the v1 function.
        if include_excluded:
            return supabase.rpc("get_analytics_categories", {
                "p_tenant_id": effective_tenant_id,
                "p_start_date": filters.start_date,
                "p_end_date": filters.end_date,
                "p_branches": filters.branches,
                "p_include_excluded": True,
            }).execute().data or {}

        return supabase.rpc("get_analytics_categories_v2", {
            "p_tenant_id": effective_tenant_id,
            "p_start_date": filters.start_date,
            "p_end_date": filters.end_date,
            "p_branches": filters.branches,
        }).execute().data or {}

    data = await data_cache.get_or_fetch_async(
        prefix="analytics_categories",
        fetch_fn=fetch_categories,
        ttl="short",
        tenant_id=effective_tenant_id,
        start_date=filters.start_date,
        end_date=filters.end_date,
        branches=str(filters.branches),
        include_excluded=include_excluded,
    )
    categories_data = data.get("categories") or []

    categories = [
        CategoryData(
            category=c.get("category", "Unknown"),
            macro_category=c.get("macro_category", "OTHER"),
            revenue=c.get("revenue", 0),
            quantity=c.get("quantity", 0),
            item_count=c.get("item_count", 0),
            avg_price=c.get("avg_price", 0),
            percentage_of_revenue=c.get("percentage_of_revenue", 0),
        )
        for c in categories_data
    ]

    return CategoriesResponse(
        categories=categories,
        macro_totals=data.get("macro_totals") or {},
        filters_applied=filters.model_dump(exclude_none=True),
        generated_at=datetime.utcnow().isoformat(),
    )


# ============================================
# CATEGORY ITEMS ENDPOINT
# ============================================

@router.get("/category-items", response_model=CategoryItemsResponse)
async def get_category_items(
    category: str = Query(..., description="Category name to fetch items for"),
    user: UserPayload = Depends(get_user_with_tenant),
    tenant_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    branches: Optional[str] = None,
):
    """
    Get item-level breakdown for a specific category.

    Supports branch filtering - queries transactions directly.
    This allows users to see how items within a category perform at specific branches.
    Cached for 30 seconds.
    """
    effective_tenant_id = get_effective_tenant_id(user, tenant_id)
    filters = parse_filters(start_date, end_date, branches, None)

    def fetch_category_items():
        # Use server-side aggregation via RPC
        result = supabase.rpc("get_item_totals_v2", {
            "p_tenant_id": effective_tenant_id,
            "p_start_date": filters.start_date,
            "p_end_date": filters.end_date,
            "p_branches": filters.branches,
            "p_categories": [category],
        }).execute()

        items_data = result.data or []
        total_revenue = sum((row.get("total_revenue", 0) or 0) for row in items_data)
        total_quantity = sum((row.get("total_quantity", 0) or 0) for row in items_data)

        # Build items list sorted by revenue descending
        items = []
        for row in sorted(items_data, key=lambda x: x.get("total_revenue", 0) or 0, reverse=True):
            revenue = row.get("total_revenue", 0) or 0
            quantity = row.get("total_quantity", 0) or 0
            pct = (revenue / total_revenue * 100) if total_revenue > 0 else 0
            avg_price = (revenue / quantity) if quantity > 0 else 0

            items.append({
                "item_name": row.get("item_name", "Unknown"),
                "quantity": quantity,
                "revenue": revenue,
                "avg_price": round(avg_price, 2),
                "percentage_of_category": round(pct, 1),
            })

        return {
            "items": items,
            "total_revenue": total_revenue,
            "total_quantity": total_quantity,
            "truncated": False,
            "max_rows": None,
        }

    data = await data_cache.get_or_fetch_async(
        prefix="analytics_category_items",
        fetch_fn=fetch_category_items,
        ttl="short",
        tenant_id=effective_tenant_id,
        category=category,
        start_date=filters.start_date,
        end_date=filters.end_date,
        branches=str(filters.branches),
    )

    return CategoryItemsResponse(
        category=category,
        items=[CategoryItemData(**item) for item in data.get("items", [])],
        total_items=len(data.get("items", [])),
        total_revenue=data.get("total_revenue", 0),
        total_quantity=data.get("total_quantity", 0),
        truncated=data.get("truncated", False),
        max_rows=data.get("max_rows"),
        filters_applied={
            "category": category,
            **filters.model_dump(exclude_none=True),
        },
        generated_at=datetime.utcnow().isoformat(),
    )


# ============================================
# CATEGORY BY BRANCH ENDPOINT
# ============================================

@router.get("/category-by-branch", response_model=CategoryByBranchResponse)
async def get_category_by_branch(
    category: str = Query(..., description="Category name to analyze across branches"),
    user: UserPayload = Depends(get_user_with_tenant),
    tenant_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    """
    Get performance of a single category across all branches.

    Useful for comparing how a category performs at different locations.
    Cached for 30 seconds.
    """
    effective_tenant_id = get_effective_tenant_id(user, tenant_id)
    filters = parse_filters(start_date, end_date, None, None)

    def fetch_category_by_branch():
        # Use database-level aggregation via RPC
        result = supabase.rpc("get_category_by_branch_agg", {
            "p_tenant_id": effective_tenant_id,
            "p_category": category,
            "p_start_date": filters.start_date,
            "p_end_date": filters.end_date,
        }).execute()

        branches = result.data or []

        return {
            "branches": branches,
            "truncated": False,
            "max_rows": None,
        }

    data = await data_cache.get_or_fetch_async(
        prefix="analytics_category_by_branch",
        fetch_fn=fetch_category_by_branch,
        ttl="short",
        tenant_id=effective_tenant_id,
        category=category,
        start_date=filters.start_date,
        end_date=filters.end_date,
    )

    return CategoryByBranchResponse(
        category=category,
        branches=[BranchCategoryData(**b) for b in data.get("branches", [])],
        truncated=data.get("truncated", False),
        max_rows=data.get("max_rows"),
        filters_applied={
            "category": category,
            **filters.model_dump(exclude_none=True),
        },
        generated_at=datetime.utcnow().isoformat(),
    )


# ============================================
# BUNDLES (MARKET BASKET) ENDPOINT
# ============================================

@router.get("/bundles", response_model=BundlesResponse)
async def get_bundles(
    user: UserPayload = Depends(get_user_with_tenant),
    tenant_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    branches: Optional[str] = None,
    min_frequency: int = 3,  # Lowered from 5 for better results
    limit: int = 20,
):
    """
    Get frequently purchased item pairs (market basket analysis).

    Finds items that commonly appear together on the same receipt.
    Returns pairs sorted by frequency.

    Uses database-level aggregation via RPC for fast performance.
    Cached for 30 seconds.
    """
    effective_tenant_id = get_effective_tenant_id(user, tenant_id)
    filters = parse_filters(start_date, end_date, branches, None)

    def fetch_bundles():
        return supabase.rpc("get_analytics_bundles_v2", {
            "p_tenant_id": effective_tenant_id,
            "p_start_date": filters.start_date,
            "p_end_date": filters.end_date,
            "p_branches": filters.branches,
            "p_min_frequency": min_frequency,
            "p_limit": limit,
        }).execute().data or {}

    data = await data_cache.get_or_fetch_async(
        prefix="analytics_bundles",
        fetch_fn=fetch_bundles,
        ttl="short",
        tenant_id=effective_tenant_id,
        start_date=filters.start_date,
        end_date=filters.end_date,
        branches=str(filters.branches),
        min_frequency=min_frequency,
        limit=limit,
    )
    pairs_data = data.get("pairs") or []
    total_receipts = data.get("total_receipts") or 0

    # Build response
    pairs = [
        BundlePair(
            item_a=p.get("item_a", ""),
            item_b=p.get("item_b", ""),
            frequency=p.get("frequency", 0),
            support=p.get("support", 0),
        )
        for p in pairs_data
    ]

    return BundlesResponse(
        pairs=pairs,
        total_receipts_analyzed=total_receipts,
        filters_applied=filters.model_dump(exclude_none=True),
        generated_at=datetime.utcnow().isoformat(),
    )


# ============================================
# PERFORMANCE ENDPOINTS
# ============================================

@router.get("/performance", response_model=PerformanceResponse)
async def get_performance(
    user: UserPayload = Depends(get_user_with_tenant),
    tenant_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    branches: Optional[str] = None,
    categories: Optional[str] = None,
):
    """
    Get condensed performance overview.

    Returns summary stats, recent trends, and branch breakdown.
    Uses database-level aggregation via RPC for fast performance.
    Cached for 30 seconds.
    """
    effective_tenant_id = get_effective_tenant_id(user, tenant_id)
    filters = parse_filters(start_date, end_date, branches, categories)

    def fetch_performance():
        return supabase.rpc("get_analytics_performance_v2", {
            "p_tenant_id": effective_tenant_id,
            "p_start_date": filters.start_date,
            "p_end_date": filters.end_date,
            "p_branches": filters.branches,
            "p_categories": filters.categories,
        }).execute().data or {}

    data = await data_cache.get_or_fetch_async(
        prefix="analytics_performance",
        fetch_fn=fetch_performance,
        ttl="short",
        tenant_id=effective_tenant_id,
        start_date=filters.start_date,
        end_date=filters.end_date,
        branches=str(filters.branches),
        categories=str(filters.categories),
    )

    return PerformanceResponse(
        summary=data.get("summary") or {"total_revenue": 0, "total_transactions": 0, "avg_ticket": 0},
        trends=data.get("trends") or {"daily_avg": 0, "best_day": None, "worst_day": None},
        branches=data.get("branches"),
        filters_applied=filters.model_dump(exclude_none=True),
        generated_at=datetime.utcnow().isoformat(),
    )


@router.get("/performance/trends", response_model=TrendsResponse)
async def get_performance_trends(
    user: UserPayload = Depends(get_user_with_tenant),
    tenant_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    branches: Optional[str] = None,
    categories: Optional[str] = None,
):
    """
    Get detailed time series trends.

    Returns daily, weekly, and monthly aggregates plus growth metrics.
    Uses database-level aggregation via RPC for fast performance.
    Cached for 30 seconds.
    """
    effective_tenant_id = get_effective_tenant_id(user, tenant_id)
    filters = parse_filters(start_date, end_date, branches, categories)

    data = await _cached_trends(effective_tenant_id, filters)

    daily_list = data.get("daily") or []
    weekly_list = data.get("weekly") or []
    monthly_list = data.get("monthly") or []

    # Calculate growth metrics from the data
    growth_metrics = {}
    if len(monthly_list) >= 2:
        current = monthly_list[-1].get("revenue", 0)
        previous = monthly_list[-2].get("revenue", 0)
        if previous > 0:
            growth_metrics["month_over_month"] = round(((current - previous) / previous) * 100, 1)

    if len(weekly_list) >= 2:
        current = weekly_list[-1].get("revenue", 0)
        previous = weekly_list[-2].get("revenue", 0)
        if previous > 0:
            growth_metrics["week_over_week"] = round(((current - previous) / previous) * 100, 1)

    return TrendsResponse(
        daily=daily_list,
        weekly=weekly_list,
        monthly=monthly_list,
        growth_metrics=growth_metrics,
        filters_applied=filters.model_dump(exclude_none=True),
        generated_at=datetime.utcnow().isoformat(),
    )


@router.get("/daily-breakdown", response_model=DailyBreakdownResponse)
async def get_daily_breakdown(
    user: UserPayload = Depends(get_user_with_tenant),
    tenant_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    branches: Optional[str] = None,
    categories: Optional[str] = None,
):
    """
    Get daily revenue breakdown for reconciliation.

    Returns net sales, tax, service charge, discounts, and transaction counts by date.
    """
    effective_tenant_id = get_effective_tenant_id(user, tenant_id)
    filters = parse_filters(start_date, end_date, branches, categories)

    def fetch_breakdown():
        return supabase.rpc("get_analytics_daily_breakdown_v2", {
            "p_tenant_id": effective_tenant_id,
            "p_start_date": filters.start_date,
            "p_end_date": filters.end_date,
            "p_branches": filters.branches,
            "p_categories": filters.categories,
        }).execute().data or []

    data = await data_cache.get_or_fetch_async(
        prefix="analytics_daily_breakdown",
        fetch_fn=fetch_breakdown,
        ttl="short",
        tenant_id=effective_tenant_id,
        start_date=filters.start_date,
        end_date=filters.end_date,
        branches=str(filters.branches),
        categories=str(filters.categories),
    )

    days = [
        DailyBreakdownItem(
            date=str(d.get("sale_date")),
            net_sales=d.get("net_sales", 0) or 0,
            tax=d.get("tax", 0) or 0,
            service_charge=d.get("service_charge", 0) or 0,
            discounts=d.get("discounts", 0) or 0,
            transactions=d.get("transactions", 0) or 0,
        )
        for d in data
    ]

    return DailyBreakdownResponse(
        days=days,
        filters_applied=filters.model_dump(exclude_none=True),
        generated_at=datetime.utcnow().isoformat(),
    )


@router.get("/performance/branches", response_model=BranchesResponse)
async def get_performance_branches(
    user: UserPayload = Depends(get_user_with_tenant),
    tenant_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    categories: Optional[str] = None,
):
    """
    Get detailed branch comparison.

    Returns metrics for each branch including top items and category breakdown.
    Uses database-level aggregation via RPC for fast performance.
    Cached for 30 seconds.
    """
    effective_tenant_id = get_effective_tenant_id(user, tenant_id)
    filters = parse_filters(start_date, end_date, None, categories)  # Don't filter by branch here

    def fetch_branches():
        return supabase.rpc("get_analytics_branches_v2", {
            "p_tenant_id": effective_tenant_id,
            "p_start_date": filters.start_date,
            "p_end_date": filters.end_date,
            "p_categories": filters.categories,
        }).execute().data or {}

    data = await data_cache.get_or_fetch_async(
        prefix="analytics_branches",
        fetch_fn=fetch_branches,
        ttl="short",
        tenant_id=effective_tenant_id,
        start_date=filters.start_date,
        end_date=filters.end_date,
        categories=str(filters.categories),
    )

    return BranchesResponse(
        branches=data.get("branches") or [],
        comparison_metrics=data.get("comparison_metrics") or {},
        filters_applied=filters.model_dump(exclude_none=True),
        generated_at=datetime.utcnow().isoformat(),
    )


# ============================================
# DAY OF WEEK ANALYSIS ENDPOINT
# ============================================

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


@router.get("/day-of-week", response_model=DayOfWeekResponse)
async def get_day_of_week(
    user: UserPayload = Depends(get_user_with_tenant),
    tenant_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    branches: Optional[str] = None,
    categories: Optional[str] = None,
    day_filter: Optional[int] = Query(None, ge=0, le=6, description="Filter to specific day (0=Mon, 6=Sun)"),
):
    """
    Get day of week analysis with averages and same-day trending.

    Returns:
    - daily_averages: Average revenue/transactions for each day of week
    - same_day_trend: Individual day instances for trending (e.g., all Mondays)
    - best_day/worst_day: Days with highest/lowest average revenue
    """
    effective_tenant_id = get_effective_tenant_id(user, tenant_id)
    filters = parse_filters(start_date, end_date, branches, categories)

    # Fetch daily aggregated data using the trends endpoint data
    # We need date-level data to calculate day-of-week averages
    data = await _cached_trends(effective_tenant_id, filters)
    daily_list = data.get("daily") or []

    # Group by day of week
    day_data = {i: {"revenue": [], "transactions": [], "dates": []} for i in range(7)}

    for day_entry in daily_list:
        date_str = day_entry.get("date")
        if not date_str:
            continue

        try:
            date_obj = datetime.fromisoformat(date_str.replace("Z", ""))
            # Python weekday(): Monday=0, Sunday=6
            dow = date_obj.weekday()
            day_data[dow]["revenue"].append(day_entry.get("revenue", 0))
            day_data[dow]["transactions"].append(day_entry.get("transactions", 0))
            day_data[dow]["dates"].append({
                "date": date_str,
                "revenue": day_entry.get("revenue", 0),
                "transactions": day_entry.get("transactions", 0),
            })
        except (ValueError, TypeError):
            continue

    # Calculate averages for each day
    daily_averages = []
    best_day = {"day_name": "", "avg_revenue": 0}
    worst_day = {"day_name": "", "avg_revenue": float("inf")}

    for dow in range(7):
        revenues = day_data[dow]["revenue"]
        transactions = day_data[dow]["transactions"]
        total_days = len(revenues)

        if total_days > 0:
            avg_revenue = int(sum(revenues) / total_days)
            avg_transactions = int(sum(transactions) / total_days)
        else:
            avg_revenue = 0
            avg_transactions = 0

        daily_averages.append(DayOfWeekAverage(
            day=dow,
            day_name=DAY_NAMES[dow],
            avg_revenue=avg_revenue,
            avg_transactions=avg_transactions,
            total_days=total_days,
        ))

        # Track best/worst
        if avg_revenue > best_day["avg_revenue"]:
            best_day = {"day_name": DAY_NAMES[dow], "avg_revenue": avg_revenue}
        if avg_revenue < worst_day["avg_revenue"] and total_days > 0:
            worst_day = {"day_name": DAY_NAMES[dow], "avg_revenue": avg_revenue}

    # Handle case where worst_day wasn't set (no data)
    if worst_day["avg_revenue"] == float("inf"):
        worst_day = {"day_name": "", "avg_revenue": 0}

    # Build same-day trend (filtered by day_filter if provided)
    same_day_trend = []
    target_days = [day_filter] if day_filter is not None else range(7)

    for dow in target_days:
        for date_entry in sorted(day_data[dow]["dates"], key=lambda x: x["date"]):
            same_day_trend.append(SameDayDataPoint(
                date=date_entry["date"],
                day_name=DAY_NAMES[dow],
                revenue=date_entry["revenue"],
                transactions=date_entry["transactions"],
            ))

    # Sort by date
    same_day_trend.sort(key=lambda x: x.date)

    return DayOfWeekResponse(
        daily_averages=daily_averages,
        same_day_trend=same_day_trend,
        best_day=best_day,
        worst_day=worst_day,
        filters_applied=filters.model_dump(exclude_none=True),
        generated_at=datetime.utcnow().isoformat(),
    )


# ============================================
# YEAR OVER YEAR COMPARISON ENDPOINT
# ============================================

MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
]


@router.get("/year-over-year", response_model=YearOverYearResponse)
async def get_year_over_year(
    user: UserPayload = Depends(get_user_with_tenant),
    tenant_id: Optional[str] = None,
    month: int = Query(..., ge=1, le=12, description="Month to compare (1-12)"),
    branches: Optional[str] = None,
    categories: Optional[str] = None,
):
    """
    Get year-over-year comparison for a specific month across all available years.

    Compares the same month (e.g., January) across different years.
    Returns up to 3 years of data (current + 2 prior years with data).
    """
    effective_tenant_id = get_effective_tenant_id(user, tenant_id)
    filters = parse_filters(None, None, branches, categories)

    # Get monthly data without date filtering to see all available data
    data = await _cached_trends(effective_tenant_id, filters)
    monthly_list = data.get("monthly") or []

    # Filter to only the target month and collect by year
    year_data = {}
    for month_entry in monthly_list:
        month_str = month_entry.get("month")  # Format: "YYYY-MM"
        if not month_str:
            continue

        try:
            parts = month_str.split("-")
            entry_year = int(parts[0])
            entry_month = int(parts[1])

            if entry_month == month:
                revenue = month_entry.get("revenue", 0)
                transactions = month_entry.get("transactions", 0)
                avg_ticket = int(revenue / transactions) if transactions > 0 else 0

                year_data[entry_year] = {
                    "year": entry_year,
                    "month": month,
                    "revenue": revenue,
                    "transactions": transactions,
                    "avg_ticket": avg_ticket,
                }
        except (ValueError, TypeError, IndexError):
            continue

    # Sort by year descending and take up to 3 years
    sorted_years = sorted(year_data.keys(), reverse=True)[:3]
    periods = [
        YearOverYearPeriod(
            year=year_data[year]["year"],
            month=month,
            month_name=MONTH_NAMES[month - 1],
            revenue=year_data[year]["revenue"],
            transactions=year_data[year]["transactions"],
            avg_ticket=year_data[year]["avg_ticket"],
        )
        for year in sorted_years
    ]

    # Calculate YoY growth (most recent vs second most recent)
    growth_yoy = None
    if len(periods) >= 2:
        current = periods[0].revenue
        previous = periods[1].revenue
        if previous > 0:
            growth_yoy = round(((current - previous) / previous) * 100, 1)

    return YearOverYearResponse(
        periods=periods,
        growth_yoy=growth_yoy,
        month=month,
        month_name=MONTH_NAMES[month - 1],
        filters_applied=filters.model_dump(exclude_none=True),
        generated_at=datetime.utcnow().isoformat(),
    )


# ============================================
# MOVEMENT ANALYTICS ENDPOINTS
# Historical analysis for quadrant changes, YoY, seasonal trends
# ============================================

class QuadrantMovement(BaseModel):
    """Single item's quadrant movement record."""
    item_name: str
    month: str  # YYYY-MM format
    quadrant: str
    total_quantity: int
    avg_price: int  # cents
    total_revenue: int  # cents


class QuadrantChange(BaseModel):
    """Item that shifted quadrants between the last two months."""
    item_name: str
    from_quadrant: str
    to_quadrant: str
    change: str
    total_quantity: int
    total_revenue: int


class QuadrantTimelineResponse(BaseModel):
    """Quadrant movements over time."""
    movements: List[QuadrantMovement]
    summary: dict  # Counts of movements between quadrants
    changes: Optional[List[QuadrantChange]] = None
    latest_month: Optional[str] = None
    prior_month: Optional[str] = None
    filters_applied: dict
    generated_at: str


class SeasonalDataPoint(BaseModel):
    """Seasonal trend data point."""
    month: int  # 1-12
    month_name: str
    avg_revenue: int  # cents
    avg_transactions: int
    year_count: int  # Number of years with data for this month


class SeasonalTrendsResponse(BaseModel):
    """Seasonal pattern analysis."""
    monthly_averages: List[SeasonalDataPoint]
    peak_month: dict
    low_month: dict
    filters_applied: dict
    generated_at: str


class ItemHistoryDataPoint(BaseModel):
    """Historical data for a single item in a month."""
    month: str  # YYYY-MM
    quantity: int
    revenue: int  # cents
    avg_price: int  # cents
    quadrant: str


class ItemHistoryResponse(BaseModel):
    """Historical performance for a specific item."""
    item_name: str
    history: List[ItemHistoryDataPoint]
    current_quadrant: str
    quadrant_changes: int  # Number of times quadrant changed
    filters_applied: dict
    generated_at: str


class YoYSummaryMonth(BaseModel):
    """Monthly YoY comparison."""
    month: int
    month_name: str
    current_year: int
    current_revenue: int
    prior_year: Optional[int] = None
    prior_revenue: Optional[int] = None
    yoy_change_pct: Optional[float] = None


class YoYSummaryResponse(BaseModel):
    """Year-over-year summary across all months."""
    months: List[YoYSummaryMonth]
    total_current_revenue: int
    total_prior_revenue: Optional[int] = None
    overall_yoy_change_pct: Optional[float] = None
    current_year: int
    prior_year: Optional[int] = None
    filters_applied: dict
    generated_at: str


@router.get("/movements/quadrant-timeline", response_model=QuadrantTimelineResponse)
async def get_quadrant_timeline(
    user: UserPayload = Depends(get_user_with_tenant),
    tenant_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    branches: Optional[str] = None,
    categories: Optional[str] = None,
    item_name: Optional[str] = Query(None, description="Filter to specific item"),
):
    """
    Get quadrant movements over time.

    Shows how items move between quadrants (Star, Plowhorse, Puzzle, Dog) across months.
    Useful for tracking which items improved or declined over time.
    """
    effective_tenant_id = get_effective_tenant_id(user, tenant_id)
    filters = parse_filters(start_date, end_date, branches, categories)

    rows = await _cached_quadrants(effective_tenant_id, filters, item_name)

    if not rows:
        return QuadrantTimelineResponse(
            movements=[],
            summary={
                "star_count": 0,
                "plowhorse_count": 0,
                "puzzle_count": 0,
                "dog_count": 0,
                "total_items": 0,
                "total_changes": 0,
            },
            filters_applied=filters.model_dump(exclude_none=True),
            generated_at=datetime.utcnow().isoformat(),
        )

    months = sorted({row.get("month") for row in rows if row.get("month")})
    latest_month = months[-1] if months else None
    prior_month = months[-2] if len(months) > 1 else None

    latest_rows = [row for row in rows if row.get("month") == latest_month]
    prior_rows = [row for row in rows if row.get("month") == prior_month] if prior_month else []
    prior_map = {row.get("item_name"): row for row in prior_rows if row.get("item_name")}

    latest_rows.sort(key=lambda r: r.get("total_revenue", 0) or 0, reverse=True)

    movements = [
        QuadrantMovement(
            item_name=row.get("item_name", "Unknown"),
            month=row.get("month", ""),
            quadrant=row.get("quadrant", "Dog"),
            total_quantity=int(row.get("total_quantity", 0) or 0),
            avg_price=int(row.get("avg_price", 0) or 0),
            total_revenue=int(row.get("total_revenue", 0) or 0),
        )
        for row in latest_rows
    ]

    summary = {
        "star_count": sum(1 for m in movements if m.quadrant == "Star"),
        "plowhorse_count": sum(1 for m in movements if m.quadrant == "Plowhorse"),
        "puzzle_count": sum(1 for m in movements if m.quadrant == "Puzzle"),
        "dog_count": sum(1 for m in movements if m.quadrant == "Dog"),
        "total_items": len(movements),
    }

    changes: list[QuadrantChange] = []
    change_counts: dict[str, int] = {}
    if prior_month:
        for row in latest_rows:
            item_name_value = row.get("item_name")
            if not item_name_value:
                continue
            previous = prior_map.get(item_name_value)
            if not previous:
                continue
            prev_quadrant = previous.get("quadrant")
            next_quadrant = row.get("quadrant")
            if prev_quadrant and next_quadrant and prev_quadrant != next_quadrant:
                change_label = f"{prev_quadrant} -> {next_quadrant}"
                change_counts[change_label] = change_counts.get(change_label, 0) + 1
                changes.append(QuadrantChange(
                    item_name=item_name_value,
                    from_quadrant=prev_quadrant,
                    to_quadrant=next_quadrant,
                    change=change_label,
                    total_quantity=int(row.get("total_quantity", 0) or 0),
                    total_revenue=int(row.get("total_revenue", 0) or 0),
                ))

    changes.sort(key=lambda c: c.total_revenue, reverse=True)

    summary.update({
        "total_changes": len(changes),
        "change_breakdown": change_counts,
        "dog_to_star": change_counts.get("Dog -> Star", 0),
        "star_to_dog": change_counts.get("Star -> Dog", 0),
        "puzzle_to_star": change_counts.get("Puzzle -> Star", 0),
        "plowhorse_to_star": change_counts.get("Plowhorse -> Star", 0),
    })

    return QuadrantTimelineResponse(
        movements=movements,
        summary=summary,
        changes=changes[:20],
        latest_month=latest_month,
        prior_month=prior_month,
        filters_applied=filters.model_dump(exclude_none=True),
        generated_at=datetime.utcnow().isoformat(),
    )


@router.get("/movements/yoy-summary", response_model=YoYSummaryResponse)
async def get_yoy_summary(
    user: UserPayload = Depends(get_user_with_tenant),
    tenant_id: Optional[str] = None,
    branches: Optional[str] = None,
    categories: Optional[str] = None,
):
    """
    Get year-over-year comparison across all months.

    Shows revenue for each month of the current year vs the same months last year.
    Useful for understanding seasonal patterns and overall growth trajectory.
    """
    effective_tenant_id = get_effective_tenant_id(user, tenant_id)
    filters = parse_filters(None, None, branches, categories)

    # Get all monthly data
    data = await _cached_trends(effective_tenant_id, filters)
    monthly_list = data.get("monthly") or []

    # Group by year and month
    year_month_data = {}
    for month_entry in monthly_list:
        month_str = month_entry.get("month")  # Format: "YYYY-MM"
        if not month_str:
            continue

        try:
            parts = month_str.split("-")
            year = int(parts[0])
            month = int(parts[1])
            revenue = month_entry.get("revenue", 0)
            transactions = month_entry.get("transactions", 0)

            if year not in year_month_data:
                year_month_data[year] = {}
            year_month_data[year][month] = {
                "revenue": revenue,
                "transactions": transactions,
            }
        except (ValueError, TypeError, IndexError):
            continue

    if not year_month_data:
        return YoYSummaryResponse(
            months=[],
            total_current_revenue=0,
            total_prior_revenue=None,
            overall_yoy_change_pct=None,
            current_year=datetime.utcnow().year,
            prior_year=None,
            filters_applied=filters.model_dump(exclude_none=True),
            generated_at=datetime.utcnow().isoformat(),
        )

    # Determine current and prior year
    sorted_years = sorted(year_month_data.keys(), reverse=True)
    current_year = sorted_years[0]
    prior_year = sorted_years[1] if len(sorted_years) > 1 else None

    # Build month-by-month comparison
    months = []
    total_current = 0
    total_prior = 0

    for month in range(1, 13):
        current_data = year_month_data.get(current_year, {}).get(month)
        prior_data = year_month_data.get(prior_year, {}).get(month) if prior_year else None

        current_revenue = current_data["revenue"] if current_data else 0
        prior_revenue = prior_data["revenue"] if prior_data else None

        yoy_change = None
        if prior_revenue and prior_revenue > 0 and current_revenue:
            yoy_change = round(((current_revenue - prior_revenue) / prior_revenue) * 100, 1)

        if current_data or prior_data:
            months.append(YoYSummaryMonth(
                month=month,
                month_name=MONTH_NAMES[month - 1],
                current_year=current_year,
                current_revenue=current_revenue,
                prior_year=prior_year,
                prior_revenue=prior_revenue,
                yoy_change_pct=yoy_change,
            ))

        total_current += current_revenue
        if prior_revenue:
            total_prior += prior_revenue

    # Calculate overall YoY
    overall_yoy = None
    if total_prior > 0:
        overall_yoy = round(((total_current - total_prior) / total_prior) * 100, 1)

    return YoYSummaryResponse(
        months=months,
        total_current_revenue=total_current,
        total_prior_revenue=total_prior if prior_year else None,
        overall_yoy_change_pct=overall_yoy,
        current_year=current_year,
        prior_year=prior_year,
        filters_applied=filters.model_dump(exclude_none=True),
        generated_at=datetime.utcnow().isoformat(),
    )


@router.get("/movements/seasonal", response_model=SeasonalTrendsResponse)
async def get_seasonal_trends(
    user: UserPayload = Depends(get_user_with_tenant),
    tenant_id: Optional[str] = None,
    branches: Optional[str] = None,
    categories: Optional[str] = None,
):
    """
    Get seasonal trend analysis.

    Averages revenue/transactions for each month across all available years.
    Shows which months are typically strongest/weakest.
    """
    effective_tenant_id = get_effective_tenant_id(user, tenant_id)
    filters = parse_filters(None, None, branches, categories)

    # Get all monthly data
    data = await _cached_trends(effective_tenant_id, filters)
    monthly_list = data.get("monthly") or []

    # Group by month (across all years)
    month_data = {i: {"revenues": [], "transactions": []} for i in range(1, 13)}

    for month_entry in monthly_list:
        month_str = month_entry.get("month")  # Format: "YYYY-MM"
        if not month_str:
            continue

        try:
            parts = month_str.split("-")
            month = int(parts[1])
            revenue = month_entry.get("revenue", 0)
            transactions = month_entry.get("transactions", 0)

            month_data[month]["revenues"].append(revenue)
            month_data[month]["transactions"].append(transactions)
        except (ValueError, TypeError, IndexError):
            continue

    # Calculate averages for each month
    monthly_averages = []
    peak_month = {"month_name": "", "avg_revenue": 0}
    low_month = {"month_name": "", "avg_revenue": float("inf")}

    for month in range(1, 13):
        revenues = month_data[month]["revenues"]
        transactions = month_data[month]["transactions"]
        year_count = len(revenues)

        if year_count > 0:
            avg_revenue = int(sum(revenues) / year_count)
            avg_transactions = int(sum(transactions) / year_count)
        else:
            avg_revenue = 0
            avg_transactions = 0

        monthly_averages.append(SeasonalDataPoint(
            month=month,
            month_name=MONTH_NAMES[month - 1],
            avg_revenue=avg_revenue,
            avg_transactions=avg_transactions,
            year_count=year_count,
        ))

        # Track peak/low
        if avg_revenue > peak_month["avg_revenue"]:
            peak_month = {"month_name": MONTH_NAMES[month - 1], "avg_revenue": avg_revenue}
        if avg_revenue < low_month["avg_revenue"] and year_count > 0:
            low_month = {"month_name": MONTH_NAMES[month - 1], "avg_revenue": avg_revenue}

    # Handle case where low_month wasn't set
    if low_month["avg_revenue"] == float("inf"):
        low_month = {"month_name": "", "avg_revenue": 0}

    return SeasonalTrendsResponse(
        monthly_averages=monthly_averages,
        peak_month=peak_month,
        low_month=low_month,
        filters_applied=filters.model_dump(exclude_none=True),
        generated_at=datetime.utcnow().isoformat(),
    )


@router.get("/movements/item-history", response_model=ItemHistoryResponse)
async def get_item_history(
    item_name: str = Query(..., description="Item name to get history for"),
    user: UserPayload = Depends(get_user_with_tenant),
    tenant_id: Optional[str] = None,
    branches: Optional[str] = None,
):
    """
    Get historical performance for a specific menu item.

    Shows monthly quantity, revenue, and quadrant changes over time.
    Useful for deep-diving into individual item performance trends.
    """
    effective_tenant_id = get_effective_tenant_id(user, tenant_id)
    filters = parse_filters(None, None, branches, None)

    rows = await _cached_quadrants(effective_tenant_id, filters, item_name)
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item '{item_name}' not found"
        )

    rows.sort(key=lambda r: r.get("month", ""))

    history = [
        ItemHistoryDataPoint(
            month=row.get("month", ""),
            quantity=int(row.get("total_quantity", 0) or 0),
            revenue=int(row.get("total_revenue", 0) or 0),
            avg_price=int(row.get("avg_price", 0) or 0),
            quadrant=row.get("quadrant", "Dog"),
        )
        for row in rows
    ]

    current_quadrant = history[-1].quadrant if history else "Dog"
    quadrant_changes = 0
    for idx in range(1, len(history)):
        if history[idx].quadrant != history[idx - 1].quadrant:
            quadrant_changes += 1

    return ItemHistoryResponse(
        item_name=item_name,
        history=history,
        current_quadrant=current_quadrant,
        quadrant_changes=quadrant_changes,
        filters_applied=filters.model_dump(exclude_none=True),
        generated_at=datetime.utcnow().isoformat(),
    )


# ============================================
# DAY BREAKDOWN ENDPOINT (Day Deep Dive)
# ============================================

@router.get("/day-breakdown", response_model=DayBreakdownResponse)
async def get_day_breakdown(
    date: str = Query(..., description="Date to analyze (YYYY-MM-DD)"),
    user: UserPayload = Depends(get_user_with_tenant),
    tenant_id: Optional[str] = None,
    branches: Optional[str] = None,
    categories: Optional[str] = None,
):
    """
    Get detailed breakdown of a single day's performance.

    Returns:
    - Hourly revenue/transactions breakdown (24 hours)
    - Top 10 and Bottom 10 items for the day
    - Comparison to the same day of the previous week

    Uses hourly_summaries and branch_summaries tables for fast queries.
    """
    effective_tenant_id = get_effective_tenant_id(user, tenant_id)
    filters = parse_filters(date, date, branches, categories)

    # Parse the date
    try:
        target_date = datetime.fromisoformat(date)
        day_name = target_date.strftime("%A")
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid date format: {date}. Use YYYY-MM-DD."
        )

    def fetch_day_data():
        # Query hourly_summaries for this date
        hourly_query = supabase.table("hourly_summaries").select(
            "local_hour, revenue, quantity, transaction_count"
        ).eq("tenant_id", effective_tenant_id).eq("sale_date", date)

        if filters.branches:
            hourly_query = hourly_query.in_("store_name", filters.branches)
        if filters.categories:
            hourly_query = hourly_query.in_("category", filters.categories)

        hourly_result = hourly_query.execute()
        hourly_data = hourly_result.data or []

        # Get item data
        item_totals = {}
        if filters.categories:
            item_result = supabase.rpc("get_item_totals_v2", {
                "p_tenant_id": effective_tenant_id,
                "p_start_date": date,
                "p_end_date": date,
                "p_branches": filters.branches,
                "p_categories": filters.categories,
                "p_exclude_excluded": True,
            }).execute()

            for row in item_result.data or []:
                name = row.get("item_name", "Unknown")
                item_totals[name] = {
                    "quantity": int(row.get("total_quantity", 0) or 0),
                    "revenue": int(row.get("total_revenue", 0) or 0),
                }
        else:
            branch_query = supabase.table("branch_summaries").select(
                "top_items"
            ).eq("tenant_id", effective_tenant_id).eq(
                "period_type", "daily"
            ).eq("period_start", date)

            if filters.branches:
                branch_query = branch_query.in_("store_name", filters.branches)

            branch_result = branch_query.execute()

            for row in branch_result.data or []:
                items = row.get("top_items") or []
                for item in items:
                    name = item.get("item_name", "Unknown")
                    if name not in item_totals:
                        item_totals[name] = {"quantity": 0, "revenue": 0}
                    item_totals[name]["quantity"] += item.get("quantity", 0) or 0
                    item_totals[name]["revenue"] += item.get("revenue", 0) or 0

        # Prior week data
        prior_date = (target_date - timedelta(days=7)).strftime("%Y-%m-%d")

        prior_query = supabase.table("hourly_summaries").select(
            "revenue, transaction_count"
        ).eq("tenant_id", effective_tenant_id).eq("sale_date", prior_date)

        if filters.branches:
            prior_query = prior_query.in_("store_name", filters.branches)
        if filters.categories:
            prior_query = prior_query.in_("category", filters.categories)

        prior_result = prior_query.execute()
        prior_hourly_data = prior_result.data or []

        # Prior week top items for overlap
        prior_branch = supabase.table("branch_summaries").select(
            "top_items"
        ).eq("tenant_id", effective_tenant_id).eq(
            "period_type", "daily"
        ).eq("period_start", prior_date)

        if filters.branches:
            prior_branch = prior_branch.in_("store_name", filters.branches)

        prior_branch_result = prior_branch.execute()

        return {
            "hourly_data": hourly_data,
            "item_totals": item_totals,
            "prior_hourly_data": prior_hourly_data,
            "prior_branch_data": prior_branch_result.data or [],
            "prior_date": prior_date,
        }

    cached = await data_cache.get_or_fetch_async(
        prefix="analytics_day_breakdown",
        fetch_fn=fetch_day_data,
        ttl="short",
        tenant_id=effective_tenant_id,
        date=date,
        branches=str(filters.branches),
        categories=str(filters.categories),
    )

    hourly_data = cached["hourly_data"]
    item_totals = cached["item_totals"]
    prior_hourly_data = cached["prior_hourly_data"]
    prior_branch_data = cached["prior_branch_data"]
    prior_date = cached["prior_date"]

    # Aggregate by hour
    hour_totals = {h: {"revenue": 0, "transactions": 0, "quantity": 0} for h in range(24)}
    for row in hourly_data:
        hour = row.get("local_hour", 0)
        if 0 <= hour <= 23:
            hour_totals[hour]["revenue"] += row.get("revenue", 0) or 0
            hour_totals[hour]["transactions"] += row.get("transaction_count", 0) or 0
            hour_totals[hour]["quantity"] += row.get("quantity", 0) or 0

    # Build hourly breakdown
    hourly = [
        HourlyBreakdownItem(
            hour=h,
            revenue=data["revenue"],
            transactions=data["transactions"],
            quantity=data["quantity"],
        )
        for h, data in hour_totals.items()
    ]

    # Calculate totals and peak hour
    total_revenue = sum(h.revenue for h in hourly)
    total_transactions = sum(h.transactions for h in hourly)
    total_quantity = sum(h.quantity for h in hourly)
    peak_hour = max(hourly, key=lambda h: h.revenue).hour if hourly else 12

    # Sort and get top/bottom 10 items
    sorted_items = sorted(
        item_totals.items(),
        key=lambda x: x[1]["revenue"],
        reverse=True
    )

    top_items = [
        TopItemData(item_name=name, quantity=data["quantity"], revenue=data["revenue"])
        for name, data in sorted_items[:10]
    ]

    if len(sorted_items) > 10:
        bottom_items = [
            TopItemData(item_name=name, quantity=data["quantity"], revenue=data["revenue"])
            for name, data in sorted_items[-10:][::-1]
        ]
    else:
        bottom_items = [
            TopItemData(item_name=name, quantity=data["quantity"], revenue=data["revenue"])
            for name, data in sorted_items[10:][::-1]
        ]

    # Week-over-week comparison
    comparison = None
    if prior_hourly_data:
        prior_revenue = sum(r.get("revenue", 0) or 0 for r in prior_hourly_data)
        prior_transactions = sum(r.get("transaction_count", 0) or 0 for r in prior_hourly_data)

        revenue_change = None
        transactions_change = None

        if prior_revenue > 0:
            revenue_change = round(
                ((total_revenue - prior_revenue) / prior_revenue) * 100, 1
            )
        if prior_transactions > 0:
            transactions_change = round(
                ((total_transactions - prior_transactions) / prior_transactions) * 100, 1
            )

        prior_top_names = set()
        for row in prior_branch_data:
            for item in row.get("top_items") or []:
                prior_top_names.add(item.get("item_name"))

        current_top_names = {item.item_name for item in top_items}
        overlap = len(current_top_names & prior_top_names)

        comparison = DayComparisonData(
            prior_date=prior_date,
            prior_revenue=prior_revenue,
            prior_transactions=prior_transactions,
            revenue_change_pct=revenue_change,
            transactions_change_pct=transactions_change,
            top_items_overlap=overlap,
        )

    avg_ticket = total_revenue // total_transactions if total_transactions > 0 else 0

    return DayBreakdownResponse(
        date=date,
        day_name=day_name,
        total_revenue=total_revenue,
        total_transactions=total_transactions,
        total_quantity=total_quantity,
        avg_ticket=avg_ticket,
        hourly=hourly,
        peak_hour=peak_hour,
        top_items=top_items,
        bottom_items=bottom_items,
        comparison=comparison,
        filters_applied=filters.model_dump(exclude_none=True),
        generated_at=datetime.utcnow().isoformat(),
    )
