"""
Shared auth helpers for tenant resolution and role checks.
Centralizes get_effective_tenant_id and require_owner_or_operator
to prevent security drift between route modules.
"""
from fastapi import HTTPException, status
from middleware.auth import UserPayload


def get_effective_tenant_id(user: UserPayload, tenant_id_override: str = None) -> str:
    """
    Get tenant ID for queries.

    - Operators can override with tenant_id_override
    - Non-operators ALWAYS use their assigned tenant (override is ignored)
    - Raises 403 if non-operator has no tenant_id
    """
    # Operators can specify which tenant to query
    if user.role == "operator":
        if tenant_id_override:
            return tenant_id_override
        if user.tenant_id:
            return user.tenant_id
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No tenant selected"
        )

    # Non-operators: ALWAYS use their assigned tenant, ignore override
    if user.tenant_id:
        return user.tenant_id

    # Non-operator with no tenant_id is a misconfigured account
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="No tenant assigned to your account"
    )


def require_owner_or_operator(user: UserPayload, tenant_id: str):
    """Check that user is owner of the tenant or an operator."""
    if user.role == "operator":
        return  # Operators can do anything
    if user.role == "owner" and user.tenant_id == tenant_id:
        return  # Owners can manage their own tenant
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Only tenant owner or operator can perform this action"
    )
