"""
Data import and management routes.
"""
import asyncio
import re
import json
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks, Request
from pydantic import BaseModel

from middleware.auth import (
    get_user_with_tenant,
    require_operator,
    invalidate_user_cache,
    UserPayload,
)
from middleware.rate_limit import limiter
from db.supabase import supabase
from services.import_service import ImportService
from utils.cache import data_cache

router = APIRouter(prefix="/data", tags=["data"])


def _cleanup_stale_jobs_silent():
    """Clean up stale jobs before starting new upload. Silent - never fails."""
    try:
        result = supabase.rpc("cleanup_stale_import_jobs", {"p_timeout_hours": 1}).execute()
        if result.data and result.data.get("jobs_cleaned", 0) > 0:
            print(f"Pre-upload: Cleaned up {result.data['jobs_cleaned']} stale job(s)", flush=True)
    except Exception:
        pass  # Silent - don't block uploads if cleanup fails


# ============================================
# RESPONSE MODELS
# ============================================

class ImportJobResponse(BaseModel):
    """Response model for import job."""
    id: str
    tenant_id: str
    status: str
    file_name: str
    total_rows: Optional[int] = None
    processed_rows: Optional[int] = None
    inserted_rows: Optional[int] = None
    skipped_rows: Optional[int] = None
    error_rows: Optional[int] = None
    error_message: Optional[str] = None
    created_at: str


class UploadResponse(BaseModel):
    """Response for file upload."""
    job_id: str
    status: str
    message: str
    file_path: str


class RegenerateResponse(BaseModel):
    """Response for menu items regeneration."""
    status: str
    menu_items_updated: int


class CancelJobResponse(BaseModel):
    """Response for job cancellation."""
    success: bool
    job_id: str
    transactions_deleted: int
    message: str


class CleanupStaleResponse(BaseModel):
    """Response for stale job cleanup."""
    jobs_cleaned: int
    job_ids: list[str]


class ItemExclusion(BaseModel):
    """Single item exclusion entry."""
    id: str
    item_name: str
    reason: Optional[str] = None
    created_at: str
    created_by: Optional[str] = None


class ItemExclusionCreate(BaseModel):
    """Request to create a new item exclusion."""
    item_name: str
    reason: Optional[str] = None


class ItemExclusionSuggestion(BaseModel):
    """Suggested item exclusion based on low activity."""
    item_name: str
    total_quantity: int
    total_revenue: int
    order_count: int
    first_sale_date: Optional[str] = None
    last_sale_date: Optional[str] = None


class ItemExclusionSuggestionsResponse(BaseModel):
    """Response for exclusion suggestions."""
    suggestions: list[ItemExclusionSuggestion]
    thresholds: dict


class ItemExclusionDeleteResponse(BaseModel):
    """Response for deleting an exclusion."""
    success: bool
    deleted_id: str


# ============================================
# BACKGROUND TASK
# ============================================

async def process_import_task(
    import_service: ImportService,
    csv_content: str,
    file_name: str
):
    """Background task to process CSV import.

    Runs sync CSV processing in a thread pool executor to avoid
    blocking the async event loop (pandas I/O + DB calls are sync).
    """
    loop = asyncio.get_event_loop()
    try:
        await loop.run_in_executor(
            None, import_service.process_csv, csv_content, file_name
        )
        await loop.run_in_executor(
            None, import_service.regenerate_menu_items
        )
    except Exception as e:
        import_service.update_job_status(
            status="failed",
            error_message=str(e)
        )


def _refresh_analytics_after_exclusion(tenant_id: str) -> None:
    """Refresh summaries and menu items after exclusion changes."""
    try:
        supabase.rpc("refresh_all_summaries", {"p_tenant_id": tenant_id}).execute()
        print(f"Refreshed summary tables for tenant {tenant_id}", flush=True)
    except Exception as e:
        print(f"Warning: Summary table refresh failed: {e}", flush=True)

    try:
        supabase.rpc("regenerate_menu_items", {"p_tenant_id": tenant_id}).execute()
        print(f"Regenerated menu items for tenant {tenant_id}", flush=True)
    except Exception as e:
        print(f"Warning: Menu item regeneration failed: {e}", flush=True)

    data_cache.invalidate_tenant(tenant_id)


