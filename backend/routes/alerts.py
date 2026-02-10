"""
Alerts API routes.
Provides endpoints for viewing alerts, dismissing them, and managing alert settings.

Alerts are designed for recent, actionable notifications (last 7 days).
For historical movement analysis, use the /api/analytics/movements endpoints.
"""
from typing import Optional, List
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from pydantic import BaseModel

from middleware.auth import get_user_with_tenant, UserPayload
from middleware.auth_helpers import get_effective_tenant_id, require_owner_or_operator
from db.supabase import supabase
from utils.cache import data_cache

router = APIRouter(prefix="/api/alerts", tags=["alerts"])

# Alerts are limited to recent notifications only (7 days)
ALERTS_WINDOW_DAYS = 7


# ============================================
# REQUEST/RESPONSE MODELS
# ============================================

class AlertResponse(BaseModel):
    """Single alert."""
    id: str
    tenant_id: str
    type: str
    severity: str
    title: str
    message: Optional[str] = None
    data: Optional[dict] = None
    created_at: str
    dismissed_at: Optional[str] = None
    dismissed_by: Optional[str] = None


class AlertsListResponse(BaseModel):
    """List of alerts."""
    alerts: List[AlertResponse]
    total: int
    active_count: int


class AlertSettingsResponse(BaseModel):
    """Alert settings for a tenant."""
    tenant_id: str
    revenue_drop_pct: int
    item_spike_pct: int
    item_crash_pct: int
    quadrant_alerts_enabled: bool
    updated_at: str


class AlertSettingsUpdate(BaseModel):
    """Request body for updating alert settings."""
    revenue_drop_pct: Optional[int] = None
    item_spike_pct: Optional[int] = None
    item_crash_pct: Optional[int] = None
    quadrant_alerts_enabled: Optional[bool] = None


class ScanResponse(BaseModel):
    """Response from triggering an anomaly scan."""
    job_id: str
    status: str
    message: str


class ScanJobStatusResponse(BaseModel):
    """Status response for an anomaly scan job."""
    job_id: str
    tenant_id: str
    status: str
    alerts_created: Optional[int] = None
    scan_duration_ms: Optional[int] = None
    error_message: Optional[str] = None
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None


class WatchlistItem(BaseModel):
    """Single watched item configuration."""
    id: str
    tenant_id: str
    item_name: str
    revenue_drop_pct: int
    revenue_spike_pct: int
    notes: Optional[str] = None
    is_active: bool
    created_at: str
    updated_at: str
    created_by: Optional[str] = None


class WatchlistItemCreate(BaseModel):
    """Create a new watched item."""
    item_name: str
    revenue_drop_pct: Optional[int] = None
    revenue_spike_pct: Optional[int] = None
    notes: Optional[str] = None


class WatchlistItemUpdate(BaseModel):
    """Update watched item thresholds."""
    revenue_drop_pct: Optional[int] = None
    revenue_spike_pct: Optional[int] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class WatchlistSummaryItem(BaseModel):
    """Summary performance for a watched item."""
    id: str
    item_name: str
    revenue: int
    quantity: int
    order_count: int
    avg_price: int
    previous_revenue: int
    previous_quantity: int
    previous_order_count: int
    revenue_change_pct: Optional[float] = None
    quantity_change_pct: Optional[float] = None
    revenue_drop_pct: int
    revenue_spike_pct: int
    status: str


class WatchlistSummaryResponse(BaseModel):
    """Summary response for watched items."""
    items: List[WatchlistSummaryItem]
    period: dict
    generated_at: str


# ============================================
# HELPER FUNCTIONS
# ============================================

def _parse_date_param(value: Optional[str], label: str) -> Optional[datetime.date]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value).date()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {label} format: {value}. Use YYYY-MM-DD."
        ) from exc


def _resolve_watchlist_period(
    start_date: Optional[str],
    end_date: Optional[str],
) -> tuple[datetime.date, datetime.date, datetime.date, datetime.date]:
    end = _parse_date_param(end_date, "end_date") or datetime.utcnow().date()
    start = _parse_date_param(start_date, "start_date") or (end - timedelta(days=30))

    if start > end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date must be on or before end_date"
        )

    period_days = (end - start).days + 1
    prev_end = start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=period_days - 1)

    return start, end, prev_start, prev_end


