"""
Import service - orchestrates CSV import workflow.
"""
from datetime import datetime
from typing import Optional, Dict, List
from io import StringIO
import pandas as pd

from db.supabase import supabase
from modules.data_processing import (
    parse_storehub_csv,
    extract_service_charge_by_receipt,
    calculate_receipt_subtotals,
    transform_storehub_row,
)


class ImportService:
    """Handles CSV import workflow for StoreHub data."""

    def __init__(self, tenant_id: str, user_id: str):
        self.tenant_id = tenant_id
        self.user_id = user_id
        self.job_id: Optional[str] = None

    def create_import_job(
        self,
        file_name: str,
        file_path: str,
        file_size: Optional[int] = None
    ) -> str:
        """Create a new import job record."""
        result = supabase.table("data_import_jobs").insert({
            "tenant_id": self.tenant_id,
            "file_name": file_name,
            "file_path": file_path,
            "file_size_bytes": file_size,
            "status": "pending",
            "created_by": self.user_id if self.user_id != "system" else None,
        }).execute()

        self.job_id = result.data[0]["id"]
        return self.job_id

    def update_job_status(
        self,
        status: str,
        processed_rows: Optional[int] = None,
        inserted_rows: Optional[int] = None,
        error_message: Optional[str] = None,
        **kwargs
    ):
        """Update import job status and progress."""
        if not self.job_id:
            return

        update_data = {"status": status}

        if processed_rows is not None:
            update_data["processed_rows"] = processed_rows
        if inserted_rows is not None:
            update_data["inserted_rows"] = inserted_rows
        if error_message:
            update_data["error_message"] = error_message

        if status == "processing":
            update_data["started_at"] = datetime.utcnow().isoformat()
        elif status in ("completed", "failed"):
            update_data["completed_at"] = datetime.utcnow().isoformat()

        update_data.update(kwargs)

        supabase.table("data_import_jobs").update(update_data).eq("id", self.job_id).execute()

    def process_csv(self, csv_content: str, file_name: str) -> Dict:
        """
        Process CSV content and insert transactions.

        Returns dict with processing stats.
        """
        # Parse CSV
        df = pd.read_csv(StringIO(csv_content))
        total_rows = len(df)

        self.update_job_status(
            status="processing",
            total_rows=total_rows
        )

        # Extract service charges and receipt subtotals
        service_charges = extract_service_charge_by_receipt(df)
        receipt_subtotals = calculate_receipt_subtotals(df)

        # Filter to valid item rows
        items_df = parse_storehub_csv(df)

        # Detect date column and parse timestamps
        date_col = None
        for col in ['Time', 'Date', 'date', 'DATE', 'Timestamp', 'timestamp']:
            if col in items_df.columns:
                date_col = col
                break

        date_range_start = None
        date_range_end = None

        if date_col:
            items_df[date_col] = pd.to_datetime(items_df[date_col], errors='coerce')
            date_range_start = items_df[date_col].min()
            date_range_end = items_df[date_col].max()

        # Transform and insert in batches
        batch_size = 500  # Increased from 100 for faster imports
        inserted = 0
        skipped = 0
        errors: List[Dict] = []

        total_items = len(items_df)
        print(f"Processing {total_items} items...", flush=True)

        transactions = []
        for idx, (_, row) in enumerate(items_df.iterrows()):
            try:
                trans = transform_storehub_row(row, service_charges, receipt_subtotals)
                trans["tenant_id"] = self.tenant_id
                trans["import_batch_id"] = self.job_id
                trans["source_file"] = file_name
                trans["source_row_number"] = idx + 1
                transactions.append(trans)

                # Insert in batches
                if len(transactions) >= batch_size:
                    print(f"  Inserting batch of {len(transactions)} rows...", flush=True)
                    try:
                        result = supabase.table("transactions").insert(transactions).execute()
                        inserted += len(result.data)
                        print(f"  Batch inserted successfully.", flush=True)
                    except Exception as e:
                        print(f"  Batch failed: {str(e)[:100]}. Trying one by one...", flush=True)
                        # Try inserting one by one to identify problematic rows
                        for t in transactions:
                            try:
                                result = supabase.table("transactions").insert(t).execute()
                                inserted += 1
                            except Exception as row_error:
                                errors.append({
                                    "row": t.get("source_row_number"),
                                    "error": str(row_error)
                                })
                    transactions = []

                    # Update progress
                    progress = (idx + 1) / total_items * 100
                    print(f"  Progress: {idx + 1}/{total_items} ({progress:.1f}%) - {inserted} inserted", flush=True)
                    self.update_job_status(
                        status="processing",
                        processed_rows=idx + 1,
                        inserted_rows=inserted
                    )
            except Exception as e:
                errors.append({"row": idx + 1, "error": str(e)})

        # Insert remaining
        if transactions:
            try:
                result = supabase.table("transactions").insert(transactions).execute()
                inserted += len(result.data)
            except Exception as e:
                for t in transactions:
                    try:
                        result = supabase.table("transactions").insert(t).execute()
                        inserted += 1
                    except Exception as row_error:
                        errors.append({
                            "row": t.get("source_row_number"),
                            "error": str(row_error)
                        })

        # Final update
        final_status = "completed"
        self.update_job_status(
            status=final_status,
            processed_rows=len(items_df),
            inserted_rows=inserted,
            skipped_rows=total_rows - len(items_df),
            error_rows=len(errors),
            error_details={"errors": errors[:100]} if errors else None,
            date_range_start=date_range_start.date().isoformat() if date_range_start and pd.notna(date_range_start) else None,
            date_range_end=date_range_end.date().isoformat() if date_range_end and pd.notna(date_range_end) else None,
        )

        return {
            "job_id": self.job_id,
            "total_rows": total_rows,
            "processed_rows": len(items_df),
            "inserted_rows": inserted,
            "skipped_rows": total_rows - len(items_df),
            "error_count": len(errors),
        }

    def regenerate_menu_items(self) -> int:
        """
        Regenerate menu_items aggregation for tenant.

        This calls the database function to recalculate analytics.
        Returns count of menu items updated/inserted.
        """
        try:
            result = supabase.rpc("aggregate_menu_items", {
                "p_tenant_id": self.tenant_id
            }).execute()

            if result.data and len(result.data) > 0:
                return result.data[0].get("items_updated", 0)
            return 0
        except Exception as e:
            # Log error but don't fail the import
            print(f"Warning: Failed to regenerate menu items: {e}")
            return 0