# ============================================
# UPLOAD ENDPOINTS
# ============================================

@router.post("/upload", response_model=UploadResponse)
@limiter.limit("20/minute")
async def upload_csv(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    tenant_id: Optional[str] = None,  # Operators can specify target tenant
    user: UserPayload = Depends(get_user_with_tenant),
):
    """
    Upload a CSV file for processing.

    - Operators can upload for any tenant (specify tenant_id param)
    - Owners can upload for their own tenant
    - Viewers cannot upload
    """
    if user.role == "viewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Viewers cannot upload data"
        )

    # Determine target tenant
    if user.role == "operator":
        # Operators: use provided tenant_id, fall back to user.tenant_id
        target_tenant = tenant_id or user.tenant_id
        if not target_tenant:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Operator must specify tenant_id or have an active tenant selected"
            )
    else:
        # Non-operators: must use their own tenant
        if not user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No tenant associated with user"
            )
        target_tenant = user.tenant_id
        # Non-operators cannot override tenant_id
        if tenant_id and tenant_id != user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot upload to a different tenant"
            )

    tenant_id = target_tenant

    # Validate file
    if not file.filename or not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only CSV files are accepted"
        )

    try:
        # Clean up any stale jobs before starting new upload
        _cleanup_stale_jobs_silent()

        # Read file content
        content = await file.read()
        file_size = len(content)

        # Generate storage path (for record keeping, even if we skip actual storage upload)
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        storage_path = f"{tenant_id}/{timestamp}_{file.filename}"

        # Try to upload to Supabase Storage, but don't fail if storage is unavailable
        try:
            supabase.storage.from_("csv-uploads").upload(
                storage_path,
                content,
                {"content-type": "text/csv"}
            )
        except Exception as e:
            # Log but continue - storage is optional, processing is what matters
            print(f"Warning: Storage upload failed (continuing anyway): {str(e)[:100]}", flush=True)
            storage_path = f"local://{timestamp}_{file.filename}"  # Mark as not stored

        # Create import service and job
        import_service = ImportService(tenant_id, user.sub)
        job_id = import_service.create_import_job(
            file_name=file.filename,
            file_path=storage_path,
            file_size=file_size
        )

        # Process in background
        background_tasks.add_task(
            process_import_task,
            import_service,
            content.decode('utf-8'),
            file.filename
        )

        return UploadResponse(
            job_id=job_id,
            status="pending",
            message="File uploaded successfully. Processing started.",
            file_path=storage_path
        )
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"UPLOAD ERROR: {e}", flush=True)
        print(traceback.format_exc(), flush=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload failed: {str(e)}"
        )


# ============================================
# IMPORT JOB ENDPOINTS
# ============================================

@router.post("/cache/invalidate")
async def invalidate_cache(
    user: UserPayload = Depends(require_operator),
):
    """Invalidate the user cache. Operator-only. Use after changing user tenant/role."""
    invalidate_user_cache(user.sub)
    data_cache.invalidate_all()
    return {"status": "ok", "message": "User and data caches invalidated"}


@router.get("/imports")
async def list_import_jobs(
    user: UserPayload = Depends(get_user_with_tenant),
    limit: int = 20,
    offset: int = 0,
    tenant_id: Optional[str] = None,
):
    """List import jobs for user's tenant (or all for operators)."""
    # Include tenant name via join
    query = supabase.table("data_import_jobs").select("*, tenants(name)")

    # Debug: Log what we're filtering by
    print(
        f"list_import_jobs: role={user.role}, tenant_id={user.tenant_id}, tenant_override={tenant_id}",
        flush=True,
    )

    # Operators with no active tenant see ALL imports across all tenants
    # Operators with active tenant see only that tenant's imports
    # Non-operators see only their tenant's imports
    if user.role == "operator":
        selected_tenant = tenant_id or user.tenant_id
        if selected_tenant:
            # Operator has selected a specific tenant to view
            query = query.eq("tenant_id", selected_tenant)
        # else: no filter, operators see all tenants
    elif user.tenant_id:
        if tenant_id and tenant_id != user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot view imports for a different tenant",
            )
        # Non-operator with assigned tenant
        query = query.eq("tenant_id", user.tenant_id)
    else:
        # Non-operator without tenant - no access
        return []

    result = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()

    # Flatten tenant name into job object for easier frontend consumption
    jobs = result.data or []
    for job in jobs:
        tenant_data = job.pop("tenants", None)
        # Handle both single object and list format from Supabase join
        if isinstance(tenant_data, list) and len(tenant_data) > 0:
            job["tenant_name"] = tenant_data[0].get("name")
        elif isinstance(tenant_data, dict):
            job["tenant_name"] = tenant_data.get("name")
        else:
            job["tenant_name"] = None

    return jobs


