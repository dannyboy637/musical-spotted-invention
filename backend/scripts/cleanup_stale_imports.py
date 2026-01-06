#!/usr/bin/env python3
"""
Stale Import Job Cleanup Script

Marks processing jobs older than the timeout threshold as failed.
Designed to be run via cron job every hour.

Usage:
    python scripts/cleanup_stale_imports.py [--timeout-hours N]

Schedule (cron example - run every hour):
    0 * * * * cd /path/to/backend && python scripts/cleanup_stale_imports.py

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


def cleanup_stale_jobs(timeout_hours: int = 1) -> dict:
    """
    Call the database function to clean up stale import jobs.

    Jobs stuck in 'processing' status for longer than timeout_hours
    will be marked as 'failed'.

    Returns dict with cleanup results.
    """
    result = supabase.rpc("cleanup_stale_import_jobs", {
        "p_timeout_hours": timeout_hours,
    }).execute()

    return result.data if result.data else {"jobs_cleaned": 0, "job_ids": []}


def main():
    parser = argparse.ArgumentParser(
        description="Clean up stale import jobs that are stuck in processing state"
    )
    parser.add_argument(
        "--timeout-hours",
        type=int,
        default=1,
        help="Hours after which a processing job is considered stale (default: 1)"
    )
    args = parser.parse_args()

    print("=" * 50)
    print("Stale Import Job Cleanup")
    print("=" * 50)
    print(f"Started at: {datetime.now().isoformat()}")
    print(f"Timeout threshold: {args.timeout_hours} hour(s)")
    print()

    try:
        result = cleanup_stale_jobs(args.timeout_hours)

        jobs_cleaned = result.get("jobs_cleaned", 0)
        job_ids = result.get("job_ids", [])

        if jobs_cleaned > 0:
            print(f"Cleaned up {jobs_cleaned} stale job(s):")
            for job_id in job_ids:
                print(f"  - {job_id}")
        else:
            print("No stale jobs found.")

        print()
        print(f"Completed at: {datetime.now().isoformat()}")
        print("=" * 50)

        return jobs_cleaned

    except Exception as e:
        print(f"ERROR: Failed to run cleanup: {e}")
        print(f"Completed with error at: {datetime.now().isoformat()}")
        print("=" * 50)
        return -1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(0 if exit_code >= 0 else 1)
