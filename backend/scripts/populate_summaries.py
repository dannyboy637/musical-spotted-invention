#!/usr/bin/env python3
"""
Populate summary tables for existing tenants.

This script runs the refresh functions for all tenants that have transaction data.
Use this once after running migrations 031-035 to populate the new summary tables.

Usage:
    cd backend
    source venv/bin/activate
    python scripts/populate_summaries.py

    # Or for a specific tenant:
    python scripts/populate_summaries.py --tenant-id <uuid>

    # Dry run (show what would be processed):
    python scripts/populate_summaries.py --dry-run
"""

import argparse
import os
import sys
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from db.supabase import supabase


def get_tenants_with_data():
    """Get all tenants that have transaction data."""
    result = supabase.table("tenants").select(
        "id, name"
    ).eq("is_active", True).execute()

    tenants = []
    for tenant in result.data:
        # Check if tenant has any transactions
        count_result = supabase.table("transactions").select(
            "id", count="exact"
        ).eq("tenant_id", tenant["id"]).limit(1).execute()

        if count_result.count and count_result.count > 0:
            tenants.append({
                "id": tenant["id"],
                "name": tenant["name"],
                "transaction_count": count_result.count
            })

    return tenants


def refresh_tenant_summaries(tenant_id: str, tenant_name: str) -> dict:
    """Refresh all summary tables for a single tenant."""
    print(f"\n{'='*60}")
    print(f"Refreshing summaries for: {tenant_name}")
    print(f"Tenant ID: {tenant_id}")
    print(f"{'='*60}")

    start_time = datetime.now()
    results = {}

    # 1. Refresh hourly_summaries
    print("\n[1/3] Refreshing hourly_summaries...", flush=True)
    try:
        result = supabase.rpc("refresh_hourly_summaries", {
            "p_tenant_id": tenant_id
        }).execute()
        results["hourly_summaries"] = result.data
        rows_inserted = result.data.get("rows_inserted", 0) if result.data else 0
        print(f"      Done: {rows_inserted} rows inserted")
    except Exception as e:
        print(f"      ERROR: {e}")
        results["hourly_summaries"] = {"error": str(e)}

    # 2. Refresh item_pairs
    print("\n[2/3] Refreshing item_pairs...", flush=True)
    try:
        result = supabase.rpc("refresh_item_pairs", {
            "p_tenant_id": tenant_id
        }).execute()
        results["item_pairs"] = result.data
        rows_inserted = result.data.get("rows_inserted", 0) if result.data else 0
        print(f"      Done: {rows_inserted} pairs stored")
    except Exception as e:
        print(f"      ERROR: {e}")
        results["item_pairs"] = {"error": str(e)}

    # 3. Refresh branch_summaries
    print("\n[3/3] Refreshing branch_summaries...", flush=True)
    try:
        result = supabase.rpc("refresh_branch_summaries", {
            "p_tenant_id": tenant_id
        }).execute()
        results["branch_summaries"] = result.data
        rows_inserted = result.data.get("rows_inserted", 0) if result.data else 0
        print(f"      Done: {rows_inserted} rows inserted")
    except Exception as e:
        print(f"      ERROR: {e}")
        results["branch_summaries"] = {"error": str(e)}

    duration = (datetime.now() - start_time).total_seconds()
    print(f"\nCompleted in {duration:.1f} seconds")

    return {
        "tenant_id": tenant_id,
        "tenant_name": tenant_name,
        "duration_seconds": duration,
        "results": results
    }


def main():
    parser = argparse.ArgumentParser(
        description="Populate summary tables for existing tenants"
    )
    parser.add_argument(
        "--tenant-id",
        help="Specific tenant ID to process (otherwise processes all)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be processed without making changes"
    )

    args = parser.parse_args()

    print("=" * 60)
    print("SUMMARY TABLE POPULATION SCRIPT")
    print("=" * 60)

    # Get tenants to process
    if args.tenant_id:
        # Verify tenant exists
        result = supabase.table("tenants").select(
            "id, name"
        ).eq("id", args.tenant_id).single().execute()

        if not result.data:
            print(f"ERROR: Tenant {args.tenant_id} not found")
            sys.exit(1)

        tenants = [{
            "id": result.data["id"],
            "name": result.data["name"],
            "transaction_count": "N/A"
        }]
    else:
        print("\nFinding tenants with transaction data...")
        tenants = get_tenants_with_data()

    if not tenants:
        print("No tenants with transaction data found.")
        sys.exit(0)

    print(f"\nFound {len(tenants)} tenant(s) to process:")
    for t in tenants:
        print(f"  - {t['name']} ({t['id'][:8]}...) - {t['transaction_count']} transactions")

    if args.dry_run:
        print("\n[DRY RUN] No changes made.")
        sys.exit(0)

    # Confirm before proceeding
    print("\nThis will rebuild all summary tables for these tenants.")
    response = input("Continue? [y/N] ").strip().lower()
    if response != "y":
        print("Aborted.")
        sys.exit(0)

    # Process each tenant
    overall_start = datetime.now()
    results = []

    for i, tenant in enumerate(tenants, 1):
        print(f"\n[{i}/{len(tenants)}] Processing tenant...")
        result = refresh_tenant_summaries(tenant["id"], tenant["name"])
        results.append(result)

    # Summary
    overall_duration = (datetime.now() - overall_start).total_seconds()

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Tenants processed: {len(results)}")
    print(f"Total duration: {overall_duration:.1f} seconds")

    for r in results:
        status = "OK"
        for table, data in r["results"].items():
            if isinstance(data, dict) and "error" in data:
                status = "ERRORS"
                break
        print(f"  - {r['tenant_name']}: {status} ({r['duration_seconds']:.1f}s)")

    print("\nDone!")


if __name__ == "__main__":
    main()
