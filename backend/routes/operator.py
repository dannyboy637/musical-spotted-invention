"""
Operator Control Hub routes.
All endpoints require operator role.
"""
from typing import Optional, List
from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from middleware.auth import require_operator, UserPayload
from db.supabase import supabase

router = APIRouter(prefix="/api/operator", tags=["operator"])


# ===========================================
# REQUEST/RESPONSE MODELS
# ===========================================

class TaskCreate(BaseModel):
    """Request body for creating a task."""
    title: str
    description: Optional[str] = None
    tenant_id: Optional[str] = None
    priority: str = "medium"
    due_date: Optional[date] = None


class TaskUpdate(BaseModel):
    """Request body for updating a task."""
    title: Optional[str] = None
    description: Optional[str] = None
    tenant_id: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    due_date: Optional[date] = None


class NoteCreate(BaseModel):
    """Request body for creating a note."""
    content: str
    is_pinned: bool = False


class NoteUpdate(BaseModel):
    """Request body for updating a note."""
    content: Optional[str] = None
    is_pinned: Optional[bool] = None


class NaturalLanguageQuery(BaseModel):
    """Request body for natural language query."""
    tenant_id: str
    query: str


class TenantStatusUpdate(BaseModel):
    """Request body for enabling/disabling tenant."""
    is_active: bool


# ===========================================
# DASHBOARD OVERVIEW
# ===========================================

@router.get("/dashboard")
async def get_operator_dashboard(user: UserPayload = Depends(require_operator)):
    """
    Get aggregated dashboard data for all tenants.
    Returns health stats, alerts, and task counts.
    """
    today = date.today().isoformat()

    # Sequential queries (parallel ThreadPoolExecutor was adding overhead)
    health_result = supabase.rpc("get_tenant_health_stats").execute()
    tasks_result = supabase.table("operator_tasks").select("id", count="exact").eq("created_by", user.sub).eq("status", "pending").execute()
    overdue_result = supabase.table("operator_tasks").select("id", count="exact").eq("created_by", user.sub).eq("status", "pending").lt("due_date", today).execute()

    # Process tenant health data
    tenants = health_result.data or []

    enriched_tenants = []
    for tenant in tenants:
        # Use recent data if available, otherwise show all-time data
        recent_revenue = tenant.get("recent_revenue", 0) or 0
        total_revenue = tenant.get("total_revenue", 0) or 0
        recent_txns = tenant.get("recent_transactions", 0) or 0
        total_txns = tenant.get("total_transactions", 0) or 0

        # If no recent data, show all-time with a flag
        if recent_txns == 0 and total_txns > 0:
            display_revenue = total_revenue
            display_txns = total_txns
            data_period = "all_time"
        else:
            display_revenue = recent_revenue
            display_txns = recent_txns
            data_period = "recent"

        # Calculate avg check
        avg_check = display_revenue / display_txns if display_txns > 0 else 0

        # Calculate days since last data
        last_data = tenant.get("last_data_at")
        if last_data:
            if isinstance(last_data, str):
                last_data_dt = datetime.fromisoformat(last_data.replace("Z", "+00:00"))
            else:
                last_data_dt = last_data
            days_since_data = (datetime.utcnow().replace(tzinfo=last_data_dt.tzinfo) - last_data_dt).days
        else:
            days_since_data = None

        critical_alerts = tenant.get("critical_alert_count", 0) or 0
        alert_count = tenant.get("alert_count", 0) or 0

        # Health status logic:
        # Green: has data AND <7 days old AND no critical alerts
        # Yellow: 7-14 days old OR has warnings
        # Red: >14 days old OR no data OR has critical alerts
        if days_since_data is None or days_since_data > 14 or critical_alerts > 0:
            health_status = "red"
        elif days_since_data > 7 or alert_count > 0:
            health_status = "yellow"
        else:
            health_status = "green"

        enriched_tenants.append({
            "tenant_id": tenant.get("tenant_id"),
            "tenant_name": tenant.get("tenant_name"),
            "tenant_slug": tenant.get("tenant_slug"),
            "is_active": tenant.get("is_active", True),
            "revenue_this_week": display_revenue,
            "revenue_trend_pct": 0.0,  # Trend requires period comparison, simplified for now
            "transaction_count": display_txns,
            "avg_check": round(avg_check),
            "days_since_import": days_since_data,
            "health_status": health_status,
            "alert_count": alert_count,
            "critical_alert_count": critical_alerts,
            "user_count": tenant.get("user_count", 0) or 0,
            "data_period": data_period,  # "recent" or "all_time"
        })

    pending_tasks = tasks_result.count or 0
    overdue_tasks = overdue_result.count or 0

    return {
        "tenants": enriched_tenants,
        "summary": {
            "total_tenants": len(enriched_tenants),
            "active_tenants": len([t for t in enriched_tenants if t.get("is_active", True)]),
            "healthy_tenants": len([t for t in enriched_tenants if t["health_status"] == "green"]),
            "attention_needed": len([t for t in enriched_tenants if t["health_status"] in ("yellow", "red")]),
            "pending_tasks": pending_tasks,
            "overdue_tasks": overdue_tasks,
        },
    }


