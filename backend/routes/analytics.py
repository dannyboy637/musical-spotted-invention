"""
Analytics API routes.
Provides dashboard data endpoints for menu engineering, dayparting, and performance analytics.
"""
from typing import Optional, List
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel

from middleware.auth import get_user_with_tenant, require_operator, UserPayload
from db.supabase import supabase
from utils.cache import data_cache

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

# Supabase has a server-side limit of 1000 rows per request
# This helper fetches all rows using pagination
SUPABASE_PAGE_SIZE = 1000


def fetch_all_transactions(
    tenant_id: str,
    filters: "AnalyticsFilters",
    select_columns: str,
    max_rows: int = 500000
) -> list:
    """
    Fetch all transaction rows using pagination.

    Supabase limits responses to 1000 rows by default.
    This function paginates through all results.
    """
    all_data = []
    offset = 0

    while offset < max_rows:
        # Build fresh query for each page
        query = supabase.table("transactions").select(select_columns)
        query = query.eq("tenant_id", tenant_id)

        # Apply filters
        if filters.start_date:
            query = query.gte("receipt_timestamp", filters.start_date)
        if filters.end_date:
            query = query.lte("receipt_timestamp", f"{filters.end_date}T23:59:59")
        if filters.branches:
            query = query.in_("store_name", filters.branches)
        if filters.categories:
            query = query.in_("category", filters.categories)

        # Add pagination
        result = query.range(offset, offset + SUPABASE_PAGE_SIZE - 1).execute()

        if not result.data:
            break

        all_data.extend(result.data)

        # If we got fewer rows than page size, we've reached the end
        if len(result.data) < SUPABASE_PAGE_SIZE:
            break

        offset += SUPABASE_PAGE_SIZE

    return all_data


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