@router.get("/imports/{job_id}")
async def get_import_job(
    job_id: str,
    user: UserPayload = Depends(get_user_with_tenant),
):
    """Get specific import job details."""
    result = supabase.table("data_import_jobs").select("*").eq("id", job_id).single().execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Import job not found"
        )

    # Check access
    if user.role != "operator" and result.data.get("tenant_id") != user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    return result.data


@router.post("/imports/{job_id}/cancel", response_model=CancelJobResponse)
async def cancel_import_job(
    job_id: str,
    user: UserPayload = Depends(get_user_with_tenant),
):
    """
    Cancel an in-progress import job and delete any partially imported transactions.

    - Only pending or processing jobs can be cancelled
    - Operators can cancel any job
    - Owners can cancel their own tenant's jobs
    - Viewers cannot cancel
    """
    if user.role == "viewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Viewers cannot cancel imports"
        )

    # Call RPC function to handle cancellation atomically
    try:
        result = supabase.rpc("cancel_import_job", {
            "p_job_id": job_id,
            "p_user_id": user.sub,
        }).execute()
        print(f"Cancel RPC result: {result.data}", flush=True)
    except Exception as e:
        print(f"Cancel RPC error: {e}", flush=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"RPC call failed: {str(e)}"
        )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="RPC returned no data - function may not exist. Run migration 027."
        )

    response_data = result.data

    if not response_data.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=response_data.get("message", "Failed to cancel job")
        )

    # Invalidate caches if tenant_id is available
    if user.tenant_id:
        data_cache.invalidate_tenant(user.tenant_id)

    return CancelJobResponse(
        success=True,
        job_id=job_id,
        transactions_deleted=response_data.get("transactions_deleted", 0),
        message=response_data.get("message", "Job cancelled"),
    )


@router.post("/imports/{job_id}/delete", response_model=CancelJobResponse)
async def delete_import_job(
    job_id: str,
    user: UserPayload = Depends(get_user_with_tenant),
):
    """
    Delete a completed import and all its transactions.

    - Only completed, failed, or cancelled jobs can be deleted
    - Pending/processing jobs should use cancel instead
    - Operators can delete any job
    - Owners can delete their own tenant's jobs
    - Viewers cannot delete
    - Refreshes summary tables and menu items after deletion
    """
    if user.role == "viewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Viewers cannot delete imports"
        )

    print(f"Delete request: job_id={job_id}, user_id={user.sub}, role={user.role}", flush=True)

    # Call RPC function to handle deletion atomically
    try:
        result = supabase.rpc("delete_import_job", {
            "p_job_id": job_id,
            "p_user_id": user.sub,
        }).execute()
        print(f"Delete RPC result: {result.data}", flush=True)
        response_data = result.data
    except Exception as e:
        error_str = str(e)
        print(f"Delete RPC error: {error_str}", flush=True)
        response_data = None

        # Supabase sometimes has trouble parsing JSONB responses but includes the data in error details
        # The data appears as: b'{"job_id": "...", "success": true, ...}'
        # Try to extract the actual response from the error message
        if '"success": true' in error_str or '"success":true' in error_str:
            # Find the JSON object boundaries
            start_idx = error_str.find('{"job_id"')
            if start_idx != -1:
                # Find matching closing brace
                end_idx = error_str.find('}', start_idx)
                if end_idx != -1:
                    json_str = error_str[start_idx:end_idx + 1]
                    try:
                        response_data = json.loads(json_str)
                        print(f"Extracted response from error: {response_data}", flush=True)
                    except json.JSONDecodeError as je:
                        print(f"JSON decode error: {je}, json_str: {json_str}", flush=True)
                        response_data = None

        # If we couldn't extract a valid response, raise the original error
        if not response_data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error: {error_str}"
            )

    if not response_data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="RPC returned no data - function may not exist. Run migration 036."
        )

    if not response_data.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=response_data.get("error", "Failed to delete job")
        )

    # Get tenant_id from response (included by RPC) for refresh operations
    tenant_id = response_data.get("tenant_id") or user.tenant_id

    if tenant_id:
        # Refresh derived data after deletion
        try:
            supabase.rpc("refresh_all_summaries", {"p_tenant_id": tenant_id}).execute()
            print(f"Refreshed summary tables for tenant {tenant_id}", flush=True)
        except Exception as e:
            print(f"Warning: Summary table refresh failed: {e}", flush=True)

        try:
            supabase.rpc("regenerate_menu_items", {"p_tenant_id": tenant_id}).execute()
            print(f"Regenerated menu items for tenant {tenant_id}", flush=True)
        except Exception as e:
            print(f"Warning: Menu item regeneration failed: {e}", flush=True)

        # Invalidate caches
        data_cache.invalidate_tenant(tenant_id)

    return CancelJobResponse(
        success=True,
        job_id=job_id,
        transactions_deleted=response_data.get("transactions_deleted", 0),
        message=response_data.get("message", "Import deleted"),
    )