# ===========================================
# SYSTEM HEALTH
# ===========================================

@router.get("/health")
async def get_system_health(user: UserPayload = Depends(require_operator)):
    """
    Get system health status including API, database, and services.
    """
    health = {
        "api": {"status": "healthy", "message": "API responding"},
        "database": {"status": "healthy", "message": "Connected"},
        "auth": {"status": "healthy", "message": "Supabase Auth active"},
    }

    # Check database connectivity
    try:
        result = supabase.table("tenants").select("id").limit(1).execute()
        health["database"]["message"] = "Connected, queries working"
    except Exception as e:
        health["database"]["status"] = "unhealthy"
        health["database"]["message"] = str(e)

    return health


# ===========================================
# API METRICS
# ===========================================

@router.get("/metrics")
async def get_api_metrics(
    hours: int = Query(default=24, ge=1, le=168),
    user: UserPayload = Depends(require_operator),
):
    """
    Get API performance metrics for the specified time range.
    """
    try:
        # Sequential queries (parallel ThreadPoolExecutor was adding overhead)
        stats_result = supabase.rpc("get_endpoint_stats", {"p_hours": hours}).execute()
        slow_result = supabase.rpc("get_slow_endpoints", {"p_hours": hours, "p_threshold_ms": 300}).execute()
        hourly_result = supabase.rpc("get_hourly_metrics", {"p_hours": hours}).execute()

        endpoint_stats = stats_result.data or []
        slow_endpoints = slow_result.data or []
        hourly_metrics = hourly_result.data or []

        # Calculate summary stats
        total_requests = sum(s.get("call_count", 0) for s in endpoint_stats)
        total_errors = sum(s.get("error_count", 0) for s in endpoint_stats)
        avg_response = (
            sum(s.get("avg_response_ms", 0) * s.get("call_count", 0) for s in endpoint_stats) /
            total_requests if total_requests > 0 else 0
        )

        return {
            "period_hours": hours,
            "summary": {
                "total_requests": total_requests,
                "total_errors": total_errors,
                "error_rate_pct": round((total_errors / total_requests * 100) if total_requests > 0 else 0, 2),
                "avg_response_ms": round(avg_response, 2),
                "slow_endpoint_count": len(slow_endpoints),
            },
            "endpoint_stats": endpoint_stats,
            "slow_endpoints": slow_endpoints,
            "hourly_metrics": hourly_metrics,
        }

    except Exception as e:
        # RPC functions may not exist yet
        return {
            "period_hours": hours,
            "summary": {
                "total_requests": 0,
                "total_errors": 0,
                "error_rate_pct": 0,
                "avg_response_ms": 0,
                "slow_endpoint_count": 0,
            },
            "endpoint_stats": [],
            "slow_endpoints": [],
            "hourly_metrics": [],
            "note": "Metrics collection starting - data will appear after API usage",
        }


# ===========================================
# ERROR LOGS
# ===========================================

