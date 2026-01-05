"""
Data import and management routes.
"""
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks
from pydantic import BaseModel

from middleware.auth import (
    get_user_with_tenant,
    require_operator,
    UserPayload,
)
from db.supabase import supabase
from services.import_service import ImportService

router = APIRouter(prefix="/data", tags=["data"])


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


# ============================================
# BACKGROUND TASK
# ============================================

async def process_import_task(
    import_service: ImportService,
    csv_content: str,
    file_name: str
):
    """Background task to process CSV import."""
    try:
        import_service.process_csv(csv_content, file_name)
        import_service.regenerate_menu_items()
    except Exception as e:
        import_service.update_job_status(
            status="failed",
            error_message=str(e)
        )


# ============================================
# UPLOAD ENDPOINTS
# ============================================

@router.post("/upload", response_model=UploadResponse)
async def upload_csv(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user: UserPayload = Depends(get_user_with_tenant),
):
    """
    Upload a CSV file for processing.

    - Operators can upload for any tenant
    - Owners can upload for their own tenant
    - Viewers cannot upload
    """
    if user.role == "viewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Viewers cannot upload data"
        )

    if not user.tenant_id and user.role != "operator":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No tenant associated with user"
        )

    tenant_id = user.tenant_id

    # Operators without tenant_id need to specify one
    if user.role == "operator" and not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Operator must have an active tenant selected"
        )

    # Validate file
    if not file.filename or not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only CSV files are accepted"
        )

    # Read file content
    content = await file.read()
    file_size = len(content)

    # Upload to Supabase Storage
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    storage_path = f"{tenant_id}/{timestamp}_{file.filename}"

    try:
        supabase.storage.from_("csv-uploads").upload(
            storage_path,
            content,
            {"content-type": "text/csv"}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file: {str(e)}"
        )

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


# ============================================
# IMPORT JOB ENDPOINTS
# ============================================

@router.get("/imports")
async def list_import_jobs(
    user: UserPayload = Depends(get_user_with_tenant),
    limit: int = 20,
    offset: int = 0,
):
    """List import jobs for user's tenant."""
    query = supabase.table("data_import_jobs").select("*")

    if user.role == "operator":
        # Operators see all (could filter by active tenant if set)
        if user.tenant_id:
            query = query.eq("tenant_id", user.tenant_id)
    elif user.tenant_id:
        query = query.eq("tenant_id", user.tenant_id)
    else:
        return []

    result = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    return result.data or []


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
    if user.role != "operator" and not user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No tenant associated"
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
# FILTER OPTIONS ENDPOINTS
# ============================================

@router.get("/branches")
async def list_branches(
    user: UserPayload = Depends(get_user_with_tenant),
    tenant_id: Optional[str] = None,
):
    """Get unique branch/store names for user's tenant."""
    # Operators can specify tenant_id, others use their assigned tenant
    effective_tenant_id = tenant_id if user.role == "operator" and tenant_id else user.tenant_id

    if not effective_tenant_id:
        return {"branches": []}

    # Use RPC to get distinct store names efficiently
    try:
        result = supabase.rpc("get_distinct_store_names", {
            "p_tenant_id": effective_tenant_id
        }).execute()

        if result.data:
            return {"branches": [row["store_name"] for row in result.data if row.get("store_name")]}
    except Exception:
        pass  # Fall back to manual approach if RPC doesn't exist

    # Fallback: Query with high limit and dedupe
    # Note: This is inefficient for large datasets but works as fallback
    result = supabase.table("transactions") \
        .select("store_name") \
        .eq("tenant_id", effective_tenant_id) \
        .not_.is_("store_name", "null") \
        .limit(10000) \
        .execute()

    if not result.data:
        return {"branches": []}

    # Extract unique store names
    branches = set(row.get("store_name") for row in result.data if row.get("store_name"))

    return {"branches": sorted(branches)}