@router.post("/imports/cleanup-stale", response_model=CleanupStaleResponse)
async def cleanup_stale_jobs(
    user: UserPayload = Depends(require_operator),
    timeout_hours: int = 1,
):
    """
    Mark stale processing jobs as failed.

    Operator-only endpoint for manual cleanup.
    Jobs stuck in 'processing' for longer than timeout_hours are marked as failed.
    """
    result = supabase.rpc("cleanup_stale_import_jobs", {
        "p_timeout_hours": timeout_hours,
    }).execute()

    data = result.data if result.data else {"jobs_cleaned": 0, "job_ids": []}

    return CleanupStaleResponse(
        jobs_cleaned=data.get("jobs_cleaned", 0),
        job_ids=[str(jid) for jid in data.get("job_ids", [])]
    )


# ============================================
# SUMMARY TABLE ENDPOINTS
# ============================================

class SummaryRefreshResponse(BaseModel):
    """Response for summary table refresh."""
    success: bool
    tenant_id: str
    duration_ms: float
    hourly_summaries: Optional[dict] = None
    item_pairs: Optional[dict] = None
    branch_summaries: Optional[dict] = None


@router.post("/summaries/refresh", response_model=SummaryRefreshResponse)
async def refresh_summaries(
    user: UserPayload = Depends(require_operator),
    tenant_id: Optional[str] = None,
):
    """
    Manually refresh summary tables for a tenant.

    Operator-only endpoint for manual refresh when needed.
    If tenant_id is not provided, uses the operator's active tenant.
    """
    target_tenant = tenant_id or user.tenant_id

    if not target_tenant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No tenant specified. Provide tenant_id or set an active tenant."
        )

    try:
        result = supabase.rpc("refresh_all_summaries", {
            "p_tenant_id": target_tenant,
        }).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Refresh function returned no data. Run migrations 031-034."
            )

        data = result.data

        # Invalidate caches for this tenant
        data_cache.invalidate_tenant(target_tenant)

        return SummaryRefreshResponse(
            success=data.get("success", False),
            tenant_id=target_tenant,
            duration_ms=data.get("duration_ms", 0),
            hourly_summaries=data.get("hourly_summaries"),
            item_pairs=data.get("item_pairs"),
            branch_summaries=data.get("branch_summaries"),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to refresh summaries: {str(e)}"
        )


@router.post("/summaries/refresh-item-pairs")
async def refresh_item_pairs(
    user: UserPayload = Depends(require_operator),
    tenant_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    """
    Refresh item_pairs table for a specific date range.

    Useful for historical bundle analysis (e.g., Q1 vs Q4 comparison).
    """
    target_tenant = tenant_id or user.tenant_id

    if not target_tenant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No tenant specified."
        )

    try:
        params = {"p_tenant_id": target_tenant}
        if start_date:
            params["p_start_date"] = start_date
        if end_date:
            params["p_end_date"] = end_date

        result = supabase.rpc("refresh_item_pairs", params).execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Refresh function returned no data."
            )

        # Invalidate caches
        data_cache.invalidate_tenant(target_tenant)

        return result.data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to refresh item pairs: {str(e)}"
        )