@router.get("/errors")
async def get_error_logs(
    hours: int = Query(default=24, ge=1, le=720),
    tenant_id: Optional[str] = None,
    endpoint: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: UserPayload = Depends(require_operator),
):
    """
    Get recent error logs with optional filtering.
    """
    cutoff = (datetime.utcnow() - timedelta(hours=hours)).isoformat()

    query = supabase.table("error_logs").select(
        "*", count="exact"
    ).gte(
        "created_at", cutoff
    ).order(
        "created_at", desc=True
    )

    if tenant_id:
        query = query.eq("tenant_id", tenant_id)
    if endpoint:
        query = query.ilike("endpoint", f"%{endpoint}%")

    query = query.range(offset, offset + limit - 1)
    result = query.execute()

    return {
        "errors": result.data or [],
        "total": result.count or 0,
        "limit": limit,
        "offset": offset,
    }


# ===========================================
# DATA PIPELINE STATUS
# ===========================================

@router.get("/sync-status")
async def get_sync_status(user: UserPayload = Depends(require_operator)):
    """
    Get data import/sync status for all tenants.
    """
    # Get latest import job per tenant
    result = supabase.table("data_import_jobs").select(
        "*, tenants(name, slug)"
    ).order(
        "created_at", desc=True
    ).execute()

    # Group by tenant, keep latest
    tenant_imports = {}
    for job in (result.data or []):
        tid = job.get("tenant_id")
        if tid and tid not in tenant_imports:
            tenant_imports[tid] = job

    # Get all tenants to include those without imports
    tenants_result = supabase.table("tenants").select("id, name, slug").execute()

    sync_status = []
    for tenant in (tenants_result.data or []):
        job = tenant_imports.get(tenant["id"])
        if job:
            sync_status.append({
                "tenant_id": tenant["id"],
                "tenant_name": tenant["name"],
                "tenant_slug": tenant["slug"],
                "last_import_at": job.get("created_at"),
                "status": job.get("status"),
                "row_count": job.get("row_count"),
                "file_name": job.get("file_name"),
                "error_message": job.get("error_message"),
            })
        else:
            sync_status.append({
                "tenant_id": tenant["id"],
                "tenant_name": tenant["name"],
                "tenant_slug": tenant["slug"],
                "last_import_at": None,
                "status": "never",
                "row_count": 0,
                "file_name": None,
                "error_message": None,
            })

    return sync_status


# ===========================================
# OPERATOR TASKS
# ===========================================

@router.get("/tasks")
async def list_tasks(
    status: Optional[str] = None,
    tenant_id: Optional[str] = None,
    user: UserPayload = Depends(require_operator),
):
    """
    List operator's tasks with optional filtering.
    """
    query = supabase.table("operator_tasks").select(
        "*, tenants(name)"
    ).eq(
        "created_by", user.sub
    ).order(
        "due_date", desc=False, nullsfirst=False
    ).order(
        "created_at", desc=True
    )

    if status:
        query = query.eq("status", status)
    if tenant_id:
        query = query.eq("tenant_id", tenant_id)

    result = query.execute()
    return result.data or []


@router.post("/tasks", status_code=status.HTTP_201_CREATED)
async def create_task(
    task: TaskCreate,
    user: UserPayload = Depends(require_operator),
):
    """
    Create a new task.
    """
    data = {
        "title": task.title,
        "description": task.description,
        "priority": task.priority,
        "created_by": user.sub,
    }
    if task.tenant_id:
        data["tenant_id"] = task.tenant_id
    if task.due_date:
        data["due_date"] = task.due_date.isoformat()

    result = supabase.table("operator_tasks").insert(data).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create task",
        )

    return result.data[0]


@router.patch("/tasks/{task_id}")
async def update_task(
    task_id: str,
    task: TaskUpdate,
    user: UserPayload = Depends(require_operator),
):
    """
    Update a task.
    """
    # Verify ownership
    existing = supabase.table("operator_tasks").select(
        "id"
    ).eq(
        "id", task_id
    ).eq(
        "created_by", user.sub
    ).execute()

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    update_data = {}
    if task.title is not None:
        update_data["title"] = task.title
    if task.description is not None:
        update_data["description"] = task.description
    if task.tenant_id is not None:
        update_data["tenant_id"] = task.tenant_id
    if task.priority is not None:
        update_data["priority"] = task.priority
    if task.status is not None:
        update_data["status"] = task.status
        if task.status == "completed":
            update_data["completed_at"] = datetime.utcnow().isoformat()
    if task.due_date is not None:
        update_data["due_date"] = task.due_date.isoformat()

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    result = supabase.table("operator_tasks").update(
        update_data
    ).eq("id", task_id).execute()

    return result.data[0] if result.data else None


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: str,
    user: UserPayload = Depends(require_operator),
):
    """
    Delete a task.
    """
    # Verify ownership
    existing = supabase.table("operator_tasks").select(
        "id"
    ).eq(
        "id", task_id
    ).eq(
        "created_by", user.sub
    ).execute()

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    supabase.table("operator_tasks").delete().eq("id", task_id).execute()
    return None


