"""
Anomaly detection module.
Detects revenue drops, item spikes/crashes, and quadrant changes.
"""
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from db.supabase import supabase

# Alert types
ALERT_TYPE_REVENUE_DROP = "revenue_drop"
ALERT_TYPE_ITEM_SPIKE = "item_spike"
ALERT_TYPE_ITEM_CRASH = "item_crash"
ALERT_TYPE_NEW_STAR = "new_star"
ALERT_TYPE_NEW_DOG = "new_dog"

# Cooldown period for duplicate alerts (7 days)
COOLDOWN_DAYS = 7


def get_alert_settings(tenant_id: str) -> Dict:
    """Get alert settings for tenant, creating defaults if needed."""
    result = supabase.rpc("get_or_create_alert_settings", {
        "p_tenant_id": tenant_id
    }).execute()

    if result.data:
        return result.data

    # Return defaults if RPC fails
    return {
        "revenue_drop_pct": 20,
        "item_spike_pct": 50,
        "item_crash_pct": 50,
        "quadrant_alerts_enabled": True,
    }


def check_cooldown(tenant_id: str, fingerprint: str) -> bool:
    """
    Check if an alert with this fingerprint was recently created.

    Returns True if we're still in cooldown (should NOT create alert).
    Returns False if cooldown has passed (OK to create alert).
    """
    cooldown_cutoff = (datetime.utcnow() - timedelta(days=COOLDOWN_DAYS)).isoformat()

    result = supabase.table("alerts") \
        .select("id") \
        .eq("tenant_id", tenant_id) \
        .eq("fingerprint", fingerprint) \
        .gte("created_at", cooldown_cutoff) \
        .limit(1) \
        .execute()

    return len(result.data or []) > 0


def create_alert(
    tenant_id: str,
    alert_type: str,
    title: str,
    message: str,
    severity: str,
    fingerprint: str,
    data: Optional[Dict] = None
) -> Optional[str]:
    """
    Create an alert if not in cooldown.

    Returns alert ID if created, None if skipped due to cooldown.
    """
    # Check cooldown
    if check_cooldown(tenant_id, fingerprint):
        return None

    result = supabase.table("alerts").insert({
        "tenant_id": tenant_id,
        "type": alert_type,
        "title": title,
        "message": message,
        "severity": severity,
        "fingerprint": fingerprint,
        "data": data or {},
    }).execute()

    if result.data:
        return result.data[0]["id"]
    return None


def get_period_revenue(tenant_id: str, start_date: str, end_date: str) -> int:
    """Get total revenue for a date range."""
    result = supabase.rpc("get_analytics_overview", {
        "p_tenant_id": tenant_id,
        "p_start_date": start_date,
        "p_end_date": end_date,
        "p_branches": None,
        "p_categories": None,
    }).execute()

    if result.data:
        return result.data.get("total_revenue", 0)
    return 0