@router.get("/summaries/status")
async def get_summary_status(
    user: UserPayload = Depends(get_user_with_tenant),
):
    """
    Check status of summary tables for the active tenant.

    Returns row counts to verify tables are populated.
    """
    tenant_id = user.tenant_id
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No tenant context"
        )

    try:
        # Check each summary table
        hourly = supabase.table("hourly_summaries").select(
            "id", count="exact"
        ).eq("tenant_id", tenant_id).limit(1).execute()

        pairs = supabase.table("item_pairs").select(
            "id", count="exact"
        ).eq("tenant_id", tenant_id).limit(1).execute()

        branch = supabase.table("branch_summaries").select(
            "id", count="exact"
        ).eq("tenant_id", tenant_id).limit(1).execute()

        return {
            "tenant_id": tenant_id,
            "hourly_summaries": hourly.count or 0,
            "item_pairs": pairs.count or 0,
            "branch_summaries": branch.count or 0,
            "tables_exist": True
        }
    except Exception as e:
        error_msg = str(e)
        if "does not exist" in error_msg.lower() or "relation" in error_msg.lower():
            return {
                "tenant_id": tenant_id,
                "tables_exist": False,
                "error": "Summary tables not found. Run migrations 031-034 in Supabase."
            }
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check summary status: {error_msg}"
        )


# ============================================
# TRANSACTION ENDPOINTS
# ============================================

@router.get("/transactions")
async def list_transactions(
    user: UserPayload = Depends(get_user_with_tenant),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    category: Optional[str] = None,
    macro_category: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
):
    """
    List transactions with optional filtering.

    Only returns transactions for user's tenant.
    """
    query = supabase.table("transactions").select("*")

    # Tenant filtering
    if user.role == "operator":
        if user.tenant_id:
            query = query.eq("tenant_id", user.tenant_id)
    elif user.tenant_id:
        query = query.eq("tenant_id", user.tenant_id)
    else:
        return []

    # Apply filters
    if start_date:
        query = query.gte("receipt_timestamp", start_date)
    if end_date:
        query = query.lte("receipt_timestamp", end_date)
    if category:
        query = query.eq("category", category)
    if macro_category:
        query = query.eq("macro_category", macro_category)

    result = query.order("receipt_timestamp", desc=True).range(offset, offset + limit - 1).execute()
    return result.data or []


@router.get("/transactions/summary")
async def get_transactions_summary(
    user: UserPayload = Depends(get_user_with_tenant),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    """Get summary statistics for transactions."""
    if not user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No tenant selected"
        )

    tenant_id = user.tenant_id

    # Use RPC for complex aggregation
    result = supabase.rpc("get_transaction_summary", {
        "p_tenant_id": tenant_id,
        "p_start_date": start_date,
        "p_end_date": end_date,
    }).execute()

    return result.data[0] if result.data else {
        "total_transactions": 0,
        "total_revenue": 0,
        "unique_items": 0,
        "unique_receipts": 0,
        "date_range_start": None,
        "date_range_end": None,
    }


# ============================================
# MENU ITEMS ENDPOINTS
# ============================================

@router.get("/menu-items")
async def list_menu_items(
    user: UserPayload = Depends(get_user_with_tenant),
    macro_category: Optional[str] = None,
    quadrant: Optional[str] = None,
    is_core: Optional[bool] = None,
    is_current: Optional[bool] = None,
    limit: int = 100,
    offset: int = 0,
):
    """List menu items with optional filtering."""
    query = supabase.table("menu_items").select("*")

    # Tenant filtering
    if user.role == "operator":
        if user.tenant_id:
            query = query.eq("tenant_id", user.tenant_id)
    elif user.tenant_id:
        query = query.eq("tenant_id", user.tenant_id)
    else:
        return []

    # Apply filters
    if macro_category:
        query = query.eq("macro_category", macro_category)
    if quadrant:
        query = query.eq("quadrant", quadrant)
    if is_core is not None:
        query = query.eq("is_core_menu", is_core)
    if is_current is not None:
        query = query.eq("is_current_menu", is_current)

    result = query.order("total_gross_revenue", desc=True).range(offset, offset + limit - 1).execute()
    return result.data or []


