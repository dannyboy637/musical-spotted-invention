#!/usr/bin/env python3
"""
Auto-fetch StoreHub daily sales CSV and import into restaurant-analytics.

This script:
1. Logs into StoreHub via HTTP (no browser needed)
2. Downloads the previous day's transaction CSV
3. Imports it using the existing ImportService

Usage:
    python scripts/auto_fetch_storehub.py

Environment variables required:
    STOREHUB_SUBDOMAIN     - e.g., "spottedpigcafe-legazpi"
    STOREHUB_USERNAME      - StoreHub login email/username
    STOREHUB_PASSWORD      - StoreHub login password
    TARGET_TENANT_ID       - UUID of the tenant in our system

Optional:
    STOREHUB_STORE_ID      - Specific store ID (default: "allStores")
    FETCH_DATE             - Override date to fetch (MM/DD/YYYY format)
    DRY_RUN                - Set to "true" to download CSV without importing
"""
import os
import sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from urllib.parse import quote

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

import httpx

from services.import_service import ImportService


class StoreHubClient:
    """HTTP client for StoreHub API."""

    def __init__(self, subdomain: str):
        self.subdomain = subdomain
        self.base_url = f"https://{subdomain}.storehubhq.com"
        self.session_cookie: str | None = None

    def login(self, username: str, password: str) -> bool:
        """
        Login to StoreHub and capture session cookie.

        Returns True if login successful, False otherwise.
        """
        print(f"Logging into StoreHub ({self.subdomain})...")

        # Try with 'username' field first, then 'email' if that fails
        for field_name in ["username", "email"]:
            try:
                response = httpx.post(
                    f"{self.base_url}/login",
                    json={field_name: username, "password": password},
                    headers={
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                    },
                    follow_redirects=True,
                    timeout=30.0,
                )

                # Check for session cookie in response
                if "connect.sid" in response.cookies:
                    self.session_cookie = response.cookies["connect.sid"]
                    print(f"Login successful (using '{field_name}' field)")
                    return True

                # Also check Set-Cookie header directly
                for cookie in response.headers.get_list("set-cookie"):
                    if cookie.startswith("connect.sid="):
                        # Extract the cookie value
                        self.session_cookie = cookie.split(";")[0].replace("connect.sid=", "")
                        print(f"Login successful (using '{field_name}' field)")
                        return True

                # Check if response indicates login failure
                if response.status_code == 401 or response.status_code == 403:
                    print(f"  Login attempt with '{field_name}' returned {response.status_code}")
                    continue

            except httpx.RequestError as e:
                print(f"  Request error with '{field_name}': {e}")
                continue

        print("Login failed - could not obtain session cookie")
        return False

    def download_csv(
        self,
        date_from: str,
        date_to: str,
        store_id: str = "allStores",
        include_items: bool = True,
        include_payments: bool = True,
    ) -> str | None:
        """
        Download transaction CSV for a date range.

        Args:
            date_from: Start date in MM/DD/YYYY format
            date_to: End date in MM/DD/YYYY format
            store_id: Store ID or "allStores"
            include_items: Include line items
            include_payments: Include payment details

        Returns:
            CSV content as string, or None if failed.
        """
        if not self.session_cookie:
            print("Error: Not logged in (no session cookie)")
            return None

        print(f"Downloading CSV for {date_from} to {date_to}...")

        # URL-encode the dates (/ becomes %2F)
        params = {
            "from": date_from,
            "to": date_to,
            "storeId": store_id,
            "includeItems": "true" if include_items else "false",
            "includePayments": "true" if include_payments else "false",
        }

        try:
            response = httpx.get(
                f"{self.base_url}/transactions/csv",
                params=params,
                cookies={"connect.sid": self.session_cookie},
                timeout=120.0,  # Large exports may take time
                follow_redirects=True,
            )

            if response.status_code == 200:
                content_type = response.headers.get("content-type", "")
                if "text/csv" in content_type:
                    csv_content = response.text
                    # Count rows (minus header)
                    row_count = csv_content.count("\n") - 1
                    print(f"Downloaded CSV: {len(csv_content):,} bytes, ~{row_count:,} rows")
                    return csv_content
                else:
                    print(f"Unexpected content type: {content_type}")
                    print(f"Response: {response.text[:500]}")
                    return None
            elif response.status_code == 401:
                print("Session expired - need to re-login")
                return None
            else:
                print(f"Download failed: HTTP {response.status_code}")
                print(f"Response: {response.text[:500]}")
                return None

        except httpx.RequestError as e:
            print(f"Request error: {e}")
            return None


