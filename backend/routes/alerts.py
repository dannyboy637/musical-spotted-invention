"""
Alerts API routes.
Provides endpoints for viewing alerts, dismissing them, and managing alert settings.
"""
from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel

from middleware.auth import get_user_with_tenant, UserPayload
from middleware.auth_helpers import get_effective_tenant_id, require_owner_or_operator
from db.supabase import supabase
from utils.cache import data_cache

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


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
    alerts_created: int
    scan_duration_ms: int
    message: str


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
    Cached for 30 seconds.
    """
    effective_tenant_id = get_effective_tenant_id(user, tenant_id)

    def fetch_alerts():
        # Build query
        query = supabase.table("alerts").select("*", count="exact")
        query = query.eq("tenant_id", effective_tenant_id)

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

        # Get active count separately
        active_result = supabase.table("alerts").select("id", count="exact") \
            .eq("tenant_id", effective_tenant_id) \
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
    user: UserPayload = Depends(get_user_with_tenant),
    tenant_id: Optional[str] = None,
):
    """
    Manually trigger an anomaly detection scan.

    Runs all detection algorithms and creates alerts for any anomalies found.
    """
    import time
    from modules.anomaly import run_anomaly_scan

    effective_tenant_id = get_effective_tenant_id(user, tenant_id)

    start_time = time.time()
    alerts_created = run_anomaly_scan(effective_tenant_id)
    duration_ms = int((time.time() - start_time) * 1000)

    return ScanResponse(
        alerts_created=alerts_created,
        scan_duration_ms=duration_ms,
        message=f"Scan complete. {alerts_created} new alerts created.",
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