def _run_alert_scan_job(job_id: str, tenant_id: str) -> None:
    """Background job to run anomaly scan and update job status."""
    import time
    from modules.anomaly import run_anomaly_scan

    try:
        supabase.table("alert_scan_jobs").update({
            "status": "processing",
            "started_at": datetime.utcnow().isoformat(),
        }).eq("id", job_id).execute()

        start_time = time.time()
        alerts_created = run_anomaly_scan(tenant_id)
        duration_ms = int((time.time() - start_time) * 1000)

        supabase.table("alert_scan_jobs").update({
            "status": "completed",
            "alerts_created": alerts_created,
            "scan_duration_ms": duration_ms,
            "completed_at": datetime.utcnow().isoformat(),
        }).eq("id", job_id).execute()

        # Invalidate cached alerts list so new alerts appear
        data_cache.invalidate_prefix("alerts_list")
    except Exception as exc:
        supabase.table("alert_scan_jobs").update({
            "status": "failed",
            "error_message": str(exc),
            "completed_at": datetime.utcnow().isoformat(),
        }).eq("id", job_id).execute()


# ============================================
# ALERTS ENDPOINTS
# ============================================

@router.get("", response_model=AlertsListResponse)
async def list_alerts(
    user: UserPayload = Depends(get_user_with_tenant),
    tenant_id: Optional[str] = None,
    active_only: bool = Query(False, description="Only return active (not dismissed) alerts"),
    alert_type: Optional[str] = Query(None, description="Filter by alert type"),
    severity: Optional[str] = Query(None, description="Filter by severity"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """
    List alerts for a tenant.

    Returns alerts sorted by created_at descending (newest first).
    Active alerts (not dismissed) appear before dismissed alerts.

    NOTE: Alerts are limited to the last 7 days only (ALERTS_WINDOW_DAYS).
    For historical movement analysis, use /api/analytics/movements endpoints.
    Cached for 30 seconds.
    """
    effective_tenant_id = get_effective_tenant_id(user, tenant_id)

    # Calculate the cutoff date for the 7-day window
    cutoff_date = (datetime.utcnow() - timedelta(days=ALERTS_WINDOW_DAYS)).isoformat()

    def fetch_alerts():
        # Build query
        query = supabase.table("alerts").select("*", count="exact")
        query = query.eq("tenant_id", effective_tenant_id)

        # Always filter to last 7 days - alerts are for recent activity only
        query = query.gte("created_at", cutoff_date)

        if active_only:
            query = query.is_("dismissed_at", "null")
        if alert_type:
            query = query.eq("type", alert_type)
        if severity:
            query = query.eq("severity", severity)

        # Sort by dismissed status then by date
        query = query.order("dismissed_at", desc=False, nullsfirst=True)
        query = query.order("created_at", desc=True)
        query = query.range(offset, offset + limit - 1)

        result = query.execute()

        # Get active count separately (also within 7-day window)
        active_result = supabase.table("alerts").select("id", count="exact") \
            .eq("tenant_id", effective_tenant_id) \
            .gte("created_at", cutoff_date) \
            .is_("dismissed_at", "null") \
            .execute()

        return {
            "alerts": result.data or [],
            "total": result.count or 0,
            "active_count": active_result.count or 0,
        }

    cached_data = data_cache.get_or_fetch(
        prefix="alerts_list",
        fetch_fn=fetch_alerts,
        ttl="short",
        tenant_id=effective_tenant_id,
        active_only=active_only,
        alert_type=alert_type,
        severity=severity,
        limit=limit,
        offset=offset,
    )

    alerts = [
        AlertResponse(
            id=a["id"],
            tenant_id=a["tenant_id"],
            type=a["type"],
            severity=a["severity"],
            title=a["title"],
            message=a.get("message"),
            data=a.get("data"),
            created_at=a["created_at"],
            dismissed_at=a.get("dismissed_at"),
            dismissed_by=a.get("dismissed_by"),
        )
        for a in cached_data["alerts"]
    ]

    return AlertsListResponse(
        alerts=alerts,
        total=cached_data["total"],
        active_count=cached_data["active_count"],
    )


@router.post("/{alert_id}/dismiss")
async def dismiss_alert(
    alert_id: str,
    user: UserPayload = Depends(get_user_with_tenant),
):
    """
    Dismiss an alert.

    Only the tenant owner can dismiss alerts.
    Sets dismissed_at and dismissed_by fields.
    """
    # First, get the alert to check tenant
    alert_result = supabase.table("alerts").select("tenant_id, dismissed_at") \
        .eq("id", alert_id).single().execute()

    if not alert_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found"
        )

    alert = alert_result.data

    # Check permissions
    require_owner_or_operator(user, alert["tenant_id"])

    # Check if already dismissed
    if alert.get("dismissed_at"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Alert already dismissed"
        )

    # Dismiss the alert
    update_result = supabase.table("alerts").update({
        "dismissed_at": datetime.utcnow().isoformat(),
        "dismissed_by": user.sub,
    }).eq("id", alert_id).execute()

    return {"message": "Alert dismissed", "alert_id": alert_id}


@router.post("/scan", response_model=ScanResponse)
async def trigger_scan(
    background_tasks: BackgroundTasks,
    user: UserPayload = Depends(get_user_with_tenant),
    tenant_id: Optional[str] = None,
):
    """
    Manually trigger an anomaly detection scan.

    Runs all detection algorithms and creates alerts for any anomalies found.
    """
    effective_tenant_id = get_effective_tenant_id(user, tenant_id)
    require_owner_or_operator(user, effective_tenant_id)

    # Create scan job record
    job_result = supabase.table("alert_scan_jobs").insert({
        "tenant_id": effective_tenant_id,
        "status": "pending",
        "created_by": user.sub,
    }).execute()
    job_id = job_result.data[0]["id"]
    background_tasks.add_task(_run_alert_scan_job, job_id, effective_tenant_id)

    return ScanResponse(
        job_id=job_id,
        status="pending",
        message="Scan queued. Poll /api/alerts/scan/{job_id} for status.",
    )


@router.get("/scan/{job_id}", response_model=ScanJobStatusResponse)
async def get_scan_status(
    job_id: str,
    user: UserPayload = Depends(get_user_with_tenant),
):
    """Get status of an alert scan job."""
    result = supabase.table("alert_scan_jobs").select("*").eq("id", job_id).single().execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan job not found",
        )

    job = result.data
    require_owner_or_operator(user, job["tenant_id"])

    return ScanJobStatusResponse(
        job_id=job["id"],
        tenant_id=job["tenant_id"],
        status=job["status"],
        alerts_created=job.get("alerts_created"),
        scan_duration_ms=job.get("scan_duration_ms"),
        error_message=job.get("error_message"),
        created_at=job["created_at"],
        started_at=job.get("started_at"),
        completed_at=job.get("completed_at"),
    )