def get_effective_tenant_id(user: UserPayload, tenant_id_override: str = None) -> str:
    """
    Get tenant ID for queries.

    - Operators can override with tenant_id_override
    - Others use their assigned tenant from the database
    """
    # Operators can specify which tenant to query
    if user.role == "operator" and tenant_id_override:
        return tenant_id_override

    # For all users, use their assigned tenant
    if user.tenant_id:
        return user.tenant_id

    # Fallback: check if override was provided (for any role)
    if tenant_id_override:
        return tenant_id_override

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="No tenant selected"
    )


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

    data = data_cache.get_or_fetch(
        prefix="analytics_overview",
        fetch_fn=fetch_overview,
        ttl="short",
        tenant_id=effective_tenant_id,
        start_date=filters.start_date,
        end_date=filters.end_date,
        branches=str(filters.branches),
        categories=str(filters.categories),
    )

    # Get unique_items from menu_items table (v2 summary tables don't track this)
    unique_items = 0
    try:
        menu_query = supabase.table("menu_items").select("id", count="exact").eq("tenant_id", effective_tenant_id)
        if filters.categories:
            menu_query = menu_query.in_("category", filters.categories)
        menu_result = menu_query.limit(1).execute()
        unique_items = menu_result.count or 0
    except Exception:
        pass  # Fall back to 0 on error

    # Calculate growth vs previous period if date range provided
    period_growth = None
    if filters.start_date and filters.end_date:
        try:
            start = datetime.fromisoformat(filters.start_date.replace("Z", ""))
            end = datetime.fromisoformat(filters.end_date.replace("Z", ""))
            period_days = (end - start).days + 1

            prev_end = start - timedelta(days=1)
            prev_start = prev_end - timedelta(days=period_days - 1)

            prev_result = supabase.rpc("get_analytics_overview_v2", {
                "p_tenant_id": effective_tenant_id,
                "p_start_date": prev_start.isoformat()[:10],
                "p_end_date": prev_end.isoformat()[:10],
                "p_branches": filters.branches,
                "p_categories": filters.categories,
            }).execute()

            prev_data = prev_result.data or {}
            prev_revenue = prev_data.get("total_revenue", 0)
            current_revenue = data.get("total_revenue", 0)

            if prev_revenue > 0:
                period_growth = round(((current_revenue - prev_revenue) / prev_revenue) * 100, 1)
        except Exception:
            pass  # Silently skip growth calculation on error

    return OverviewResponse(
        total_revenue=data.get("total_revenue", 0),
        total_transactions=data.get("total_transactions", 0),
        unique_receipts=data.get("unique_receipts", 0),
        avg_ticket=data.get("avg_ticket", 0),
        unique_items=unique_items,  # From menu_items table, not summary
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

    # Get menu items
    query = supabase.table("menu_items").select("*").eq("tenant_id", effective_tenant_id)

    if core_only:
        query = query.eq("is_core_menu", True)
    if current_only:
        query = query.eq("is_current_menu", True)
    if filters.categories:
        query = query.in_("category", filters.categories)
    if macro_category and macro_category != 'ALL':
        query = query.eq("macro_category", macro_category)

    # Exclude items marked as excluded from analysis
    query = query.eq("is_excluded", False)

    # Apply price and quantity filters at database level where possible
    if min_price is not None:
        query = query.gte("avg_price", min_price)
    if max_price is not None:
        query = query.lte("avg_price", max_price)
    if min_quantity is not None:
        query = query.gte("total_quantity", min_quantity)

    result = query.order("total_gross_revenue", desc=True).execute()
    data = result.data or []

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
    quantities = sorted([row.get("total_quantity", 0) for row in data])
    prices = sorted([row.get("avg_price", 0) for row in data])

    mid = len(quantities) // 2
    median_quantity = quantities[mid] if len(quantities) % 2 else (quantities[mid-1] + quantities[mid]) / 2
    median_price = prices[mid] if len(prices) % 2 else (prices[mid-1] + prices[mid]) / 2

    # Build response items with DYNAMICALLY calculated quadrants
    items = []
    quadrant_counts = {"Star": 0, "Plowhorse": 0, "Puzzle": 0, "Dog": 0}

    for row in data:
        # Calculate quadrant based on filtered medians (not pre-stored value)
        item_quantity = row.get("total_quantity", 0)
        item_price = row.get("avg_price", 0)
        quadrant = calculate_quadrant(item_quantity, item_price, median_quantity, median_price)

        quadrant_counts[quadrant] += 1

        items.append(MenuEngineeringItem(
            item_name=row.get("item_name") or "Unknown",
            category=row.get("category") or "Uncategorized",
            macro_category=row.get("macro_category") or "OTHER",
            quadrant=quadrant,
            total_quantity=item_quantity,
            total_revenue=row.get("total_gross_revenue", 0),
            avg_price=item_price,
            order_count=row.get("order_count", 0),
            is_core_menu=row.get("is_core_menu", False),
            is_current_menu=row.get("is_current_menu", False),
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

    data = data_cache.get_or_fetch(
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

    raw_data = data_cache.get_or_fetch(
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
        # Note: v2 function uses summary tables which are pre-filtered (is_excluded=false)
        # The include_excluded parameter is not supported in v2
        return supabase.rpc("get_analytics_categories_v2", {
            "p_tenant_id": effective_tenant_id,
            "p_start_date": filters.start_date,
            "p_end_date": filters.end_date,
            "p_branches": filters.branches,
        }).execute().data or {}

    data = data_cache.get_or_fetch(
        prefix="analytics_categories",
        fetch_fn=fetch_categories,
        ttl="short",
        tenant_id=effective_tenant_id,
        start_date=filters.start_date,
        end_date=filters.end_date,
        branches=str(filters.branches),
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

    data = data_cache.get_or_fetch(
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

    data = data_cache.get_or_fetch(
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

    def fetch_trends():
        return supabase.rpc("get_analytics_trends_v2", {
            "p_tenant_id": effective_tenant_id,
            "p_start_date": filters.start_date,
            "p_end_date": filters.end_date,
            "p_branches": filters.branches,
            "p_categories": filters.categories,
        }).execute().data or {}

    data = data_cache.get_or_fetch(
        prefix="analytics_trends",
        fetch_fn=fetch_trends,
        ttl="short",
        tenant_id=effective_tenant_id,
        start_date=filters.start_date,
        end_date=filters.end_date,
        branches=str(filters.branches),
        categories=str(filters.categories),
    )

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

    data = data_cache.get_or_fetch(
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
    result = supabase.rpc("get_analytics_trends_v2", {
        "p_tenant_id": effective_tenant_id,
        "p_start_date": filters.start_date,
        "p_end_date": filters.end_date,
        "p_branches": filters.branches,
        "p_categories": filters.categories,
    }).execute()

    data = result.data or {}
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
    result = supabase.rpc("get_analytics_trends_v2", {
        "p_tenant_id": effective_tenant_id,
        "p_start_date": None,
        "p_end_date": None,
        "p_branches": filters.branches,
        "p_categories": filters.categories,
    }).execute()

    data = result.data or {}
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
