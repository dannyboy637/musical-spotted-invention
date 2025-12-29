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
    """
    # Fetch additional user data from the users table
    result = supabase.table("users").select("*").eq("id", user.sub).single().execute()

    if result.data:
        return {
            "id": user.sub,
            "email": user.email,
            "full_name": result.data.get("full_name"),
            "role": result.data.get("role"),
            "created_at": result.data.get("created_at"),
        }

    # User exists in auth but not in users table (shouldn't happen with trigger)
    return {
        "id": user.sub,
        "email": user.email,
        "role": "viewer",
    }