# ===========================================
# CONSULTANT NOTES
# ===========================================

@router.get("/notes/{tenant_id}")
async def list_notes(
    tenant_id: str,
    user: UserPayload = Depends(require_operator),
):
    """
    List notes for a specific tenant.
    Pinned notes first, then by created_at.
    """
    result = supabase.table("consultant_notes").select(
        "*"
    ).eq(
        "tenant_id", tenant_id
    ).eq(
        "created_by", user.sub
    ).order(
        "is_pinned", desc=True
    ).order(
        "created_at", desc=True
    ).execute()

    return result.data or []


@router.post("/notes/{tenant_id}", status_code=status.HTTP_201_CREATED)
async def create_note(
    tenant_id: str,
    note: NoteCreate,
    user: UserPayload = Depends(require_operator),
):
    """
    Create a note for a tenant.
    """
    # Verify tenant exists
    tenant = supabase.table("tenants").select("id").eq("id", tenant_id).execute()
    if not tenant.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found",
        )

    result = supabase.table("consultant_notes").insert({
        "tenant_id": tenant_id,
        "content": note.content,
        "is_pinned": note.is_pinned,
        "created_by": user.sub,
    }).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create note",
        )

    return result.data[0]


@router.patch("/notes/{note_id}")
async def update_note(
    note_id: str,
    note: NoteUpdate,
    user: UserPayload = Depends(require_operator),
):
    """
    Update a note.
    """
    # Verify ownership
    existing = supabase.table("consultant_notes").select(
        "id"
    ).eq(
        "id", note_id
    ).eq(
        "created_by", user.sub
    ).execute()

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found",
        )

    update_data = {}
    if note.content is not None:
        update_data["content"] = note.content
    if note.is_pinned is not None:
        update_data["is_pinned"] = note.is_pinned

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    result = supabase.table("consultant_notes").update(
        update_data
    ).eq("id", note_id).execute()

    return result.data[0] if result.data else None


@router.delete("/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    note_id: str,
    user: UserPayload = Depends(require_operator),
):
    """
    Delete a note.
    """
    # Verify ownership
    existing = supabase.table("consultant_notes").select(
        "id"
    ).eq(
        "id", note_id
    ).eq(
        "created_by", user.sub
    ).execute()

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found",
        )

    supabase.table("consultant_notes").delete().eq("id", note_id).execute()
    return None


# ===========================================
# TENANT MANAGEMENT (Enable/Disable)
# ===========================================

@router.patch("/tenants/{tenant_id}/status")
async def update_tenant_status(
    tenant_id: str,
    status_update: TenantStatusUpdate,
    user: UserPayload = Depends(require_operator),
):
    """
    Enable or disable a tenant (soft delete).
    """
    # Check tenant exists
    existing = supabase.table("tenants").select("id, name").eq("id", tenant_id).execute()
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found",
        )

    result = supabase.table("tenants").update({
        "is_active": status_update.is_active,
    }).eq("id", tenant_id).execute()

    return {
        "id": tenant_id,
        "name": existing.data[0]["name"],
        "is_active": status_update.is_active,
        "message": f"Tenant {'enabled' if status_update.is_active else 'disabled'} successfully",
    }


# ===========================================
# AGGREGATED ALERTS
# ===========================================

