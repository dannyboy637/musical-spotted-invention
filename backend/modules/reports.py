"""
Report generation module.

Aggregates data for reports:
- KPIs (revenue, transactions, avg check, % change)
- Top 5 items by revenue
- Biggest gainers/decliners (period-over-period)
- Active alerts (weekly reports only)
"""
from calendar import monthrange
from datetime import datetime, timedelta
from typing import Optional, List, Literal
from db.supabase import supabase

PeriodType = Literal['week', 'month', 'quarter', 'year']


def get_period_bounds(period_type: PeriodType, reference_date: datetime = None) -> tuple[str, str]:
    """
    Get date bounds for a period type.

    Args:
        period_type: 'week', 'month', 'quarter', 'year'
        reference_date: Reference date (defaults to now)

    Returns (start_date, end_date) as ISO strings.
    """
    if reference_date is None:
        reference_date = datetime.now()

    if period_type == 'week':
        return get_week_bounds(reference_date)
    elif period_type == 'month':
        return get_month_bounds(reference_date)
    elif period_type == 'quarter':
        return get_quarter_bounds(reference_date)
    elif period_type == 'year':
        return get_year_bounds(reference_date)
    else:
        raise ValueError(f"Invalid period_type: {period_type}")


def get_week_bounds(reference_date: datetime = None) -> tuple[str, str]:
    """
    Get the previous week's date range (Mon-Sun).

    If reference_date is provided, returns the week ending before that date.
    Otherwise, returns the week ending yesterday.

    Returns (start_date, end_date) as ISO strings.
    """
    if reference_date is None:
        reference_date = datetime.now()

    # Find Sunday (end of previous week)
    # If today is Monday, previous week ended yesterday (Sunday)
    # If today is Tuesday, previous week ended 2 days ago (Sunday)
    days_since_sunday = (reference_date.weekday() + 1) % 7  # Mon=0 -> 1, Sun=6 -> 0
    if days_since_sunday == 0:
        days_since_sunday = 7  # If Sunday, go back to previous Sunday
    end_date = reference_date - timedelta(days=days_since_sunday)

    # Start of that week (Monday)
    start_date = end_date - timedelta(days=6)

    return start_date.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d")


def get_month_bounds(reference_date: datetime = None) -> tuple[str, str]:
    """
    Get the previous month's date range.

    Returns (start_date, end_date) as ISO strings.
    """
    if reference_date is None:
        reference_date = datetime.now()

    # Go to previous month
    if reference_date.month == 1:
        year = reference_date.year - 1
        month = 12
    else:
        year = reference_date.year
        month = reference_date.month - 1

    # First day of previous month
    start_date = datetime(year, month, 1)

    # Last day of previous month
    _, last_day = monthrange(year, month)
    end_date = datetime(year, month, last_day)

    return start_date.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d")


def get_quarter_bounds(reference_date: datetime = None) -> tuple[str, str]:
    """
    Get the previous quarter's date range.

    Returns (start_date, end_date) as ISO strings.
    """
    if reference_date is None:
        reference_date = datetime.now()

    # Determine current quarter (1-4)
    current_quarter = (reference_date.month - 1) // 3 + 1

    # Previous quarter
    if current_quarter == 1:
        year = reference_date.year - 1
        prev_quarter = 4
    else:
        year = reference_date.year
        prev_quarter = current_quarter - 1

    # Quarter start months: Q1=1, Q2=4, Q3=7, Q4=10
    start_month = (prev_quarter - 1) * 3 + 1
    end_month = start_month + 2

    start_date = datetime(year, start_month, 1)
    _, last_day = monthrange(year, end_month)
    end_date = datetime(year, end_month, last_day)

    return start_date.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d")


def get_year_bounds(reference_date: datetime = None) -> tuple[str, str]:
    """
    Get the previous year's date range.

    Returns (start_date, end_date) as ISO strings.
    """
    if reference_date is None:
        reference_date = datetime.now()

    prev_year = reference_date.year - 1
    start_date = datetime(prev_year, 1, 1)
    end_date = datetime(prev_year, 12, 31)

    return start_date.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d")