@router.post("/menu-items/regenerate", response_model=RegenerateResponse)
async def regenerate_menu_items(
    user: UserPayload = Depends(get_user_with_tenant),
):
    """
    Trigger menu items regeneration for tenant.

    This recalculates all aggregated metrics from transactions.
    """
    if user.role == "viewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Viewers cannot regenerate menu items"
        )

    if not user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No tenant associated"
        )

    import_service = ImportService(user.tenant_id, user.sub)
    count = import_service.regenerate_menu_items()

    return RegenerateResponse(
        status="completed",
        menu_items_updated=count
    )


# ============================================
# ITEM EXCLUSIONS ENDPOINTS
# ============================================

@router.get("/item-exclusions", response_model=list[ItemExclusion])
async def list_item_exclusions(
    user: UserPayload = Depends(get_user_with_tenant),
    tenant_id: Optional[str] = None,
):
    """List item exclusions for the current tenant (owner/operator only)."""
    if user.role == "viewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Viewers cannot manage item exclusions"
        )

    target_tenant = tenant_id if user.role == "operator" and tenant_id else user.tenant_id
    if not target_tenant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No tenant selected"
        )

    result = supabase.table("item_exclusions") \
        .select("*") \
        .eq("tenant_id", target_tenant) \
        .order("created_at", desc=True) \
        .execute()

    return result.data or []


@router.post("/item-exclusions", response_model=ItemExclusion)
async def create_item_exclusion(
    payload: ItemExclusionCreate,
    background_tasks: BackgroundTasks,
    user: UserPayload = Depends(get_user_with_tenant),
    tenant_id: Optional[str] = None,
):
    """Create a new item exclusion entry."""
    if user.role == "viewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Viewers cannot manage item exclusions"
        )

    target_tenant = tenant_id if user.role == "operator" and tenant_id else user.tenant_id
    if not target_tenant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No tenant selected"
        )

    item_name = payload.item_name.strip()
    if not item_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Item name is required"
        )

    existing = supabase.table("item_exclusions") \
        .select("id") \
        .eq("tenant_id", target_tenant) \
        .eq("item_name", item_name) \
        .execute()
    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Item already excluded"
        )

    result = supabase.table("item_exclusions").insert({
        "tenant_id": target_tenant,
        "item_name": item_name,
        "reason": payload.reason,
        "created_by": user.sub,
    }).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create item exclusion"
        )

    data_cache.invalidate_tenant(target_tenant)
    background_tasks.add_task(_refresh_analytics_after_exclusion, target_tenant)

    return result.data[0]


@router.delete("/item-exclusions/{exclusion_id}", response_model=ItemExclusionDeleteResponse)
async def delete_item_exclusion(
    exclusion_id: str,
    background_tasks: BackgroundTasks,
    user: UserPayload = Depends(get_user_with_tenant),
):
    """Delete an item exclusion by id."""
    if user.role == "viewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Viewers cannot manage item exclusions"
        )

    existing = (
        supabase.table("item_exclusions")
        .select("id, tenant_id")
        .eq("id", exclusion_id)
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item exclusion not found"
        )

    target_tenant = existing.data.get("tenant_id")
    if user.role != "operator" and target_tenant != user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete item exclusions for a different tenant",
        )

    result = (
        supabase.table("item_exclusions")
        .delete()
        .eq("id", exclusion_id)
        .eq("tenant_id", target_tenant)
        .execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item exclusion not found"
        )

    if target_tenant:
        data_cache.invalidate_tenant(target_tenant)
        background_tasks.add_task(_refresh_analytics_after_exclusion, target_tenant)

    return ItemExclusionDeleteResponse(success=True, deleted_id=exclusion_id)


