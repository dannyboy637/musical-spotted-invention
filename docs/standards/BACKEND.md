# Backend Standards (FastAPI)

## Project Structure

```
backend/
├── main.py           # App entry, CORS, middleware
├── routes/           # API endpoints
├── modules/          # Business logic
├── middleware/       # Request processing
├── db/               # Database clients
└── utils/            # Helpers
```

## Route Pattern

```python
from fastapi import APIRouter, Depends, HTTPException

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

@router.get("/overview")
async def get_overview(
    current_user: User = Depends(get_current_user),
    start_date: date = Query(None),
    end_date: date = Query(None),
):
    """Get dashboard overview metrics."""
    try:
        data = await calculate_overview(
            tenant_id=current_user.tenant_id,
            start_date=start_date,
            end_date=end_date,
        )
        return data
    except Exception as e:
        logger.exception("Failed to get overview")
        raise HTTPException(status_code=500, detail="Failed to load data")
```

## Dependency Injection

```python
# Define dependencies
async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    ...

async def get_tenant_context(user: User = Depends(get_current_user)) -> str:
    return user.tenant_id

# Use in routes
@router.get("/data")
async def get_data(tenant_id: str = Depends(get_tenant_context)):
    ...
```

## Database Queries

```python
# Always use parameterized queries via Supabase client
response = supabase.table("transactions") \
    .select("*") \
    .eq("tenant_id", tenant_id) \
    .gte("timestamp", start_date) \
    .execute()
```
