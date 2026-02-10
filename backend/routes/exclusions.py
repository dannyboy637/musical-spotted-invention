"""
Exclusions API routes.
Provides endpoints for managing excluded menu items that should be filtered
out of analytics calculations (modifiers, non-analytical items, etc.).
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel

from middleware.auth import get_user_with_tenant, UserPayload
from middleware.auth_helpers import get_effective_tenant_id, require_owner_or_operator
from db.supabase import supabase
from utils.cache import data_cache

router = APIRouter(prefix="/api/exclusions", tags=["exclusions"])

VALID_REASONS = {"modifier", "non_analytical", "low_volume", "manual"}


# ============================================
# REQUEST/RESPONSE MODELS
# ============================================

class ExcludedItemResponse(BaseModel):
    """Single excluded item."""
    id: str
    tenant_id: str
    menu_item_id: str
    item_name: str
    reason: str
    excluded_by: Optional[str] = None
    created_at: str


class ExclusionsListResponse(BaseModel):
    """List of excluded items."""
    exclusions: List[ExcludedItemResponse]
    total: int


class AddExclusionsRequest(BaseModel):
    """Request body for adding items to exclusion list."""
    menu_item_ids: List[str]
    reason: str


class SuggestionResponse(BaseModel):
    """Single exclusion suggestion."""
    menu_item_id: str
    item_name: str
    category: Optional[str] = None
    total_quantity: int
    total_revenue: int
    revenue_pct: float
    suggestion_reason: str


class SuggestionsListResponse(BaseModel):
    """List of exclusion suggestions."""
    suggestions: List[SuggestionResponse]
    total: int


# ============================================
# ENDPOINTS
# ============================================

@router.get("", response_model=ExclusionsListResponse)
async def list_exclusions(
    user: UserPayload = Depends(get_user_with_tenant),
    tenant_id: Optional[str] = None,
):
    """
    List all excluded items for the effective tenant.
    Joins with menu_items to return item name.
    """
    effective_tenant_id = get_effective_tenant_id(user, tenant_id)

    def fetch_exclusions():
        result = supabase.table("excluded_items") \
            .select("id, tenant_id, menu_item_id, reason, excluded_by, created_at, menu_items(item_name)") \
            .eq("tenant_id", effective_tenant_id) \
            .order("created_at", desc=True) \
            .execute()
        return result.data or []

    rows = data_cache.get_or_fetch(
        prefix="exclusions_list",
        fetch_fn=fetch_exclusions,
        ttl="short",
        tenant_id=effective_tenant_id,
    )

    exclusions = []
    for row in rows:
        menu_items_data = row.get("menu_items") or {}
        item_name = menu_items_data.get("item_name", "Unknown") if isinstance(menu_items_data, dict) else "Unknown"
        exclusions.append(ExcludedItemResponse(
            id=row["id"],
            tenant_id=row["tenant_id"],
            menu_item_id=row["menu_item_id"],
            item_name=item_name,
            reason=row["reason"],
            excluded_by=row.get("excluded_by"),
            created_at=row["created_at"],
        ))

    return ExclusionsListResponse(
        exclusions=exclusions,
        total=len(exclusions),
    )


@router.post("", response_model=ExclusionsListResponse)
async def add_exclusions(
    body: AddExclusionsRequest,
    user: UserPayload = Depends(get_user_with_tenant),
    tenant_id: Optional[str] = None,
):
    """
    Add items to the exclusion list.
    Requires owner or operator role.
    """
    effective_tenant_id = get_effective_tenant_id(user, tenant_id)
    require_owner_or_operator(user, effective_tenant_id)

    # Validate reason
    if body.reason not in VALID_REASONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid reason. Must be one of: {', '.join(sorted(VALID_REASONS))}"
        )

    if not body.menu_item_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No menu item IDs provided"
        )

    # Insert exclusions (skip duplicates via on_conflict)
    rows_to_insert = [
        {
            "tenant_id": effective_tenant_id,
            "menu_item_id": mid,
            "reason": body.reason,
            "excluded_by": user.sub,
        }
        for mid in body.menu_item_ids
    ]

    result = supabase.table("excluded_items") \
        .upsert(rows_to_insert, on_conflict="tenant_id,menu_item_id") \
        .execute()

    # Invalidate caches
    data_cache.invalidate("exclusions_list", tenant_id=effective_tenant_id)
    data_cache.invalidate("excluded_item_names", tenant_id=effective_tenant_id)

    # Return updated list
    return await list_exclusions(user, tenant_id)


@router.delete("/{exclusion_id}")
async def remove_exclusion(
    exclusion_id: str,
    user: UserPayload = Depends(get_user_with_tenant),
):
    """
    Remove an item from the exclusion list.
    Requires owner or operator role.
    """
    # First get the exclusion to check tenant
    exc_result = supabase.table("excluded_items") \
        .select("tenant_id") \
        .eq("id", exclusion_id) \
        .single() \
        .execute()

    if not exc_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exclusion not found"
        )

    tenant_id = exc_result.data["tenant_id"]
    require_owner_or_operator(user, tenant_id)

    # Delete the exclusion
    supabase.table("excluded_items") \
        .delete() \
        .eq("id", exclusion_id) \
        .execute()

    # Invalidate caches
    data_cache.invalidate("exclusions_list", tenant_id=tenant_id)
    data_cache.invalidate("excluded_item_names", tenant_id=tenant_id)

    return {"message": "Exclusion removed", "id": exclusion_id}


@router.get("/suggestions", response_model=SuggestionsListResponse)
async def get_exclusion_suggestions(
    user: UserPayload = Depends(get_user_with_tenant),
    tenant_id: Optional[str] = None,
):
    """
    Get suggested items to exclude based on low revenue, low volume, or name patterns.
    """
    effective_tenant_id = get_effective_tenant_id(user, tenant_id)

    def fetch_suggestions():
        result = supabase.rpc("get_exclusion_suggestions", {
            "p_tenant_id": effective_tenant_id,
        }).execute()
        return result.data or []

    rows = data_cache.get_or_fetch(
        prefix="exclusion_suggestions",
        fetch_fn=fetch_suggestions,
        ttl="medium",
        tenant_id=effective_tenant_id,
    )

    suggestions = [
        SuggestionResponse(
            menu_item_id=str(row["menu_item_id"]),
            item_name=row.get("item_name", "Unknown"),
            category=row.get("category"),
            total_quantity=row.get("total_quantity", 0),
            total_revenue=row.get("total_revenue", 0),
            revenue_pct=float(row.get("revenue_pct", 0)),
            suggestion_reason=row.get("suggestion_reason", "unknown"),
        )
        for row in rows
    ]

    return SuggestionsListResponse(
        suggestions=suggestions,
        total=len(suggestions),
    )
