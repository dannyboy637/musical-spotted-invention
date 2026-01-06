#!/usr/bin/env python3
"""
Weekly Report Generation Script

Run this script to generate reports for all tenants for the previous week.
Designed to be run via cron job on Monday 8am Manila time.

Usage:
    python scripts/generate_weekly_reports.py [--style full|bullets]

Schedule (cron example for Monday 8am Manila/UTC+8 = Sunday midnight UTC):
    0 0 * * 1 cd /path/to/backend && python scripts/generate_weekly_reports.py

Environment:
    Requires SUPABASE_URL and SUPABASE_SERVICE_KEY in .env
"""
import os
import sys
import argparse
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from db.supabase import supabase
from modules.reports import generate_report_data, get_week_bounds
from services.ai_narrative import generate_narrative


def generate_all_reports(narrative_style: str = "full") -> dict:
    """
    Generate reports for all tenants that don't have one for the current period.

    Returns summary dict with counts and any errors.
    """
    start_date, end_date = get_week_bounds()
    print(f"Generating reports for period: {start_date} to {end_date}")

    # Get all tenants
    tenants_result = supabase.table("tenants").select("id, name").execute()
    tenants = tenants_result.data or []
    print(f"Found {len(tenants)} tenants")

    # Get existing reports for this period
    existing_result = supabase.table("reports").select("tenant_id").eq(
        "period_start", start_date
    ).eq("period_end", end_date).execute()
    existing_tenant_ids = {r["tenant_id"] for r in (existing_result.data or [])}
    print(f"Skipping {len(existing_tenant_ids)} tenants with existing reports")

    generated = 0
    errors = []

    for tenant in tenants:
        if tenant["id"] in existing_tenant_ids:
            continue

        tenant_name = tenant["name"]
        print(f"  Generating for: {tenant_name}...", end=" ")

        try:
            # Generate report data
            report_data = generate_report_data(tenant["id"], start_date, end_date)

            # Generate narrative
            narrative = generate_narrative(
                report_data,
                style=narrative_style,
                tenant_name=tenant_name,
            )

            # Save report
            supabase.table("reports").insert({
                "tenant_id": tenant["id"],
                "period_start": start_date,
                "period_end": end_date,
                "status": "pending",
                "narrative_style": narrative_style,
                "narrative_text": narrative,
                "report_data": report_data,
            }).execute()

            generated += 1
            print("OK")

        except Exception as e:
            errors.append({"tenant_id": tenant["id"], "tenant_name": tenant_name, "error": str(e)})
            print(f"ERROR: {e}")

    return {
        "period": {"start_date": start_date, "end_date": end_date},
        "generated": generated,
        "skipped": len(existing_tenant_ids),
        "total_tenants": len(tenants),
        "errors": errors,
    }


def main():
    parser = argparse.ArgumentParser(description="Generate weekly reports for all tenants")
    parser.add_argument(
        "--style",
        choices=["full", "bullets"],
        default="full",
        help="Narrative style (default: full)"
    )
    args = parser.parse_args()

    print(f"=== Weekly Report Generation ===")
    print(f"Started at: {datetime.now().isoformat()}")
    print(f"Narrative style: {args.style}")
    print()

    result = generate_all_reports(args.style)

    print()
    print("=== Summary ===")
    print(f"Period: {result['period']['start_date']} to {result['period']['end_date']}")
    print(f"Total tenants: {result['total_tenants']}")
    print(f"Reports generated: {result['generated']}")
    print(f"Skipped (already exist): {result['skipped']}")

    if result["errors"]:
        print(f"\nErrors ({len(result['errors'])}):")
        for err in result["errors"]:
            print(f"  - {err['tenant_name']}: {err['error']}")

    print()
    print(f"Completed at: {datetime.now().isoformat()}")


if __name__ == "__main__":
    main()
