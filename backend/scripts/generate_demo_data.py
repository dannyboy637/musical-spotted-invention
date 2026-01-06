#!/usr/bin/env python3
"""
Generate realistic demo data for Demo Restaurant (Phase 12 validation).

Creates 18 months of transaction data with:
- 5 branches: Main Branch, Downtown, Mall Outlet, Airport, University
- Realistic dayparting (breakfast, lunch, dinner peaks)
- Weekend vs weekday variance
- Seasonal fluctuations
- Overlapping item names with typical restaurants (Fried Rice, Coffee, etc.)

Usage:
    cd backend
    source venv/bin/activate
    python scripts/generate_demo_data.py

Options:
    --output <path>     Output CSV file path (default: demo_data.csv)
    --months <n>        Number of months of data (default: 18)
    --seed <n>          Random seed for reproducibility (default: 42)
"""
import argparse
import random
import csv
from datetime import datetime, timedelta
from typing import List, Dict, Tuple
import math

# ============================================
# CONFIGURATION
# ============================================

BRANCHES = [
    "Demo - Main Branch",
    "Demo - Downtown",
    "Demo - Mall Outlet",
    "Demo - Airport",
    "Demo - University"
]

# Branch characteristics (multipliers for base traffic)
BRANCH_PROFILES = {
    "Demo - Main Branch": {"traffic": 1.0, "avg_ticket": 1.0},
    "Demo - Downtown": {"traffic": 1.2, "avg_ticket": 1.1},  # Busy office area
    "Demo - Mall Outlet": {"traffic": 1.5, "avg_ticket": 0.9},  # High traffic, lower tickets
    "Demo - Airport": {"traffic": 0.7, "avg_ticket": 1.3},  # Premium pricing
    "Demo - University": {"traffic": 1.3, "avg_ticket": 0.7},  # Students, budget items
}

# Menu items with overlapping names (these also exist in real tenants)
# Format: (name, category, base_price, popularity_weight)
MENU_ITEMS = [
    # FOOD - Overlapping names
    ("Fried Rice", "Rice Bowls", 180, 1.5),
    ("Chicken Adobo", "Rice Bowls", 220, 1.3),
    ("Pork Sisig", "Rice Bowls", 240, 1.2),
    ("Beef Tapa", "All Day Brunch", 260, 1.0),
    ("Pancit Canton", "Pasta", 160, 0.9),
    ("Carbonara", "Pasta", 280, 1.1),
    ("Caesar Salad", "Salads", 220, 0.8),
    ("Club Sandwich", "Sandwiches", 240, 1.0),
    ("Chicken Wings", "Appetizers", 280, 1.4),
    ("French Fries", "Sides", 120, 1.6),
    ("Garlic Rice", "Sides", 60, 1.2),
    ("Soup of the Day", "Soups", 140, 0.7),
    ("Grilled Porkchop", "Mains", 320, 0.9),
    ("Fish and Chips", "Mains", 340, 0.8),
    ("Spaghetti Bolognese", "Pasta", 260, 1.0),

    # FOOD - Unique to Demo Restaurant
    ("Demo Burger Deluxe", "Sandwiches", 320, 1.3),
    ("Truffle Fries", "Sides", 180, 0.9),
    ("Wagyu Beef Bowl", "Rice Bowls", 450, 0.6),
    ("Grilled Salmon", "Mains", 420, 0.7),
    ("Breakfast Platter", "All Day Brunch", 350, 1.1),
    ("Nachos Supreme", "Appetizers", 260, 1.0),
    ("Thai Mango Salad", "Salads", 240, 0.7),
    ("Tom Yum Soup", "Soups", 180, 0.8),

    # BEVERAGES - Overlapping
    ("Iced Coffee", "Espresso Bar", 120, 2.0),
    ("Hot Latte", "Espresso Bar", 140, 1.5),
    ("Cappuccino", "Espresso Bar", 150, 1.3),
    ("Americano", "Espresso Bar", 110, 1.4),
    ("Iced Tea", "Cold Drinks", 80, 1.8),
    ("Fresh Orange Juice", "Juices", 120, 1.0),
    ("Mango Shake", "Smoothies", 140, 1.2),
    ("Hot Chocolate", "Hot Drinks", 130, 0.7),

    # BEVERAGES - Unique
    ("Demo Signature Frappe", "Coffee Creations", 180, 1.1),
    ("Matcha Latte", "Non Coffee", 160, 0.9),
    ("Strawberry Smoothie", "Smoothies", 150, 0.8),
    ("Lemon Mint Cooler", "Cold Drinks", 100, 0.9),

    # SWEETS - Overlapping
    ("Cheesecake", "Desserts", 180, 1.0),
    ("Chocolate Cake", "Desserts", 160, 1.1),
    ("Brownie", "Pastries", 120, 1.2),
    ("Croissant", "Pastries", 100, 1.0),
    ("Muffin", "Pastries", 90, 0.9),

    # SWEETS - Unique
    ("Demo Leche Flan", "Desserts", 140, 0.8),
    ("Banana Split", "Desserts", 200, 0.6),
    ("Cinnamon Roll", "Pastries", 130, 0.7),
]