@router.get("/item-exclusions/suggestions", response_model=ItemExclusionSuggestionsResponse)
async def get_item_exclusion_suggestions(
    user: UserPayload = Depends(get_user_with_tenant),
    tenant_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    branches: Optional[str] = None,
    categories: Optional[str] = None,
    max_quantity: Optional[int] = 2,
    max_revenue: Optional[int] = 1000,
    limit: int = 50,
):
    """Suggest low-activity items to exclude."""
    if user.role == "viewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Viewers cannot manage item exclusions"
        )

    target_tenant = tenant_id if user.role == "operator" and tenant_id else user.tenant_id
    if not target_tenant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No tenant selected"
        )

    branch_list = branches.split(",") if branches else None
    category_list = categories.split(",") if categories else None

    result = supabase.rpc("get_item_exclusion_suggestions", {
        "p_tenant_id": target_tenant,
        "p_start_date": start_date,
        "p_end_date": end_date,
        "p_branches": branch_list,
        "p_categories": category_list,
        "p_max_quantity": max_quantity,
        "p_max_revenue": max_revenue,
        "p_limit": limit,
    }).execute()

    suggestions = [
        ItemExclusionSuggestion(
            item_name=row.get("item_name", ""),
            total_quantity=row.get("total_quantity", 0),
            total_revenue=row.get("total_revenue", 0),
            order_count=row.get("order_count", 0),
            first_sale_date=row.get("first_sale_date"),
            last_sale_date=row.get("last_sale_date"),
        )
        for row in (result.data or [])
    ]

    return ItemExclusionSuggestionsResponse(
        suggestions=suggestions,
        thresholds={"max_quantity": max_quantity, "max_revenue": max_revenue}
    )


# ============================================
# FILTER OPTIONS ENDPOINTS
# ============================================

@router.get("/branches")
async def list_branches(
    user: UserPayload = Depends(get_user_with_tenant),
    tenant_id: Optional[str] = None,
):
    """Get unique branch/store names for user's tenant. Cached for 5 minutes."""
    # Operators can specify tenant_id, others use their assigned tenant
    effective_tenant_id = tenant_id if user.role == "operator" and tenant_id else user.tenant_id

    if not effective_tenant_id:
        return {"branches": []}

    def fetch_branches():
        # Use RPC to get distinct store names efficiently
        try:
            result = supabase.rpc("get_distinct_store_names", {
                "p_tenant_id": effective_tenant_id
            }).execute()

            if result.data:
                return [row["store_name"] for row in result.data if row.get("store_name")]
        except Exception:
            pass  # Fall back to manual approach if RPC doesn't exist

        # Fallback: Query with high limit and dedupe
        result = supabase.table("transactions") \
            .select("store_name") \
            .eq("tenant_id", effective_tenant_id) \
            .not_.is_("store_name", "null") \
            .limit(10000) \
            .execute()

        if not result.data:
            return []

        return sorted(set(row.get("store_name") for row in result.data if row.get("store_name")))

    # Cache for 5 minutes - branches rarely change
    branches = data_cache.get_or_fetch(
        prefix="branches",
        fetch_fn=fetch_branches,
        ttl="long",
        tenant_id=effective_tenant_id
    )

    return {"branches": branches}


@router.get("/categories")
async def list_categories(
    user: UserPayload = Depends(get_user_with_tenant),
    tenant_id: Optional[str] = None,
):
    """Get unique category names for user's tenant. Cached for 5 minutes."""
    # Operators can specify tenant_id, others use their assigned tenant
    effective_tenant_id = tenant_id if user.role == "operator" and tenant_id else user.tenant_id

    if not effective_tenant_id:
        return {"categories": []}

    def fetch_categories():
        # Use RPC to get distinct categories efficiently
        try:
            result = supabase.rpc("get_distinct_categories", {
                "p_tenant_id": effective_tenant_id
            }).execute()

            if result.data:
                return [row["category"] for row in result.data if row.get("category")]
        except Exception:
            pass  # Fall back to manual approach if RPC doesn't exist

        # Fallback: Query with high limit and dedupe
        result = supabase.table("transactions") \
            .select("category") \
            .eq("tenant_id", effective_tenant_id) \
            .limit(10000) \
            .execute()

        if not result.data:
            return []

        return sorted(set(row["category"] for row in result.data if row.get("category")))

    # Cache for 5 minutes - categories rarely change
    categories = data_cache.get_or_fetch(
        prefix="categories",
        fetch_fn=fetch_categories,
        ttl="long",
        tenant_id=effective_tenant_id
    )

    return {"categories": categories}


