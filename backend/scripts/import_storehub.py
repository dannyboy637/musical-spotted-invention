#!/usr/bin/env python3
"""
CLI script for importing StoreHub CSV files.

Usage:
    python scripts/import_storehub.py --tenant-id <uuid> --file <path/to/file.csv>

Can also be run via FastAPI background task for uploaded files.
"""
import argparse
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from services.import_service import ImportService


def main():
    parser = argparse.ArgumentParser(
        description="Import StoreHub CSV data into restaurant-analytics"
    )
    parser.add_argument(
        "--tenant-id",
        required=True,
        help="Tenant UUID to import data for"
    )
    parser.add_argument(
        "--file",
        required=True,
        help="Path to CSV file"
    )
    parser.add_argument(
        "--user-id",
        default="system",
        help="User ID for audit trail (default: system)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate CSV without importing"
    )
    parser.add_argument(
        "--skip-regenerate",
        action="store_true",
        help="Skip menu items regeneration after import"
    )

    args = parser.parse_args()

    # Validate file exists
    if not os.path.exists(args.file):
        print(f"Error: File not found: {args.file}")
        sys.exit(1)

    # Read file
    print(f"Reading {args.file}...")
    with open(args.file, 'r', encoding='utf-8') as f:
        content = f.read()

    file_name = os.path.basename(args.file)
    file_size = len(content.encode('utf-8'))

    print(f"File size: {file_size:,} bytes")
    print(f"Tenant ID: {args.tenant_id}")

    if args.dry_run:
        print("\n--- DRY RUN MODE ---")
        print("Validating CSV structure...")

        # Quick validation
        import pandas as pd
        from io import StringIO
        from modules.data_processing import parse_storehub_csv

        try:
            df = pd.read_csv(StringIO(content))
            print(f"Total rows in CSV: {len(df)}")
            print(f"Columns: {list(df.columns)}")

            items_df = parse_storehub_csv(df)
            print(f"Valid item rows: {len(items_df)}")
            print(f"Rows to skip (summary/SC/payment): {len(df) - len(items_df)}")

            print("\nSample items (first 5):")
            item_col = next((c for c in ['Item', 'item'] if c in items_df.columns), None)
            if item_col:
                for i, item in enumerate(items_df[item_col].head(5)):
                    print(f"  {i+1}. {item}")

            print("\n--- Validation complete (no data imported) ---")
        except Exception as e:
            print(f"Error: {e}")
            sys.exit(1)

        return

    # Create import service
    print("\nStarting import...")
    import_service = ImportService(args.tenant_id, args.user_id)

    # Create job record
    job_id = import_service.create_import_job(
        file_name=file_name,
        file_path=f"cli-import/{file_name}",
        file_size=file_size
    )
    print(f"Created import job: {job_id}")

    # Process
    try:
        result = import_service.process_csv(content, file_name)

        print(f"\nImport complete!")
        print(f"  Total rows:  {result['total_rows']:,}")
        print(f"  Processed:   {result['processed_rows']:,}")
        print(f"  Inserted:    {result['inserted_rows']:,}")
        print(f"  Skipped:     {result['skipped_rows']:,}")
        print(f"  Errors:      {result['error_count']:,}")

        if result['error_count'] > 0:
            print("\nWarning: Some rows had errors. Check import job for details.")

        # Regenerate menu items
        if not args.skip_regenerate:
            print("\nRegenerating menu items...")
            menu_count = import_service.regenerate_menu_items()
            print(f"  Menu items updated: {menu_count:,}")
        else:
            print("\nSkipped menu items regeneration (--skip-regenerate)")

        print(f"\nJob ID: {job_id}")

    except Exception as e:
        print(f"\nError during import: {e}")
        import_service.update_job_status(
            status="failed",
            error_message=str(e)
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