# Daypart definitions (hour ranges and traffic multipliers)
DAYPARTS = {
    "breakfast": {"hours": (6, 10), "multiplier": 0.8, "food_bias": ["All Day Brunch", "Pastries", "Espresso Bar"]},
    "lunch": {"hours": (11, 14), "multiplier": 1.5, "food_bias": ["Rice Bowls", "Pasta", "Sandwiches", "Salads"]},
    "afternoon": {"hours": (14, 17), "multiplier": 0.6, "food_bias": ["Espresso Bar", "Coffee Creations", "Pastries", "Desserts"]},
    "dinner": {"hours": (17, 21), "multiplier": 1.2, "food_bias": ["Mains", "Rice Bowls", "Appetizers", "Pasta"]},
    "late": {"hours": (21, 23), "multiplier": 0.4, "food_bias": ["Appetizers", "Cold Drinks", "Desserts"]},
}

# Day of week multipliers (Mon=0, Sun=6)
DOW_MULTIPLIERS = [0.9, 0.95, 1.0, 1.05, 1.2, 1.4, 1.3]

# Month seasonality (1-12)
MONTH_SEASONALITY = {
    1: 0.85,   # January - post-holiday slump
    2: 0.9,    # February
    3: 1.0,    # March
    4: 1.05,   # April - summer starts
    5: 1.1,    # May - peak summer
    6: 0.95,   # June - rainy season
    7: 0.9,    # July
    8: 0.95,   # August
    9: 1.0,    # September
    10: 1.05,  # October
    11: 1.1,   # November
    12: 1.25,  # December - holiday peak
}


# ============================================
# HELPER FUNCTIONS
# ============================================

def get_daypart(hour: int) -> str:
    """Get daypart name for a given hour."""
    for name, config in DAYPARTS.items():
        start, end = config["hours"]
        if start <= hour < end:
            return name
    return "late"


def generate_receipt_number(branch_prefix: str, date: datetime, seq: int) -> str:
    """Generate a unique receipt number."""
    branch_code = branch_prefix[:3].upper()
    date_code = date.strftime("%Y%m%d")
    return f"{branch_code}-{date_code}-{seq:05d}"


def select_items_for_receipt(
    daypart: str,
    branch: str,
    rng: random.Random
) -> List[Tuple[str, str, float, int]]:
    """
    Select items for a receipt based on daypart and branch.
    Returns list of (item_name, category, price, quantity).
    """
    # Get daypart bias
    daypart_config = DAYPARTS.get(daypart, DAYPARTS["lunch"])
    biased_categories = daypart_config.get("food_bias", [])

    # Determine number of items (1-5, weighted towards 2-3)
    num_items = rng.choices([1, 2, 3, 4, 5], weights=[0.2, 0.35, 0.3, 0.1, 0.05])[0]

    # Weight items by popularity and category bias
    weighted_items = []
    for name, category, price, popularity in MENU_ITEMS:
        weight = popularity
        if category in biased_categories:
            weight *= 1.5
        weighted_items.append((name, category, price, weight))

    # Select items
    selected = []
    for _ in range(num_items):
        names, categories, prices, weights = zip(*weighted_items)
        idx = rng.choices(range(len(weighted_items)), weights=weights)[0]
        name, category, price = names[idx], categories[idx], prices[idx]

        # Apply branch pricing
        branch_profile = BRANCH_PROFILES.get(branch, {"avg_ticket": 1.0})
        adjusted_price = price * branch_profile["avg_ticket"]
        # Add some price variance (+/- 10%)
        adjusted_price *= rng.uniform(0.9, 1.1)
        adjusted_price = round(adjusted_price, 0)

        # Quantity (usually 1, sometimes 2-3 for drinks/sides)
        if category in ["Cold Drinks", "Espresso Bar", "Sides"]:
            quantity = rng.choices([1, 2, 3], weights=[0.6, 0.3, 0.1])[0]
        else:
            quantity = rng.choices([1, 2], weights=[0.9, 0.1])[0]

        selected.append((name, category, adjusted_price, quantity))

    return selected