# ============================================
# ALERT SETTINGS ENDPOINTS
# ============================================

@router.get("/settings", response_model=AlertSettingsResponse)
async def get_alert_settings(
    user: UserPayload = Depends(get_user_with_tenant),
    tenant_id: Optional[str] = None,
):
    """
    Get alert settings for a tenant. Cached for 2 minutes.

    Creates default settings if none exist.
    """
    effective_tenant_id = get_effective_tenant_id(user, tenant_id)

    def fetch_settings():
        # Use RPC to get or create settings
        result = supabase.rpc("get_or_create_alert_settings", {
            "p_tenant_id": effective_tenant_id
        }).execute()
        return result.data

    # Cache for 2 minutes - settings change occasionally
    settings = data_cache.get_or_fetch(
        prefix="alert_settings",
        fetch_fn=fetch_settings,
        ttl="medium",
        tenant_id=effective_tenant_id
    )

    if not settings:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get alert settings"
        )

    return AlertSettingsResponse(
        tenant_id=settings["tenant_id"],
        revenue_drop_pct=settings["revenue_drop_pct"],
        item_spike_pct=settings["item_spike_pct"],
        item_crash_pct=settings["item_crash_pct"],
        quadrant_alerts_enabled=settings["quadrant_alerts_enabled"],
        updated_at=settings["updated_at"],
    )


@router.put("/settings", response_model=AlertSettingsResponse)
async def update_alert_settings(
    body: AlertSettingsUpdate,
    user: UserPayload = Depends(get_user_with_tenant),
    tenant_id: Optional[str] = None,
):
    """
    Update alert settings for a tenant.

    Only the tenant owner can update settings.
    """
    effective_tenant_id = get_effective_tenant_id(user, tenant_id)

    # Check permissions - owner only
    require_owner_or_operator(user, effective_tenant_id)

    # Ensure settings exist
    supabase.rpc("get_or_create_alert_settings", {
        "p_tenant_id": effective_tenant_id
    }).execute()

    # Build update data (only include non-None values)
    update_data = {}
    if body.revenue_drop_pct is not None:
        update_data["revenue_drop_pct"] = body.revenue_drop_pct
    if body.item_spike_pct is not None:
        update_data["item_spike_pct"] = body.item_spike_pct
    if body.item_crash_pct is not None:
        update_data["item_crash_pct"] = body.item_crash_pct
    if body.quadrant_alerts_enabled is not None:
        update_data["quadrant_alerts_enabled"] = body.quadrant_alerts_enabled

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No settings to update"
        )

    # Update settings
    result = supabase.table("alert_settings").update(update_data) \
        .eq("tenant_id", effective_tenant_id).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update alert settings"
        )

    # Invalidate cache so next read gets fresh data
    data_cache.invalidate("alert_settings", tenant_id=effective_tenant_id)

    settings = result.data[0]

    return AlertSettingsResponse(
        tenant_id=settings["tenant_id"],
        revenue_drop_pct=settings["revenue_drop_pct"],
        item_spike_pct=settings["item_spike_pct"],
        item_crash_pct=settings["item_crash_pct"],
        quadrant_alerts_enabled=settings["quadrant_alerts_enabled"],
        updated_at=settings["updated_at"],
    )