def get_latest_transaction_date(tenant_id: str) -> Optional[datetime]:
    """Get the most recent transaction date for a tenant."""
    result = supabase.table("transactions") \
        .select("receipt_timestamp") \
        .eq("tenant_id", tenant_id) \
        .order("receipt_timestamp", desc=True) \
        .limit(1) \
        .execute()

    if result.data and result.data[0].get("receipt_timestamp"):
        date_str = result.data[0]["receipt_timestamp"]
        try:
            return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def detect_revenue_anomalies(tenant_id: str, settings: Dict) -> int:
    """
    Detect revenue drops.

    Compares last 7 days vs prior 7 days (based on latest transaction date).
    Returns count of alerts created.
    """
    alerts_created = 0
    threshold_pct = settings.get("revenue_drop_pct", 20)

    # Use latest transaction date instead of today (handles historical data)
    latest_date = get_latest_transaction_date(tenant_id)
    if not latest_date:
        return 0

    # Calculate date ranges based on latest data
    current_end = latest_date.date()
    current_start = current_end - timedelta(days=6)  # Last 7 days

    prior_end = current_start - timedelta(days=1)
    prior_start = prior_end - timedelta(days=6)  # Prior 7 days

    # Get revenue for both periods
    current_revenue = get_period_revenue(
        tenant_id,
        current_start.isoformat(),
        current_end.isoformat()
    )

    prior_revenue = get_period_revenue(
        tenant_id,
        prior_start.isoformat(),
        prior_end.isoformat()
    )

    # Skip if no prior revenue to compare
    if prior_revenue == 0:
        return 0

    # Calculate change percentage
    change_pct = ((current_revenue - prior_revenue) / prior_revenue) * 100

    # Check for revenue drop
    if change_pct <= -threshold_pct:
        fingerprint = f"{ALERT_TYPE_REVENUE_DROP}:{current_start.isoformat()}"

        # Format revenue for display (convert cents to currency)
        current_formatted = f"₱{current_revenue / 100:,.0f}"
        prior_formatted = f"₱{prior_revenue / 100:,.0f}"

        alert_id = create_alert(
            tenant_id=tenant_id,
            alert_type=ALERT_TYPE_REVENUE_DROP,
            title=f"Revenue dropped {abs(change_pct):.0f}%",
            message=f"Revenue from {current_start} to {current_end} was {current_formatted}, down from {prior_formatted} in the prior week.",
            severity="warning" if change_pct > -30 else "critical",
            fingerprint=fingerprint,
            data={
                "current_revenue": current_revenue,
                "prior_revenue": prior_revenue,
                "change_pct": round(change_pct, 1),
                "current_start": current_start.isoformat(),
                "current_end": current_end.isoformat(),
                "prior_start": prior_start.isoformat(),
                "prior_end": prior_end.isoformat(),
            }
        )

        if alert_id:
            alerts_created += 1

    return alerts_created


