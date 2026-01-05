"""
Tenant management routes.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from middleware.auth import (
    get_current_user,
    get_user_with_tenant,
    require_operator,
    UserPayload,
)
from db.supabase import supabase

router = APIRouter(prefix="/tenants", tags=["tenants"])


class TenantCreate(BaseModel):
    """Request body for creating a tenant."""
    name: str
    slug: str
    settings: Optional[dict] = {}


class TenantUpdate(BaseModel):
    """Request body for updating a tenant."""
    name: Optional[str] = None
    slug: Optional[str] = None
    settings: Optional[dict] = None


class TenantResponse(BaseModel):
    """Response model for tenant data."""
    id: str
    name: str
    slug: str
    settings: dict
    created_at: str


@router.get("")
async def list_tenants(user: UserPayload = Depends(get_user_with_tenant)):
    """
    List tenants.
    - Operators: see all tenants
    - Others: see only their own tenant
    """
    if user.role == "operator":
        result = supabase.table("tenants").select("*").order("created_at").execute()
    else:
        if not user.tenant_id:
            return []
        result = supabase.table("tenants").select("*").eq("id", user.tenant_id).execute()

    return result.data or []


@router.get("/{tenant_id}")
async def get_tenant(tenant_id: str, user: UserPayload = Depends(get_user_with_tenant)):
    """
    Get a specific tenant by ID.
    - Operators: can access any tenant
    - Others: can only access their own tenant
    """
    if user.role != "operator" and user.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this tenant",
        )

    result = supabase.table("tenants").select("*").eq("id", tenant_id).single().execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found",
        )

    return result.data


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_tenant(
    tenant: TenantCreate,
    user: UserPayload = Depends(require_operator),
):
    """
    Create a new tenant. Operator only.
    """
    # Check if slug already exists
    existing = supabase.table("tenants").select("id").eq("slug", tenant.slug).execute()
    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant with this slug already exists",
        )

    result = supabase.table("tenants").insert({
        "name": tenant.name,
        "slug": tenant.slug,
        "settings": tenant.settings or {},
    }).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create tenant",
        )

    return result.data[0]


@router.put("/{tenant_id}")
async def update_tenant(
    tenant_id: str,
    tenant: TenantUpdate,
    user: UserPayload = Depends(require_operator),
):
    """
    Update a tenant. Operator only.
    """
    # Check tenant exists
    existing = supabase.table("tenants").select("id").eq("id", tenant_id).execute()
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found",
        )

    # Build update data, excluding None values
    update_data = {}
    if tenant.name is not None:
        update_data["name"] = tenant.name
    if tenant.slug is not None:
        # Check slug uniqueness
        slug_check = supabase.table("tenants").select("id").eq("slug", tenant.slug).neq("id", tenant_id).execute()
        if slug_check.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tenant with this slug already exists",
            )
        update_data["slug"] = tenant.slug
    if tenant.settings is not None:
        update_data["settings"] = tenant.settings

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    result = supabase.table("tenants").update(update_data).eq("id", tenant_id).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update tenant",
        )

    return result.data[0]


@router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tenant(
    tenant_id: str,
    user: UserPayload = Depends(require_operator),
):
    """
    Delete a tenant. Operator only.
    WARNING: This will also delete or orphan all users associated with this tenant.
    """
    # Check tenant exists
    existing = supabase.table("tenants").select("id").eq("id", tenant_id).execute()
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found",
        )

    # Check for users in this tenant
    users_check = supabase.table("users").select("id").eq("tenant_id", tenant_id).execute()
    if users_check.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete tenant with {len(users_check.data)} associated users. Remove users first.",
        )

    supabase.table("tenants").delete().eq("id", tenant_id).execute()

    return None