# ============================================
# WATCH LIST ENDPOINTS
# ============================================

@router.get("/watchlist", response_model=List[WatchlistItem])
async def list_watchlist_items(
    user: UserPayload = Depends(get_user_with_tenant),
    tenant_id: Optional[str] = None,
):
    """List watched items for a tenant."""
    effective_tenant_id = get_effective_tenant_id(user, tenant_id)

    result = supabase.table("watched_items") \
        .select("*") \
        .eq("tenant_id", effective_tenant_id) \
        .order("created_at", desc=True) \
        .execute()

    return result.data or []


@router.post("/watchlist", response_model=WatchlistItem)
async def create_watchlist_item(
    body: WatchlistItemCreate,
    user: UserPayload = Depends(get_user_with_tenant),
    tenant_id: Optional[str] = None,
):
    """Add an item to the watch list."""
    effective_tenant_id = get_effective_tenant_id(user, tenant_id)
    require_owner_or_operator(user, effective_tenant_id)

    item_name = body.item_name.strip()
    if not item_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Item name is required"
        )

    existing = supabase.table("watched_items") \
        .select("id") \
        .eq("tenant_id", effective_tenant_id) \
        .eq("item_name", item_name) \
        .execute()
    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Item already in watch list"
        )

    payload = {
        "tenant_id": effective_tenant_id,
        "item_name": item_name,
        "created_by": user.sub,
    }
    if body.revenue_drop_pct is not None:
        payload["revenue_drop_pct"] = body.revenue_drop_pct
    if body.revenue_spike_pct is not None:
        payload["revenue_spike_pct"] = body.revenue_spike_pct
    if body.notes is not None:
        payload["notes"] = body.notes

    result = supabase.table("watched_items").insert(payload).execute()
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create watch list item"
        )

    data_cache.invalidate_prefix("watchlist_summary")

    return result.data[0]


@router.put("/watchlist/{watch_id}", response_model=WatchlistItem)
async def update_watchlist_item(
    watch_id: str,
    body: WatchlistItemUpdate,
    user: UserPayload = Depends(get_user_with_tenant),
):
    """Update thresholds or notes for a watched item."""
    existing = supabase.table("watched_items") \
        .select("*") \
        .eq("id", watch_id) \
        .single() \
        .execute()

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watched item not found"
        )

    watch_item = existing.data
    require_owner_or_operator(user, watch_item["tenant_id"])

    update_data = {}
    if body.revenue_drop_pct is not None:
        update_data["revenue_drop_pct"] = body.revenue_drop_pct
    if body.revenue_spike_pct is not None:
        update_data["revenue_spike_pct"] = body.revenue_spike_pct
    if body.notes is not None:
        update_data["notes"] = body.notes
    if body.is_active is not None:
        update_data["is_active"] = body.is_active

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )

    result = supabase.table("watched_items") \
        .update(update_data) \
        .eq("id", watch_id) \
        .execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update watch list item"
        )

    data_cache.invalidate_prefix("watchlist_summary")

    return result.data[0]


@router.delete("/watchlist/{watch_id}")
async def delete_watchlist_item(
    watch_id: str,
    user: UserPayload = Depends(get_user_with_tenant),
):
    """Remove an item from the watch list."""
    existing = supabase.table("watched_items") \
        .select("tenant_id") \
        .eq("id", watch_id) \
        .single() \
        .execute()

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watched item not found"
        )

    require_owner_or_operator(user, existing.data["tenant_id"])

    supabase.table("watched_items") \
        .delete() \
        .eq("id", watch_id) \
        .execute()

    data_cache.invalidate_prefix("watchlist_summary")

    return {"success": True, "watch_id": watch_id}