@router.get("/alerts")
async def get_all_alerts(
    severity: Optional[str] = None,
    tenant_id: Optional[str] = None,
    dismissed: bool = False,
    limit: int = Query(default=50, ge=1, le=200),
    user: UserPayload = Depends(require_operator),
):
    """
    Get alerts across all tenants.
    """
    query = supabase.table("alerts").select(
        "*, tenants(name, slug)"
    ).order(
        "created_at", desc=True
    ).limit(limit)

    if not dismissed:
        query = query.is_("dismissed_at", "null")
    if severity:
        query = query.eq("severity", severity)
    if tenant_id:
        query = query.eq("tenant_id", tenant_id)

    result = query.execute()
    return result.data or []


# ===========================================
# NATURAL LANGUAGE QUERY (Mock)
# ===========================================

@router.post("/query")
async def natural_language_query(
    query_request: NaturalLanguageQuery,
    user: UserPayload = Depends(require_operator),
):
    """
    Process a natural language query about a tenant's data.
    Currently returns mock responses - will integrate with Claude API.
    """
    tenant_id = query_request.tenant_id
    query = query_request.query.lower()

    # Verify tenant exists
    tenant = supabase.table("tenants").select("id, name").eq("id", tenant_id).execute()
    if not tenant.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found",
        )

    tenant_name = tenant.data[0]["name"]

    # Mock responses based on query patterns
    if "top" in query and ("item" in query or "product" in query or "seller" in query):
        # Get top items via RPC (SQL-side aggregation)
        result = supabase.rpc("get_item_totals_v2", {
            "p_tenant_id": tenant_id,
            "p_exclude_excluded": True,
        }).execute()

        items_data = sorted(
            (result.data or []),
            key=lambda x: x.get("total_revenue", 0) or 0,
            reverse=True,
        )[:5]

        if items_data:
            response = f"Top 5 items for {tenant_name}:\n\n"
            for i, item in enumerate(items_data, 1):
                revenue = item.get("total_revenue", 0) or 0
                response += f"{i}. {item.get('item_name', 'Unknown')}: P{revenue/100:,.0f}\n"
        else:
            response = f"No transaction data available for {tenant_name} yet."

        return {
            "answer": response,
            "query": query_request.query,
            "tenant_name": tenant_name,
            "data_used": "get_item_totals_v2 RPC",
            "mock_mode": True,
        }

    elif "revenue" in query or "sales" in query:
        # Get revenue summary via RPC (SQL-side aggregation)
        result = supabase.rpc("get_analytics_overview", {
            "p_tenant_id": tenant_id,
            "p_start_date": None,
            "p_end_date": None,
            "p_branches": None,
            "p_categories": None,
        }).execute()

        data = result.data or {}
        total_revenue = data.get("total_revenue", 0)
        txn_count = data.get("total_transactions", 0)
        avg_ticket = data.get("avg_ticket", 0)

        response = f"Revenue summary for {tenant_name}:\n\n"
        response += f"- Total Revenue: P{total_revenue/100:,.0f}\n"
        response += f"- Total Transactions: {txn_count:,}\n"
        if avg_ticket > 0:
            response += f"- Average Check: P{avg_ticket/100:,.0f}\n"

        return {
            "answer": response,
            "query": query_request.query,
            "tenant_name": tenant_name,
            "data_used": "get_analytics_overview RPC",
            "mock_mode": True,
        }

    elif "alert" in query:
        # Get alerts
        result = supabase.table("alerts").select(
            "title, severity, created_at"
        ).eq(
            "tenant_id", tenant_id
        ).is_(
            "dismissed_at", "null"
        ).order(
            "created_at", desc=True
        ).limit(5).execute()

        if result.data:
            response = f"Active alerts for {tenant_name}:\n\n"
            for a in result.data:
                response += f"- [{a['severity'].upper()}] {a['title']}\n"
        else:
            response = f"No active alerts for {tenant_name}."

        return {
            "answer": response,
            "query": query_request.query,
            "tenant_name": tenant_name,
            "data_used": "alerts table",
            "mock_mode": True,
        }

    else:
        return {
            "answer": f"I can help you with questions about {tenant_name}'s data. Try asking about:\n\n- Top selling items\n- Revenue and sales\n- Active alerts\n\nFor example: 'What are the top 5 items?' or 'What's the total revenue?'",
            "query": query_request.query,
            "tenant_name": tenant_name,
            "data_used": None,
            "mock_mode": True,
        }