def generate_day_transactions(
    date: datetime,
    branch: str,
    rng: random.Random
) -> List[Dict]:
    """Generate all transactions for a single day at a single branch."""
    transactions = []

    # Get multipliers
    dow_mult = DOW_MULTIPLIERS[date.weekday()]
    month_mult = MONTH_SEASONALITY.get(date.month, 1.0)
    branch_profile = BRANCH_PROFILES.get(branch, {"traffic": 1.0})

    # Base receipts per day (60-100)
    base_receipts = 80
    daily_receipts = int(base_receipts * dow_mult * month_mult * branch_profile["traffic"])
    # Add some randomness
    daily_receipts = max(20, int(daily_receipts * rng.uniform(0.8, 1.2)))

    # Distribute receipts across dayparts
    receipt_seq = 0
    for daypart_name, daypart_config in DAYPARTS.items():
        start_hour, end_hour = daypart_config["hours"]
        daypart_mult = daypart_config["multiplier"]

        # Receipts for this daypart
        daypart_receipts = int(daily_receipts * daypart_mult / sum(d["multiplier"] for d in DAYPARTS.values()))

        for _ in range(daypart_receipts):
            receipt_seq += 1
            receipt_num = generate_receipt_number(branch, date, receipt_seq)

            # Random time within daypart
            hour = rng.randint(start_hour, end_hour - 1)
            minute = rng.randint(0, 59)
            timestamp = date.replace(hour=hour, minute=minute, second=rng.randint(0, 59))

            # Select items
            items = select_items_for_receipt(daypart_name, branch, rng)

            # Calculate receipt totals for service charge allocation
            receipt_subtotal = sum(price * qty for _, _, price, qty in items)

            # Service charge (10% of subtotal)
            service_charge = round(receipt_subtotal * 0.10, 2)

            # Add item rows
            for item_name, category, price, quantity in items:
                subtotal = price * quantity
                tax = round(subtotal * 0.12, 2)  # 12% VAT
                discount = 0
                # Occasional discounts (5% of orders)
                if rng.random() < 0.05:
                    discount = -round(subtotal * rng.choice([0.1, 0.15, 0.2]), 2)

                transactions.append({
                    "Receipt Number": receipt_num,
                    "Time": timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                    "Store": branch,
                    "Item": item_name,
                    "Category": category,
                    "Quantity": quantity,
                    "Price": price,
                    "SubTotal": subtotal,
                    "Discount": discount,
                    "Tax": tax,
                    "Service Charge": 0,  # Will be on separate row
                })

            # Add service charge row
            transactions.append({
                "Receipt Number": receipt_num,
                "Time": timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                "Store": branch,
                "Item": "Service Charge",
                "Category": "",
                "Quantity": 1,
                "Price": service_charge,
                "SubTotal": service_charge,
                "Discount": 0,
                "Tax": 0,
                "Service Charge": service_charge,
            })

    return transactions


def generate_all_data(months: int, seed: int) -> List[Dict]:
    """Generate all transaction data."""
    rng = random.Random(seed)

    # Calculate date range
    end_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    start_date = end_date - timedelta(days=months * 30)

    print(f"Generating data from {start_date.date()} to {end_date.date()}")
    print(f"Branches: {len(BRANCHES)}")
    print(f"Menu items: {len(MENU_ITEMS)}")

    all_transactions = []
    current_date = start_date

    day_count = 0
    while current_date <= end_date:
        for branch in BRANCHES:
            day_transactions = generate_day_transactions(current_date, branch, rng)
            all_transactions.extend(day_transactions)

        day_count += 1
        if day_count % 30 == 0:
            print(f"  Generated {day_count} days ({len(all_transactions)} transactions)...")

        current_date += timedelta(days=1)

    print(f"Total transactions: {len(all_transactions)}")
    return all_transactions


# ============================================
# MAIN
# ============================================

def main():
    parser = argparse.ArgumentParser(
        description="Generate demo data for Demo Restaurant"
    )
    parser.add_argument(
        "--output",
        default="demo_data.csv",
        help="Output CSV file path (default: demo_data.csv)"
    )
    parser.add_argument(
        "--months",
        type=int,
        default=18,
        help="Number of months of data (default: 18)"
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for reproducibility (default: 42)"
    )

    args = parser.parse_args()

    print("=" * 60)
    print("Demo Restaurant Data Generator")
    print("=" * 60)
    print()

    # Generate data
    transactions = generate_all_data(args.months, args.seed)

    # Write CSV
    print(f"\nWriting to {args.output}...")
    fieldnames = [
        "Receipt Number", "Time", "Store", "Item", "Category",
        "Quantity", "Price", "SubTotal", "Discount", "Tax", "Service Charge"
    ]

    with open(args.output, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(transactions)

    print(f"Done! Generated {len(transactions)} rows")
    print()
    print("Next steps:")
    print(f"  1. Import the data:")
    print(f"     python scripts/import_storehub.py --tenant-id a1b2c3d4-e5f6-7890-abcd-ef1234567890 --file {args.output}")
    print()


if __name__ == "__main__":
    main()