def get_yesterday_date() -> str:
    """Get yesterday's date in MM/DD/YYYY format (Manila timezone)."""
    # Use Manila timezone since cron job runs at 2AM Manila time
    tz = ZoneInfo(os.getenv("AUTO_FETCH_TIMEZONE", "Asia/Manila"))
    now_local = datetime.now(tz)
    yesterday = now_local - timedelta(days=1)
    return yesterday.strftime("%m/%d/%Y")


def main():
    # Load configuration from environment
    subdomain = os.getenv("STOREHUB_SUBDOMAIN")
    username = os.getenv("STOREHUB_USERNAME")
    password = os.getenv("STOREHUB_PASSWORD")
    tenant_id = os.getenv("TARGET_TENANT_ID")
    store_id = os.getenv("STOREHUB_STORE_ID", "allStores")
    fetch_date = os.getenv("FETCH_DATE")  # Optional override
    dry_run = os.getenv("DRY_RUN", "").lower() == "true"

    # Validate required config
    missing = []
    if not subdomain:
        missing.append("STOREHUB_SUBDOMAIN")
    if not username:
        missing.append("STOREHUB_USERNAME")
    if not password:
        missing.append("STOREHUB_PASSWORD")
    if not tenant_id:
        missing.append("TARGET_TENANT_ID")

    if missing:
        print(f"Error: Missing required environment variables: {', '.join(missing)}")
        print("\nRequired variables:")
        print("  STOREHUB_SUBDOMAIN  - e.g., 'spottedpigcafe-legazpi'")
        print("  STOREHUB_USERNAME   - StoreHub login email/username")
        print("  STOREHUB_PASSWORD   - StoreHub login password")
        print("  TARGET_TENANT_ID    - UUID of tenant in restaurant-analytics")
        sys.exit(1)

    # Determine date to fetch
    if fetch_date:
        target_date = fetch_date
        print(f"Using override date: {target_date}")
    else:
        target_date = get_yesterday_date()
        print(f"Fetching yesterday's data: {target_date}")

    print(f"Subdomain: {subdomain}")
    print(f"Store ID: {store_id}")
    print(f"Tenant ID: {tenant_id}")
    if dry_run:
        print("Mode: DRY RUN (will download but not import)")
    print()

    # Initialize client and login
    client = StoreHubClient(subdomain)

    if not client.login(username, password):
        print("\nFailed to login to StoreHub")
        sys.exit(1)

    # Download CSV
    csv_content = client.download_csv(
        date_from=target_date,
        date_to=target_date,
        store_id=store_id,
    )

    if not csv_content:
        print("\nFailed to download CSV")
        sys.exit(1)

    # Check if CSV has any data (more than just header)
    lines = csv_content.strip().split("\n")
    if len(lines) <= 1:
        print("\nCSV is empty (header only) - no transactions for this date")
        print("This is normal if the restaurant was closed.")
        sys.exit(0)

    if dry_run:
        print("\n--- DRY RUN MODE ---")
        print(f"Would import {len(lines) - 1} rows")
        print("\nFirst 5 lines of CSV:")
        for line in lines[:5]:
            print(f"  {line[:100]}...")
        print("\nTo actually import, unset DRY_RUN environment variable")
        sys.exit(0)

    # Import using existing service
    print("\nStarting import...")
    file_name = f"auto_fetch_{target_date.replace('/', '-')}.csv"

    import_service = ImportService(tenant_id, "system")

    job_id = import_service.create_import_job(
        file_name=file_name,
        file_path=f"auto-fetch/{file_name}",
        file_size=len(csv_content.encode("utf-8")),
    )
    print(f"Created import job: {job_id}")

    try:
        result = import_service.process_csv(csv_content, file_name)

        print(f"\nImport complete!")
        print(f"  Total rows:    {result['total_rows']:,}")
        print(f"  Processed:     {result['processed_rows']:,}")
        print(f"  Inserted:      {result['inserted_rows']:,}")
        print(f"  Duplicates:    {result.get('duplicate_skipped', 0):,}")
        print(f"  Skipped:       {result['skipped_rows']:,}")
        print(f"  Errors:        {result['error_count']:,}")
        print(f"  Alerts:        {result['alerts_created']}")

        if result.get("aborted"):
            print("\nWarning: Import was aborted due to errors")
            sys.exit(1)

        # Regenerate menu items
        print("\nRegenerating menu items...")
        menu_count = import_service.regenerate_menu_items()
        print(f"  Menu items updated: {menu_count:,}")

        print(f"\nJob ID: {job_id}")
        print("Auto-fetch completed successfully!")

    except Exception as e:
        print(f"\nError during import: {e}")
        import_service.update_job_status(
            status="failed",
            error_message=str(e),
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