@router.get("/watchlist/summary", response_model=WatchlistSummaryResponse)
async def get_watchlist_summary(
    user: UserPayload = Depends(get_user_with_tenant),
    tenant_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    branches: Optional[str] = None,
    categories: Optional[str] = None,
):
    """Get watched items performance summary with period-over-period comparison."""
    effective_tenant_id = get_effective_tenant_id(user, tenant_id)
    start_dt, end_dt, prev_start, prev_end = _resolve_watchlist_period(start_date, end_date)

    branch_list = branches.split(",") if branches else None
    category_list = categories.split(",") if categories else None

    watch_result = supabase.table("watched_items") \
        .select("*") \
        .eq("tenant_id", effective_tenant_id) \
        .eq("is_active", True) \
        .execute()

    watch_items = watch_result.data or []
    if not watch_items:
        return WatchlistSummaryResponse(
            items=[],
            period={
                "start_date": start_dt.isoformat(),
                "end_date": end_dt.isoformat(),
                "previous_start_date": prev_start.isoformat(),
                "previous_end_date": prev_end.isoformat(),
            },
            generated_at=datetime.utcnow().isoformat(),
        )

    item_names = [item["item_name"] for item in watch_items]

    current_result = supabase.rpc("get_watched_items_summary_v1", {
        "p_tenant_id": effective_tenant_id,
        "p_item_names": item_names,
        "p_start_date": start_dt.isoformat(),
        "p_end_date": end_dt.isoformat(),
        "p_branches": branch_list,
        "p_categories": category_list,
    }).execute()

    previous_result = supabase.rpc("get_watched_items_summary_v1", {
        "p_tenant_id": effective_tenant_id,
        "p_item_names": item_names,
        "p_start_date": prev_start.isoformat(),
        "p_end_date": prev_end.isoformat(),
        "p_branches": branch_list,
        "p_categories": category_list,
    }).execute()

    current_map = {row.get("item_name"): row for row in (current_result.data or [])}
    prev_map = {row.get("item_name"): row for row in (previous_result.data or [])}

    summary_items: list[WatchlistSummaryItem] = []
    for watch_item in watch_items:
        name = watch_item.get("item_name")
        current = current_map.get(name, {}) if name else {}
        previous = prev_map.get(name, {}) if name else {}

        current_revenue = int(current.get("total_revenue", 0) or 0)
        current_quantity = int(current.get("total_quantity", 0) or 0)
        current_orders = int(current.get("order_count", 0) or 0)
        current_avg_price = int(current.get("avg_price", 0) or 0)

        previous_revenue = int(previous.get("total_revenue", 0) or 0)
        previous_quantity = int(previous.get("total_quantity", 0) or 0)
        previous_orders = int(previous.get("order_count", 0) or 0)

        revenue_change_pct = None
        quantity_change_pct = None

        if previous_revenue > 0:
            revenue_change_pct = round(((current_revenue - previous_revenue) / previous_revenue) * 100, 1)
        if previous_quantity > 0:
            quantity_change_pct = round(((current_quantity - previous_quantity) / previous_quantity) * 100, 1)

        revenue_drop_pct = int(watch_item.get("revenue_drop_pct", 20) or 20)
        revenue_spike_pct = int(watch_item.get("revenue_spike_pct", 50) or 50)

        status = "ok"
        if revenue_change_pct is None:
            status = "new" if current_revenue > 0 else "ok"
        elif revenue_change_pct >= revenue_spike_pct:
            status = "spike"
        elif revenue_change_pct <= -revenue_drop_pct:
            status = "drop"

        summary_items.append(WatchlistSummaryItem(
            id=watch_item["id"],
            item_name=name,
            revenue=current_revenue,
            quantity=current_quantity,
            order_count=current_orders,
            avg_price=current_avg_price,
            previous_revenue=previous_revenue,
            previous_quantity=previous_quantity,
            previous_order_count=previous_orders,
            revenue_change_pct=revenue_change_pct,
            quantity_change_pct=quantity_change_pct,
            revenue_drop_pct=revenue_drop_pct,
            revenue_spike_pct=revenue_spike_pct,
            status=status,
        ))

    summary_items.sort(key=lambda item: item.revenue, reverse=True)

    return WatchlistSummaryResponse(
        items=summary_items,
        period={
            "start_date": start_dt.isoformat(),
            "end_date": end_dt.isoformat(),
            "previous_start_date": prev_start.isoformat(),
            "previous_end_date": prev_end.isoformat(),
        },
        generated_at=datetime.utcnow().isoformat(),
    )
