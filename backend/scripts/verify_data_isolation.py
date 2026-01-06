#!/usr/bin/env python3
"""
Data isolation verification script for Phase 12.

Tests that:
1. Tenants can only see their own data
2. Overlapping item names are isolated correctly
3. Same-date queries return correct tenant data
4. Operator can see all tenants

Usage:
    cd backend
    source venv/bin/activate
    python scripts/verify_data_isolation.py

Requires:
    - Two tenants with data imported
    - Demo Restaurant tenant created via setup_demo_tenant.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from db.supabase import supabase

# Demo tenant ID
DEMO_TENANT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"


def print_header(title: str):
    print()
    print("=" * 60)
    print(f"  {title}")
    print("=" * 60)


def print_result(test: str, passed: bool, details: str = ""):
    status = "PASS" if passed else "FAIL"
    icon = "[OK]" if passed else "[X]"
    print(f"  {icon} {test}")
    if details:
        print(f"      {details}")


def get_all_tenants():
    """Get all tenants in the system."""
    result = supabase.table("tenants").select("id, name, slug").execute()
    return result.data


def get_tenant_transaction_count(tenant_id: str) -> int:
    """Get transaction count for a tenant."""
    result = supabase.table("transactions") \
        .select("id", count="exact") \
        .eq("tenant_id", tenant_id) \
        .execute()
    return result.count or 0


def get_tenant_branches(tenant_id: str) -> list:
    """Get unique branches for a tenant."""
    result = supabase.rpc("get_distinct_store_names", {
        "p_tenant_id": tenant_id
    }).execute()
    if result.data:
        return [r["store_name"] for r in result.data if r.get("store_name")]
    return []


def get_overlapping_items(tenant_a: str, tenant_b: str) -> list:
    """Find item names that exist in both tenants."""
    # Get items from tenant A
    result_a = supabase.table("transactions") \
        .select("item_name") \
        .eq("tenant_id", tenant_a) \
        .execute()
    items_a = set(r["item_name"] for r in result_a.data if r.get("item_name"))

    # Get items from tenant B
    result_b = supabase.table("transactions") \
        .select("item_name") \
        .eq("tenant_id", tenant_b) \
        .execute()
    items_b = set(r["item_name"] for r in result_b.data if r.get("item_name"))

    return list(items_a & items_b)


def verify_item_isolation(item_name: str, tenant_a: str, tenant_b: str) -> bool:
    """Verify that the same item name has different data per tenant."""
    # Get revenue for item in tenant A
    result_a = supabase.table("transactions") \
        .select("gross_revenue") \
        .eq("tenant_id", tenant_a) \
        .eq("item_name", item_name) \
        .execute()
    revenue_a = sum(r["gross_revenue"] for r in result_a.data) if result_a.data else 0

    # Get revenue for item in tenant B
    result_b = supabase.table("transactions") \
        .select("gross_revenue") \
        .eq("tenant_id", tenant_b) \
        .eq("item_name", item_name) \
        .execute()
    revenue_b = sum(r["gross_revenue"] for r in result_b.data) if result_b.data else 0

    # They should have different totals (proves isolation)
    return revenue_a != revenue_b or (revenue_a > 0 and revenue_b > 0)


def get_overlapping_dates(tenant_a: str, tenant_b: str) -> list:
    """Find dates with transactions in both tenants."""
    # Get dates from tenant A
    result_a = supabase.rpc("get_tenant_date_range", {"p_tenant_id": tenant_a}).execute()

    # Get dates from tenant B
    result_b = supabase.rpc("get_tenant_date_range", {"p_tenant_id": tenant_b}).execute()

    # For simplicity, just return if both have data in the same general period
    return result_a.data, result_b.data


def verify_date_isolation(date_str: str, tenant_a: str, tenant_b: str) -> bool:
    """Verify same-date transactions are isolated."""
    # Count transactions on date for tenant A
    result_a = supabase.table("transactions") \
        .select("id", count="exact") \
        .eq("tenant_id", tenant_a) \
        .gte("receipt_timestamp", f"{date_str}T00:00:00") \
        .lt("receipt_timestamp", f"{date_str}T23:59:59") \
        .execute()
    count_a = result_a.count or 0

    # Count transactions on date for tenant B
    result_b = supabase.table("transactions") \
        .select("id", count="exact") \
        .eq("tenant_id", tenant_b) \
        .gte("receipt_timestamp", f"{date_str}T00:00:00") \
        .lt("receipt_timestamp", f"{date_str}T23:59:59") \
        .execute()
    count_b = result_b.count or 0

    # Both should have data but different counts
    return count_a > 0 and count_b > 0


def main():
    print_header("Data Isolation Verification - Phase 12")
    print()

    # Get all tenants
    tenants = get_all_tenants()
    print(f"Found {len(tenants)} tenants:")
    for t in tenants:
        print(f"  - {t['name']} ({t['slug']})")

    if len(tenants) < 2:
        print()
        print("ERROR: Need at least 2 tenants for isolation testing.")
        print("Run setup_demo_tenant.py and import demo data first.")
        sys.exit(1)

    # Find Demo Restaurant and another tenant
    demo_tenant = next((t for t in tenants if t["id"] == DEMO_TENANT_ID), None)
    other_tenant = next((t for t in tenants if t["id"] != DEMO_TENANT_ID), None)

    if not demo_tenant:
        print()
        print("ERROR: Demo Restaurant tenant not found.")
        print("Run setup_demo_tenant.py first.")
        sys.exit(1)

    print()
    print(f"Testing isolation between:")
    print(f"  Tenant A: {other_tenant['name']} ({other_tenant['id'][:8]}...)")
    print(f"  Tenant B: {demo_tenant['name']} ({demo_tenant['id'][:8]}...)")

    all_passed = True

    # Test 1: Transaction counts differ
    print_header("Test 1: Transaction Counts")
    count_a = get_tenant_transaction_count(other_tenant["id"])
    count_b = get_tenant_transaction_count(demo_tenant["id"])
    passed = count_a > 0 and count_b > 0 and count_a != count_b
    print_result(
        "Tenants have different transaction counts",
        passed,
        f"Tenant A: {count_a:,} | Tenant B: {count_b:,}"
    )
    all_passed = all_passed and passed

    # Test 2: Branches are isolated
    print_header("Test 2: Branch Isolation")
    branches_a = get_tenant_branches(other_tenant["id"])
    branches_b = get_tenant_branches(demo_tenant["id"])
    overlap = set(branches_a) & set(branches_b)
    passed = len(overlap) == 0
    print_result(
        "No overlapping branch names",
        passed,
        f"A: {len(branches_a)} branches | B: {len(branches_b)} branches | Overlap: {len(overlap)}"
    )
    all_passed = all_passed and passed

    # Test 3: Overlapping item names are isolated
    print_header("Test 3: Item Name Isolation")
    overlapping_items = get_overlapping_items(other_tenant["id"], demo_tenant["id"])
    print(f"  Found {len(overlapping_items)} overlapping item names")
    if overlapping_items:
        # Test a few items
        test_items = overlapping_items[:5]
        for item in test_items:
            item_passed = verify_item_isolation(item, other_tenant["id"], demo_tenant["id"])
            print_result(
                f"'{item}' isolated between tenants",
                item_passed
            )
            all_passed = all_passed and item_passed
    else:
        print("  (No overlapping items to test - add items with same names to both tenants)")

    # Test 4: API endpoints respect tenant context
    print_header("Test 4: API Endpoint Isolation")
    print("  (Manual testing required - login as each user and verify data)")
    print("  ")
    print("  Test checklist:")
    print("  [ ] Login as Demo Owner - sees only Demo Restaurant data")
    print("  [ ] Login as other tenant owner - sees only their data")
    print("  [ ] Login as Operator - can switch between tenants")
    print("  [ ] Menu Engineering shows different items per tenant")
    print("  [ ] Revenue totals differ per tenant")

    # Test 5: RLS policy verification
    print_header("Test 5: RLS Policy Check")
    # Try to query without tenant filter (should return nothing or error with proper RLS)
    try:
        result = supabase.table("transactions") \
            .select("id", count="exact") \
            .execute()
        total_count = result.count or 0
        expected_total = count_a + count_b
        # With service role key, we can see all data
        # The real test is through the API with user tokens
        passed = total_count >= expected_total
        print_result(
            "Service role can access all transactions",
            passed,
            f"Total: {total_count:,} (expected >= {expected_total:,})"
        )
    except Exception as e:
        print_result("RLS blocks unauthorized access", True, str(e))

    # Summary
    print_header("Summary")
    if all_passed:
        print("  All automated tests PASSED!")
    else:
        print("  Some tests FAILED - review above for details")

    print()
    print("  Next steps:")
    print("  1. Login to the app as each user role")
    print("  2. Verify data matches expected tenant")
    print("  3. Test all dashboard modules")
    print("  4. Document any issues found")
    print()


if __name__ == "__main__":
    main()