def generate_report_data(
    tenant_id: str,
    start_date: str,
    end_date: str,
    period_type: PeriodType = 'week',
) -> dict:
    """
    Generate report data for a tenant and date range.

    Args:
        tenant_id: Tenant UUID
        start_date: Period start date (ISO string)
        end_date: Period end date (ISO string)
        period_type: Type of period ('week', 'month', 'quarter', 'year')

    Returns a dictionary with:
    - kpis: Revenue, transactions, avg_check, and % changes
    - top_items: Top 5 items by revenue
    - gainers: Items with biggest revenue increase
    - decliners: Items with biggest revenue decrease
    - alerts: Active alerts (weekly reports only)
    """
    report_data = {
        "period": {
            "start_date": start_date,
            "end_date": end_date,
        },
        "kpis": {},
        "top_items": [],
        "gainers": [],
        "decliners": [],
        "alerts": [],
        "generated_at": datetime.utcnow().isoformat(),
    }

    # 1. Get KPIs for current period
    current_kpis = _get_kpis(tenant_id, start_date, end_date)
    report_data["kpis"] = current_kpis

    # 2. Get KPIs for previous period (same duration) for comparison
    start_dt = datetime.fromisoformat(start_date)
    end_dt = datetime.fromisoformat(end_date)
    period_days = (end_dt - start_dt).days + 1
    prev_end = start_dt - timedelta(days=1)
    prev_start = prev_end - timedelta(days=period_days - 1)

    prev_kpis = _get_kpis(
        tenant_id,
        prev_start.strftime("%Y-%m-%d"),
        prev_end.strftime("%Y-%m-%d")
    )

    # Calculate % changes
    if prev_kpis.get("revenue", 0) > 0:
        report_data["kpis"]["revenue_change_pct"] = round(
            ((current_kpis.get("revenue", 0) - prev_kpis.get("revenue", 0))
             / prev_kpis.get("revenue", 1)) * 100, 1
        )
    if prev_kpis.get("transactions", 0) > 0:
        report_data["kpis"]["transactions_change_pct"] = round(
            ((current_kpis.get("transactions", 0) - prev_kpis.get("transactions", 0))
             / prev_kpis.get("transactions", 1)) * 100, 1
        )
    if prev_kpis.get("avg_check", 0) > 0:
        report_data["kpis"]["avg_check_change_pct"] = round(
            ((current_kpis.get("avg_check", 0) - prev_kpis.get("avg_check", 0))
             / prev_kpis.get("avg_check", 1)) * 100, 1
        )

    # 3. Get top 5 items by revenue
    report_data["top_items"] = _get_top_items(tenant_id, start_date, end_date, limit=5)

    # 4. Get gainers and decliners
    gainers, decliners = _get_movers(tenant_id, start_date, end_date)
    report_data["gainers"] = gainers[:5]
    report_data["decliners"] = decliners[:5]

    # 5. Get active alerts (only for weekly reports)
    if period_type == 'week':
        report_data["alerts"] = _get_active_alerts(tenant_id, limit=10)
    # For historical reports (month, quarter, year), alerts remain empty

    return report_data


def _get_kpis(tenant_id: str, start_date: str, end_date: str) -> dict:
    """Get KPI summary using RPC."""
    result = supabase.rpc("get_analytics_overview", {
        "p_tenant_id": tenant_id,
        "p_start_date": start_date,
        "p_end_date": end_date,
        "p_branches": None,
        "p_categories": None,
    }).execute()

    data = result.data or {}
    return {
        "revenue": data.get("total_revenue", 0),
        "transactions": data.get("total_transactions", 0),
        "unique_receipts": data.get("unique_receipts", 0),
        "avg_check": data.get("avg_ticket", 0),
        "unique_items": data.get("unique_items", 0),
    }