def detect_item_anomalies(tenant_id: str, settings: Dict) -> int:
    """
    Detect item spikes and crashes.

    Compares last 7 days vs prior 7 days per item (based on latest transaction date).
    Returns count of alerts created.
    """
    alerts_created = 0
    spike_threshold = settings.get("item_spike_pct", 50)
    crash_threshold = settings.get("item_crash_pct", 50)

    # Use latest transaction date instead of today
    latest_date = get_latest_transaction_date(tenant_id)
    if not latest_date:
        return 0

    # Calculate date ranges based on latest data
    current_end = latest_date.date()
    current_start = current_end - timedelta(days=6)

    prior_end = current_start - timedelta(days=1)
    prior_start = prior_end - timedelta(days=6)

    # Get item quantities for current period
    current_result = supabase.table("transactions") \
        .select("item_name") \
        .eq("tenant_id", tenant_id) \
        .eq("is_excluded", False) \
        .gte("receipt_timestamp", current_start.isoformat()) \
        .lte("receipt_timestamp", f"{current_end.isoformat()}T23:59:59") \
        .execute()

    # Count items in current period
    current_counts: Dict[str, int] = {}
    for row in (current_result.data or []):
        item = row.get("item_name", "Unknown")
        current_counts[item] = current_counts.get(item, 0) + 1

    # Get item quantities for prior period
    prior_result = supabase.table("transactions") \
        .select("item_name") \
        .eq("tenant_id", tenant_id) \
        .eq("is_excluded", False) \
        .gte("receipt_timestamp", prior_start.isoformat()) \
        .lte("receipt_timestamp", f"{prior_end.isoformat()}T23:59:59") \
        .execute()

    # Count items in prior period
    prior_counts: Dict[str, int] = {}
    for row in (prior_result.data or []):
        item = row.get("item_name", "Unknown")
        prior_counts[item] = prior_counts.get(item, 0) + 1

    # Compare all items
    all_items = set(current_counts.keys()) | set(prior_counts.keys())

    for item_name in all_items:
        current_qty = current_counts.get(item_name, 0)
        prior_qty = prior_counts.get(item_name, 0)

        # Skip if not enough data
        if prior_qty < 3:  # Need at least 3 sales in prior period
            continue

        change_pct = ((current_qty - prior_qty) / prior_qty) * 100

        # Check for spike
        if change_pct >= spike_threshold:
            fingerprint = f"{ALERT_TYPE_ITEM_SPIKE}:{item_name}:{current_start.isoformat()}"

            alert_id = create_alert(
                tenant_id=tenant_id,
                alert_type=ALERT_TYPE_ITEM_SPIKE,
                title=f"'{item_name}' sales spiked {change_pct:.0f}%",
                message=f"Sold {current_qty} units last week, up from {prior_qty} the week before.",
                severity="info",
                fingerprint=fingerprint,
                data={
                    "item_name": item_name,
                    "current_quantity": current_qty,
                    "prior_quantity": prior_qty,
                    "change_pct": round(change_pct, 1),
                    "period_start": current_start.isoformat(),
                    "period_end": current_end.isoformat(),
                }
            )

            if alert_id:
                alerts_created += 1

        # Check for crash
        elif change_pct <= -crash_threshold:
            fingerprint = f"{ALERT_TYPE_ITEM_CRASH}:{item_name}:{current_start.isoformat()}"

            alert_id = create_alert(
                tenant_id=tenant_id,
                alert_type=ALERT_TYPE_ITEM_CRASH,
                title=f"'{item_name}' sales dropped {abs(change_pct):.0f}%",
                message=f"Sold {current_qty} units last week, down from {prior_qty} the week before.",
                severity="warning",
                fingerprint=fingerprint,
                data={
                    "item_name": item_name,
                    "current_quantity": current_qty,
                    "prior_quantity": prior_qty,
                    "change_pct": round(change_pct, 1),
                    "period_start": current_start.isoformat(),
                    "period_end": current_end.isoformat(),
                }
            )

            if alert_id:
                alerts_created += 1

    return alerts_created


def get_quadrant_for_period(
    tenant_id: str,
    year: int,
    month: int
) -> Dict[str, str]:
    """
    Get item quadrants for a specific month.

    Returns dict mapping item_name -> quadrant.
    """
    # Calculate date range for the month
    start_date = f"{year}-{month:02d}-01"
    if month == 12:
        end_date = f"{year + 1}-01-01"
    else:
        end_date = f"{year}-{month + 1:02d}-01"

    # Get transaction data for quadrant calculation
    result = supabase.table("transactions") \
        .select("item_name, gross_revenue, is_excluded") \
        .eq("tenant_id", tenant_id) \
        .eq("is_excluded", False) \
        .gte("receipt_timestamp", start_date) \
        .lt("receipt_timestamp", end_date) \
        .execute()

    if not result.data:
        return {}

    # Aggregate by item
    item_data: Dict[str, Dict] = {}
    for row in result.data:
        item_name = row.get("item_name", "Unknown")
        if item_name not in item_data:
            item_data[item_name] = {"quantity": 0, "total_revenue": 0}
        item_data[item_name]["quantity"] += 1
        item_data[item_name]["total_revenue"] += row.get("gross_revenue", 0)

    # Calculate avg price per item
    for item_name, data in item_data.items():
        if data["quantity"] > 0:
            data["avg_price"] = data["total_revenue"] / data["quantity"]
        else:
            data["avg_price"] = 0

    # Calculate medians
    quantities = sorted([d["quantity"] for d in item_data.values()])
    prices = sorted([d["avg_price"] for d in item_data.values()])

    if not quantities:
        return {}

    mid = len(quantities) // 2
    median_qty = quantities[mid] if len(quantities) % 2 else (quantities[mid-1] + quantities[mid]) / 2

    mid = len(prices) // 2
    median_price = prices[mid] if len(prices) % 2 else (prices[mid-1] + prices[mid]) / 2

    # Assign quadrants
    quadrants: Dict[str, str] = {}
    for item_name, data in item_data.items():
        high_popularity = data["quantity"] >= median_qty
        high_profitability = data["avg_price"] >= median_price

        if high_popularity and high_profitability:
            quadrants[item_name] = "Star"
        elif high_popularity and not high_profitability:
            quadrants[item_name] = "Plowhorse"
        elif not high_popularity and high_profitability:
            quadrants[item_name] = "Puzzle"
        else:
            quadrants[item_name] = "Dog"

    return quadrants


