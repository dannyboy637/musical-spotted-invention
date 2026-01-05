"""
Authentication routes.
"""
from fastapi import APIRouter, Depends
from middleware.auth import get_current_user, UserPayload
from db.supabase import supabase

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me")
async def get_current_user_info(user: UserPayload = Depends(get_current_user)):
    """
    Get the current authenticated user's information.
    Requires a valid JWT token.
    Returns user profile with tenant information.
    """
    # Fetch user data with tenant info
    result = supabase.table("users").select("*").eq("id", user.sub).single().execute()

    if not result.data:
        # User exists in auth but not in users table (shouldn't happen with trigger)
        return {
            "id": user.sub,
            "email": user.email,
            "role": "viewer",
            "tenant_id": None,
            "tenant": None,
        }

    user_data = result.data
    tenant_data = None

    # Fetch tenant info if user has a tenant
    if user_data.get("tenant_id"):
        tenant_result = supabase.table("tenants").select("*").eq("id", user_data["tenant_id"]).single().execute()
        if tenant_result.data:
            tenant_data = {
                "id": tenant_result.data.get("id"),
                "name": tenant_result.data.get("name"),
                "slug": tenant_result.data.get("slug"),
            }

    return {
        "id": user.sub,
        "email": user.email,
        "full_name": user_data.get("full_name"),
        "role": user_data.get("role"),
        "tenant_id": user_data.get("tenant_id"),
        "tenant": tenant_data,
        "created_at": user_data.get("created_at"),
    }