def _get_top_items(tenant_id: str, start_date: str, end_date: str, limit: int = 5) -> List[dict]:
    """Get top items by revenue for the period."""
    result = supabase.rpc("get_item_totals_v2", {
        "p_tenant_id": tenant_id,
        "p_start_date": start_date,
        "p_end_date": end_date,
        "p_exclude_excluded": True,
    }).execute()

    items_data = result.data or []
    items = []
    for row in items_data:
        items.append({
            "item_name": row.get("item_name", "Unknown"),
            "category": row.get("category", "Uncategorized"),
            "revenue": row.get("total_revenue", 0) or 0,
            "quantity": row.get("total_quantity", 0) or 0,
        })

    return items[:limit]


def _get_movers(tenant_id: str, start_date: str, end_date: str) -> tuple[list, list]:
    """
    Get items with biggest revenue changes vs previous period.

    Returns (gainers, decliners) as lists of dicts.
    """
    # Calculate previous period
    start_dt = datetime.fromisoformat(start_date)
    end_dt = datetime.fromisoformat(end_date)
    period_days = (end_dt - start_dt).days + 1
    prev_end = start_dt - timedelta(days=1)
    prev_start = prev_end - timedelta(days=period_days - 1)

    # Get current period item revenue (using menu_items snapshot)
    # Note: For accurate period comparison, we'd need transaction-level aggregation
    # For now, use menu_items as a baseline

    # Get item revenue for current period using the item_totals RPC (SQL-side aggregation)
    current_result = supabase.rpc("get_item_totals_v2", {
        "p_tenant_id": tenant_id,
        "p_start_date": start_date,
        "p_end_date": end_date,
        "p_exclude_excluded": True,
    }).execute()

    current_items = {}
    for row in (current_result.data or []):
        item_name = row.get("item_name", "Unknown")
        current_items[item_name] = row.get("total_revenue", 0) or 0

    # Get item revenue for previous period
    prev_result = supabase.rpc("get_item_totals_v2", {
        "p_tenant_id": tenant_id,
        "p_start_date": prev_start.strftime("%Y-%m-%d"),
        "p_end_date": prev_end.strftime("%Y-%m-%d"),
        "p_exclude_excluded": True,
    }).execute()

    prev_items = {}
    for row in (prev_result.data or []):
        item_name = row.get("item_name", "Unknown")
        prev_items[item_name] = row.get("total_revenue", 0) or 0

    # Calculate changes
    all_items = set(current_items.keys()) | set(prev_items.keys())
    changes = []

    for item_name in all_items:
        current_rev = current_items.get(item_name, 0)
        prev_rev = prev_items.get(item_name, 0)

        if prev_rev > 0:
            change_pct = round(((current_rev - prev_rev) / prev_rev) * 100, 1)
        elif current_rev > 0:
            change_pct = 100.0  # New item
        else:
            continue  # Skip items with no sales in either period

        changes.append({
            "item_name": item_name,
            "current_revenue": current_rev,
            "previous_revenue": prev_rev,
            "change_pct": change_pct,
            "change_amount": current_rev - prev_rev,
        })

    # Sort and split into gainers/decliners
    # Only include items with meaningful revenue (filter out noise)
    min_revenue = 10000  # ₱100 minimum

    gainers = [c for c in changes if c["change_pct"] > 0 and c["current_revenue"] >= min_revenue]
    decliners = [c for c in changes if c["change_pct"] < 0 and c["previous_revenue"] >= min_revenue]

    gainers.sort(key=lambda x: x["change_pct"], reverse=True)
    decliners.sort(key=lambda x: x["change_pct"])

    return gainers, decliners


def _get_active_alerts(tenant_id: str, limit: int = 10) -> List[dict]:
    """Get active (non-dismissed) alerts for the tenant."""
    result = supabase.table("alerts").select(
        "id, type, severity, title, message, created_at"
    ).eq("tenant_id", tenant_id).is_(
        "dismissed_at", "null"
    ).order("created_at", desc=True).limit(limit).execute()

    return [
        {
            "type": a["type"],
            "severity": a["severity"],
            "title": a["title"],
            "message": a.get("message"),
            "created_at": a["created_at"],
        }
        for a in (result.data or [])
    ]