def detect_quadrant_changes(tenant_id: str, settings: Dict) -> int:
    """
    Detect items that moved to Star or Dog quadrant.

    Compares current month vs prior month (based on latest transaction date).
    Returns count of alerts created.
    """
    if not settings.get("quadrant_alerts_enabled", True):
        return 0

    alerts_created = 0

    # Use latest transaction date instead of today
    latest_date = get_latest_transaction_date(tenant_id)
    if not latest_date:
        return 0

    # Get current and prior month based on latest data
    current_year = latest_date.year
    current_month = latest_date.month

    if current_month == 1:
        prior_year = current_year - 1
        prior_month = 12
    else:
        prior_year = current_year
        prior_month = current_month - 1

    # Get quadrants for both periods
    current_quadrants = get_quadrant_for_period(tenant_id, current_year, current_month)
    prior_quadrants = get_quadrant_for_period(tenant_id, prior_year, prior_month)

    if not prior_quadrants:
        return 0

    # Check for movements to Star or Dog
    for item_name, current_quad in current_quadrants.items():
        prior_quad = prior_quadrants.get(item_name)

        if prior_quad is None:
            continue  # New item, skip

        # New Star (wasn't Star before, is Star now)
        if current_quad == "Star" and prior_quad != "Star":
            fingerprint = f"{ALERT_TYPE_NEW_STAR}:{item_name}:{current_year}-{current_month:02d}"

            alert_id = create_alert(
                tenant_id=tenant_id,
                alert_type=ALERT_TYPE_NEW_STAR,
                title=f"'{item_name}' is now a Star!",
                message=f"Moved from {prior_quad} quadrant to Star (high popularity + high profitability).",
                severity="info",
                fingerprint=fingerprint,
                data={
                    "item_name": item_name,
                    "previous_quadrant": prior_quad,
                    "current_quadrant": current_quad,
                    "month": f"{current_year}-{current_month:02d}",
                }
            )

            if alert_id:
                alerts_created += 1

        # New Dog (wasn't Dog before, is Dog now)
        elif current_quad == "Dog" and prior_quad != "Dog":
            fingerprint = f"{ALERT_TYPE_NEW_DOG}:{item_name}:{current_year}-{current_month:02d}"

            alert_id = create_alert(
                tenant_id=tenant_id,
                alert_type=ALERT_TYPE_NEW_DOG,
                title=f"'{item_name}' dropped to Dog",
                message=f"Moved from {prior_quad} quadrant to Dog (low popularity + low profitability).",
                severity="warning",
                fingerprint=fingerprint,
                data={
                    "item_name": item_name,
                    "previous_quadrant": prior_quad,
                    "current_quadrant": current_quad,
                    "month": f"{current_year}-{current_month:02d}",
                }
            )

            if alert_id:
                alerts_created += 1

    return alerts_created


def run_anomaly_scan(tenant_id: str) -> int:
    """
    Run all anomaly detection algorithms.

    Returns total count of alerts created.
    """
    settings = get_alert_settings(tenant_id)
    total_alerts = 0

    # Run each detection algorithm
    total_alerts += detect_revenue_anomalies(tenant_id, settings)
    total_alerts += detect_item_anomalies(tenant_id, settings)
    total_alerts += detect_quadrant_changes(tenant_id, settings)

    return total_alerts