@router.get("/categories")
async def list_categories(
    user: UserPayload = Depends(get_user_with_tenant),
    tenant_id: Optional[str] = None,
):
    """Get unique category names for user's tenant."""
    # Operators can specify tenant_id, others use their assigned tenant
    effective_tenant_id = tenant_id if user.role == "operator" and tenant_id else user.tenant_id

    if not effective_tenant_id:
        return {"categories": []}

    # Use RPC to get distinct categories efficiently
    try:
        result = supabase.rpc("get_distinct_categories", {
            "p_tenant_id": effective_tenant_id
        }).execute()

        if result.data:
            return {"categories": [row["category"] for row in result.data if row.get("category")]}
    except Exception:
        pass  # Fall back to manual approach if RPC doesn't exist

    # Fallback: Query with high limit and dedupe
    result = supabase.table("transactions") \
        .select("category") \
        .eq("tenant_id", effective_tenant_id) \
        .limit(10000) \
        .execute()

    if not result.data:
        return {"categories": []}

    # Extract unique categories
    categories = sorted(set(row["category"] for row in result.data if row.get("category")))
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
):
    """
    Check database health and migration status.

    Returns information about:
    - Whether RPC functions exist (migrations ran)
    - Transaction/menu item counts for the tenant
    """
    if not user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No tenant associated"
        )

    health = {
        "tenant_id": user.tenant_id,
        "functions": {},
        "counts": {},
        "issues": [],
    }

    # Check if aggregate_menu_items function exists by trying to call it with invalid input
    # This will fail with a clear error if function doesn't exist vs if it has other issues
    try:
        # Use a dummy UUID that won't match any tenant
        result = supabase.rpc("aggregate_menu_items", {
            "p_tenant_id": "00000000-0000-0000-0000-000000000000"
        }).execute()
        health["functions"]["aggregate_menu_items"] = True
    except Exception as e:
        error_str = str(e).lower()
        if "function" in error_str and "does not exist" in error_str:
            health["functions"]["aggregate_menu_items"] = False
            health["issues"].append("Migration 006 not run: aggregate_menu_items function missing")
        else:
            # Function exists but had another error (expected for dummy UUID)
            health["functions"]["aggregate_menu_items"] = True

    # Check RPC analytics functions
    for func_name in ["get_analytics_overview", "get_analytics_trends"]:
        try:
            supabase.rpc(func_name, {
                "p_tenant_id": "00000000-0000-0000-0000-000000000000",
                "p_start_date": None,
                "p_end_date": None,
                "p_branches": None,
                "p_categories": None,
            }).execute()
            health["functions"][func_name] = True
        except Exception as e:
            error_str = str(e).lower()
            if "function" in error_str and "does not exist" in error_str:
                health["functions"][func_name] = False
                health["issues"].append(f"RPC function {func_name} missing")
            else:
                health["functions"][func_name] = True

    # Get transaction count for tenant
    try:
        result = supabase.table("transactions") \
            .select("id", count="exact") \
            .eq("tenant_id", user.tenant_id) \
            .limit(1) \
            .execute()
        health["counts"]["transactions"] = result.count or 0
    except Exception as e:
        health["counts"]["transactions"] = f"Error: {str(e)}"

    # Get menu items count for tenant
    try:
        result = supabase.table("menu_items") \
            .select("id", count="exact") \
            .eq("tenant_id", user.tenant_id) \
            .limit(1) \
            .execute()
        health["counts"]["menu_items"] = result.count or 0
    except Exception as e:
        health["counts"]["menu_items"] = f"Error: {str(e)}"

    # Check for common issues
    if health["counts"].get("transactions", 0) > 0 and health["counts"].get("menu_items", 0) == 0:
        health["issues"].append(
            "Transactions exist but menu_items is empty. "
            "Run POST /data/menu-items/regenerate to populate."
        )

    if health["counts"].get("transactions", 0) == 0:
        health["issues"].append("No transactions imported for this tenant.")

    return health
