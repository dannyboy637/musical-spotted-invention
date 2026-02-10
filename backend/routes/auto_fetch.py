"""
Auto-fetch routes - trigger StoreHub CSV fetch via API.

Protected by a secret token to prevent unauthorized access.
Token must be sent via Authorization header (Bearer <token>),
not as a URL query parameter, to avoid leaking in logs/referer headers.
"""
import os
import hmac
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks, Request
from pydantic import BaseModel

from middleware.rate_limit import limiter
from services.import_service import ImportService

# Lazy import to avoid circular dependencies
StoreHubClient = None

def get_storehub_client():
    global StoreHubClient
    if StoreHubClient is None:
        import sys
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from scripts.auto_fetch_storehub import StoreHubClient as _StoreHubClient
        StoreHubClient = _StoreHubClient
    return StoreHubClient

router = APIRouter(prefix="/auto-fetch", tags=["auto-fetch"])


class FetchResult(BaseModel):
    success: bool
    message: str
    job_id: str | None = None
    rows_downloaded: int | None = None
    rows_inserted: int | None = None
    rows_duplicates: int | None = None


def extract_bearer_token(request: Request) -> str:
    """Extract token from Authorization: Bearer <token> header."""
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid Authorization header. Use: Authorization: Bearer <token>"
        )
    return auth_header[7:]


def verify_token(token: str) -> bool:
    """Verify the auto-fetch secret token using constant-time comparison."""
    expected_token = os.getenv("AUTO_FETCH_SECRET")
    if not expected_token:
        return False
    return hmac.compare_digest(token, expected_token)


def run_fetch(tenant_subdomain: str, username: str, password: str, tenant_id: str, fetch_date: str | None = None):
    """
    Run the StoreHub fetch and import.

    Returns a dict with results.
    """
    # Determine date to fetch (default: yesterday in Manila timezone)
    if fetch_date:
        target_date = fetch_date
    else:
        # Use Manila timezone for date calculation since cron job runs at 2AM Manila
        tz = ZoneInfo(os.getenv("AUTO_FETCH_TIMEZONE", "Asia/Manila"))
        now_local = datetime.now(tz)
        yesterday = now_local - timedelta(days=1)
        target_date = yesterday.strftime("%m/%d/%Y")

    # Initialize client and login
    ClientClass = get_storehub_client()
    client = ClientClass(tenant_subdomain)

    if not client.login(username, password):
        return {
            "success": False,
            "message": "Failed to login to StoreHub",
            "job_id": None,
            "rows_downloaded": None,
            "rows_inserted": None,
            "rows_duplicates": None,
        }

    # Download CSV
    csv_content = client.download_csv(
        date_from=target_date,
        date_to=target_date,
        store_id="allStores",
    )

    if not csv_content:
        return {
            "success": False,
            "message": "Failed to download CSV from StoreHub",
            "job_id": None,
            "rows_downloaded": None,
            "rows_inserted": None,
            "rows_duplicates": None,
        }

    # Check if CSV has any data
    lines = csv_content.strip().split("\n")
    if len(lines) <= 1:
        return {
            "success": True,
            "message": f"No transactions for {target_date} (restaurant may have been closed)",
            "job_id": None,
            "rows_downloaded": 0,
            "rows_inserted": 0,
            "rows_duplicates": 0,
        }

    # Import using existing service
    file_name = f"auto_fetch_{target_date.replace('/', '-')}.csv"
    import_service = ImportService(tenant_id, "system")

    job_id = import_service.create_import_job(
        file_name=file_name,
        file_path=f"auto-fetch/{file_name}",
        file_size=len(csv_content.encode("utf-8")),
    )

    try:
        result = import_service.process_csv(csv_content, file_name)

        # Regenerate menu items if new data was inserted
        if result["inserted_rows"] > 0:
            import_service.regenerate_menu_items()

        return {
            "success": True,
            "message": f"Import complete for {target_date}",
            "job_id": job_id,
            "rows_downloaded": len(lines) - 1,
            "rows_inserted": result["inserted_rows"],
            "rows_duplicates": result.get("duplicate_skipped", 0),
        }

    except Exception as e:
        import_service.update_job_status(
            status="failed",
            error_message=str(e),
        )
        return {
            "success": False,
            "message": f"Import failed: {str(e)}",
            "job_id": job_id,
            "rows_downloaded": len(lines) - 1,
            "rows_inserted": None,
            "rows_duplicates": None,
        }


@router.post("/trigger", response_model=FetchResult)
@limiter.limit("20/minute")
async def trigger_fetch(
    request: Request,
    background_tasks: BackgroundTasks,
    date: str | None = Query(None, description="Optional date to fetch (MM/DD/YYYY). Defaults to yesterday."),
    sync: bool = Query(False, description="Run synchronously (wait for result). Default: run in background."),
):
    """
    Trigger StoreHub auto-fetch for Spotted Pig.

    Protected by AUTO_FETCH_SECRET token via Authorization header.
    By default runs in background and returns immediately.
    """
    # Verify token from Authorization header
    token = extract_bearer_token(request)
    if not verify_token(token):
        raise HTTPException(status_code=401, detail="Invalid token")

    # Get config from environment
    subdomain = os.getenv("STOREHUB_SUBDOMAIN")
    username = os.getenv("STOREHUB_USERNAME")
    password = os.getenv("STOREHUB_PASSWORD")
    tenant_id = os.getenv("TARGET_TENANT_ID")

    if not all([subdomain, username, password, tenant_id]):
        raise HTTPException(
            status_code=500,
            detail="StoreHub credentials not configured. Set STOREHUB_SUBDOMAIN, STOREHUB_USERNAME, STOREHUB_PASSWORD, TARGET_TENANT_ID"
        )

    if sync:
        # Run synchronously and return result
        result = run_fetch(subdomain, username, password, tenant_id, date)
        return FetchResult(**result)
    else:
        # Run in background
        background_tasks.add_task(run_fetch, subdomain, username, password, tenant_id, date)
        return FetchResult(
            success=True,
            message="Auto-fetch started in background",
            job_id=None,
            rows_downloaded=None,
            rows_inserted=None,
            rows_duplicates=None,
        )


@router.get("/health")
async def health():
    """Health check for the auto-fetch endpoint."""
    subdomain = os.getenv("STOREHUB_SUBDOMAIN")
    secret_configured = bool(os.getenv("AUTO_FETCH_SECRET"))

    return {
        "status": "ok",
        "configured": bool(subdomain and os.getenv("TARGET_TENANT_ID")),
        "secret_configured": secret_configured,
    }