# ============================================
# DATA DELETION ENDPOINT
# ============================================

@router.delete("/transactions")
async def delete_transactions(
    user: UserPayload = Depends(get_user_with_tenant),
    import_job_id: Optional[str] = None,
):
    """
    Delete transactions for the tenant.

    - If import_job_id is provided, only delete transactions from that import
    - Otherwise, delete all transactions for the tenant

    Only operators and owners can delete.
    """
    if user.role == "viewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Viewers cannot delete data"
        )

    if not user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No tenant associated"
        )

    query = supabase.table("transactions").delete().eq("tenant_id", user.tenant_id)

    if import_job_id:
        query = query.eq("import_batch_id", import_job_id)

    result = query.execute()

    # Also regenerate menu items after deletion
    import_service = ImportService(user.tenant_id, user.sub)
    import_service.regenerate_menu_items()

    return {
        "status": "deleted",
        "message": f"Transactions deleted for tenant {user.tenant_id}"
    }


# ============================================
# HEALTH CHECK ENDPOINT
# ============================================

@router.get("/health")
async def data_health_check(
    user: UserPayload = Depends(get_user_with_tenant),
    tenant_id: Optional[str] = None,
):
    """
    Check database health and basic counts for the tenant.
    Operators can pass tenant_id to inspect a specific tenant.
    Operators without active tenant/override get aggregate counts.
    """
    if user.role == "operator":
        effective_tenant_id = tenant_id or user.tenant_id
    else:
        effective_tenant_id = user.tenant_id
        if tenant_id and tenant_id != user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot access health data for a different tenant",
            )

    health = {
        "tenant_id": effective_tenant_id,
        "counts": {},
        "date_range": {"start": None, "end": None},
        "status": "ok",
    }

    try:
        if effective_tenant_id:
            # Specific tenant counts
            txn_result = supabase.table("transactions").select("id", count="exact").eq("tenant_id", effective_tenant_id).limit(1).execute()
            menu_result = supabase.table("menu_items").select("id", count="exact").eq("tenant_id", effective_tenant_id).limit(1).execute()
            # Get date range for tenant
            date_range_result = supabase.table("transactions").select("receipt_timestamp").eq("tenant_id", effective_tenant_id).order("receipt_timestamp", desc=False).limit(1).execute()
            date_range_end_result = supabase.table("transactions").select("receipt_timestamp").eq("tenant_id", effective_tenant_id).order("receipt_timestamp", desc=True).limit(1).execute()
        elif user.role == "operator":
            # Operators without tenant see all counts
            txn_result = supabase.table("transactions").select("id", count="exact").limit(1).execute()
            menu_result = supabase.table("menu_items").select("id", count="exact").limit(1).execute()
            # Get date range across all tenants
            date_range_result = supabase.table("transactions").select("receipt_timestamp").order("receipt_timestamp", desc=False).limit(1).execute()
            date_range_end_result = supabase.table("transactions").select("receipt_timestamp").order("receipt_timestamp", desc=True).limit(1).execute()
            health["note"] = "Showing aggregate counts (no tenant selected)"
        else:
            # Non-operators without tenant
            return {"tenant_id": None, "counts": {"transactions": 0, "menu_items": 0}, "date_range": {"start": None, "end": None}, "status": "no_tenant"}

        health["counts"]["transactions"] = txn_result.count or 0
        health["counts"]["menu_items"] = menu_result.count or 0

        # Extract date range
        if date_range_result.data and len(date_range_result.data) > 0:
            health["date_range"]["start"] = date_range_result.data[0]["receipt_timestamp"]
        if date_range_end_result.data and len(date_range_end_result.data) > 0:
            health["date_range"]["end"] = date_range_end_result.data[0]["receipt_timestamp"]
    except Exception:
        health["counts"]["transactions"] = 0
        health["counts"]["menu_items"] = 0
        health["status"] = "degraded"

    return health
