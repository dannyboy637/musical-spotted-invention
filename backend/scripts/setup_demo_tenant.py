#!/usr/bin/env python3
"""
Setup script for Demo Restaurant tenant (Phase 12 validation).

Creates:
1. Demo Restaurant tenant with alert settings
2. Test users: demo-owner@test.com, demo-viewer@test.com

Usage:
    cd backend
    source venv/bin/activate
    python scripts/setup_demo_tenant.py

Options:
    --password <password>   Set password for test users (default: DemoTest123!)
    --skip-tenant          Skip tenant creation (if already exists)
    --skip-users           Skip user creation (if already exists)
"""
import argparse
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from db.supabase import supabase

# Demo tenant config
DEMO_TENANT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
DEMO_TENANT_NAME = "Demo Restaurant"
DEMO_TENANT_SLUG = "demo-restaurant"

# Test users
TEST_USERS = [
    {
        "email": "demo-owner@test.com",
        "full_name": "Demo Owner",
        "role": "owner",
    },
    {
        "email": "demo-viewer@test.com",
        "full_name": "Demo Viewer",
        "role": "viewer",
    }
]


def create_tenant():
    """Create demo tenant if it doesn't exist."""
    print("Checking for existing demo tenant...")

    # Check if tenant exists
    result = supabase.table("tenants").select("id").eq("slug", DEMO_TENANT_SLUG).execute()

    if result.data:
        print(f"  Demo tenant already exists with ID: {result.data[0]['id']}")
        return result.data[0]['id']

    print("Creating demo tenant...")
    result = supabase.table("tenants").insert({
        "id": DEMO_TENANT_ID,
        "name": DEMO_TENANT_NAME,
        "slug": DEMO_TENANT_SLUG,
        "settings": {
            "timezone": "Asia/Manila",
            "currency": "PHP",
            "branches": ["Main Branch", "Downtown", "Mall Outlet", "Airport", "University"]
        },
        "is_active": True
    }).execute()

    print(f"  Created tenant: {DEMO_TENANT_NAME} ({DEMO_TENANT_ID})")

    # Create default alert settings
    print("Creating alert settings...")
    supabase.table("alert_settings").upsert({
        "tenant_id": DEMO_TENANT_ID,
        "revenue_drop_pct": 15,
        "item_spike_pct": 50,
        "item_crash_pct": 50,
        "quadrant_alerts_enabled": True
    }).execute()
    print("  Alert settings configured")

    return DEMO_TENANT_ID


def create_users(password: str):
    """Create test users using Supabase admin API."""
    created_users = []

    for user_config in TEST_USERS:
        email = user_config["email"]
        print(f"Checking for existing user: {email}...")

        # Check if user already exists in public.users
        result = supabase.table("users").select("id, email").eq("email", email).execute()

        if result.data:
            user_id = result.data[0]["id"]
            print(f"  User exists with ID: {user_id}")

            # Update role and tenant assignment
            supabase.table("users").update({
                "role": user_config["role"],
                "tenant_id": DEMO_TENANT_ID,
                "full_name": user_config["full_name"]
            }).eq("id", user_id).execute()
            print(f"  Updated role to {user_config['role']}")
            created_users.append((email, user_id))
            continue

        print(f"Creating auth user: {email}...")
        try:
            # Create auth user using admin API
            auth_result = supabase.auth.admin.create_user({
                "email": email,
                "password": password,
                "email_confirm": True,  # Skip email verification
                "user_metadata": {
                    "full_name": user_config["full_name"]
                }
            })

            user_id = auth_result.user.id
            print(f"  Created auth user with ID: {user_id}")

            # The trigger should have created the users record
            # Update with correct role and tenant
            print(f"  Setting role={user_config['role']} and tenant_id={DEMO_TENANT_ID}...")
            supabase.table("users").update({
                "role": user_config["role"],
                "tenant_id": DEMO_TENANT_ID,
                "full_name": user_config["full_name"]
            }).eq("id", user_id).execute()

            created_users.append((email, user_id))
            print(f"  User configured successfully")

        except Exception as e:
            if "already been registered" in str(e) or "already exists" in str(e).lower():
                print(f"  User already exists in auth, checking public.users...")
                # Try to find and update
                result = supabase.table("users").select("id").eq("email", email).execute()
                if result.data:
                    user_id = result.data[0]["id"]
                    supabase.table("users").update({
                        "role": user_config["role"],
                        "tenant_id": DEMO_TENANT_ID,
                        "full_name": user_config["full_name"]
                    }).eq("id", user_id).execute()
                    print(f"  Updated existing user")
                    created_users.append((email, user_id))
            else:
                print(f"  Error creating user: {e}")
                raise

    return created_users


def main():
    parser = argparse.ArgumentParser(
        description="Setup Demo Restaurant tenant for Phase 12 validation"
    )
    parser.add_argument(
        "--password",
        default="DemoTest123!",
        help="Password for test users (default: DemoTest123!)"
    )
    parser.add_argument(
        "--skip-tenant",
        action="store_true",
        help="Skip tenant creation"
    )
    parser.add_argument(
        "--skip-users",
        action="store_true",
        help="Skip user creation"
    )

    args = parser.parse_args()

    print("=" * 60)
    print("Phase 12: Demo Tenant Setup")
    print("=" * 60)
    print()

    tenant_id = None
    if not args.skip_tenant:
        tenant_id = create_tenant()
        print()

    users = []
    if not args.skip_users:
        users = create_users(args.password)
        print()

    print("=" * 60)
    print("Setup Complete!")
    print("=" * 60)
    print()
    print("Demo Restaurant Tenant:")
    print(f"  ID: {DEMO_TENANT_ID}")
    print(f"  Slug: {DEMO_TENANT_SLUG}")
    print()
    print("Test Users:")
    for email, uid in users:
        role = next(u["role"] for u in TEST_USERS if u["email"] == email)
        print(f"  {email} ({role})")
        print(f"    Password: {args.password}")
    print()
    print("Next steps:")
    print("  1. Run the data generation script:")
    print("     python scripts/generate_demo_data.py")
    print("  2. Import the generated CSV:")
    print("     python scripts/import_storehub.py --tenant-id", DEMO_TENANT_ID, "--file demo_data.csv")
    print()


if __name__ == "__main__":
    main()
