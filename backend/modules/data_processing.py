"""
Data processing module - ports legacy business logic.
Reference: docs/LEGACY_CODE.md
"""
from typing import List, Dict, Optional
import pandas as pd

# ============================================
# CONSTANTS (from legacy clean_data.py)
# ============================================

# These 17 categories are excluded from core menu analysis
EXCLUDE_CATEGORIES: List[str] = [
    'Spirits',
    'MIXERS',
    'Extras',
    'Pour Over Bar',
    'Retail Beans',
    'Merchandise',
    'Breakage/Corkage',
    'Online- Food',
    'Online- Drinks',
    'Water',
    'Wine',
    'Wine: Glass',
    'Beers',
    'Cocktails',
    'Events',
    'Foodpanda/Grab',
    'Party Tray',
]

# Maps StoreHub categories to 6 macro categories
MACRO_CATEGORY_MAP: Dict[str, str] = {
    # FOOD
    'All Day Brunch': 'FOOD',
    'Rice Bowls': 'FOOD',
    'Pasta': 'FOOD',
    'Sandwiches': 'FOOD',
    'Salads': 'FOOD',
    'Appetizers': 'FOOD',
    'Mains': 'FOOD',
    'Sides': 'FOOD',
    'Soups': 'FOOD',
    'Starters': 'FOOD',
    'Entrees': 'FOOD',
    'Snacks': 'FOOD',
    'Breakfast': 'FOOD',
    'Lunch': 'FOOD',
    'Dinner': 'FOOD',

    # BEVERAGE (non-alcoholic)
    'Espresso Bar': 'BEVERAGE',
    'Coffee Creations': 'BEVERAGE',
    'Non Coffee': 'BEVERAGE',
    'Tea': 'BEVERAGE',
    'Juices': 'BEVERAGE',
    'Smoothies': 'BEVERAGE',
    'Cold Drinks': 'BEVERAGE',
    'Hot Drinks': 'BEVERAGE',
    'Soft Drinks': 'BEVERAGE',

    # ALCOHOL
    'Cocktails': 'ALCOHOL',
    'Wine': 'ALCOHOL',
    'Wine: Glass': 'ALCOHOL',
    'Beers': 'ALCOHOL',
    'Spirits': 'ALCOHOL',

    # SWEETS
    'Sweets': 'SWEETS',
    'Pastries': 'SWEETS',
    'Desserts': 'SWEETS',
    'Cakes': 'SWEETS',

    # RETAIL
    'Retail Beans': 'RETAIL',
    'Merchandise': 'RETAIL',

    # OTHER (fallback and explicitly mapped)
    'Extras': 'OTHER',
    'MIXERS': 'OTHER',
    'Events': 'OTHER',
    'Foodpanda/Grab': 'OTHER',
    'Party Tray': 'OTHER',
    'Breakage/Corkage': 'OTHER',
    'Online- Food': 'OTHER',
    'Online- Drinks': 'OTHER',
    'Water': 'OTHER',
    'Pour Over Bar': 'OTHER',
}

# Core menu classification thresholds
MIN_MONTHS_ACTIVE: int = 6
RECENCY_DAYS: int = 30


# ============================================
# CATEGORY FUNCTIONS
# ============================================

def is_excluded_category(category: Optional[str]) -> bool:
    """Check if category should be excluded from core menu analysis."""
    if not category:
        return False
    return category in EXCLUDE_CATEGORIES


def get_macro_category(category: Optional[str]) -> str:
    """Map StoreHub category to macro category."""
    if not category:
        return 'OTHER'
    return MACRO_CATEGORY_MAP.get(category, 'OTHER')


# ============================================
# SERVICE CHARGE ALLOCATION
# ============================================

def allocate_service_charge(
    item_subtotal: float,
    receipt_subtotal: float,
    receipt_service_charge: float
) -> float:
    """
    Allocate service charge proportionally to each item.

    StoreHub records service charge as a separate line item.
    We distribute it across actual menu items based on their
    proportion of the receipt subtotal.
    """
    if receipt_subtotal <= 0:
        return 0.0

    proportion = item_subtotal / receipt_subtotal
    return round(proportion * receipt_service_charge, 2)


# ============================================
# RECEIPT PARSING
# ============================================

def parse_storehub_csv(df: pd.DataFrame) -> pd.DataFrame:
    """
    Parse StoreHub CSV format.

    StoreHub CSVs have multi-row structure per receipt:
    - Row 1: Summary row (blank Item, shows totals)
    - Row 2: Service Charge line
    - Rows 3+: Actual menu items
    - Final row: Payment method breakdown

    Returns DataFrame with only valid item rows.
    """
    # Get the item column name (handle different casings)
    item_col = None
    for col in ['Item', 'item', 'ITEM']:
        if col in df.columns:
            item_col = col
            break

    if item_col is None:
        raise ValueError("CSV must contain 'Item' column")

    # Filter to actual item rows
    items_df = df[
        df[item_col].notna() &
        (df[item_col] != '') &
        (df[item_col].astype(str).str.strip() != '') &
        (df[item_col] != 'Service Charge') &
        (~df[item_col].astype(str).str.contains('Payment:', case=False, na=False))
    ].copy()

    return items_df


def extract_service_charge_by_receipt(df: pd.DataFrame) -> Dict[str, float]:
    """
    Extract service charge amounts by receipt number.

    The service charge VALUE is in the 'Service Charge' COLUMN of rows
    where Item == 'Service Charge'.

    Returns dict mapping receipt_number -> service_charge_amount
    """
    # Get column names (handle different casings)
    item_col = next((c for c in ['Item', 'item', 'ITEM'] if c in df.columns), None)
    receipt_col = next((c for c in ['Receipt Number', 'receipt_number', 'Receipt_Number'] if c in df.columns), None)
    sc_col = next((c for c in ['Service Charge', 'service_charge', 'SERVICE CHARGE'] if c in df.columns), None)

    if not all([item_col, receipt_col, sc_col]):
        return {}

    # Filter to Service Charge rows
    sc_rows = df[df[item_col] == 'Service Charge'].copy()

    # Convert Service Charge column to numeric
    sc_rows[sc_col] = pd.to_numeric(sc_rows[sc_col], errors='coerce').fillna(0)

    # Group by receipt and sum (in case multiple SC rows per receipt)
    service_charges = {}
    for receipt_num, group in sc_rows.groupby(receipt_col):
        if pd.notna(receipt_num):
            service_charges[str(receipt_num)] = group[sc_col].sum()

    return service_charges


def calculate_receipt_subtotals(df: pd.DataFrame) -> Dict[str, float]:
    """
    Calculate total subtotal per receipt (excluding service charge).

    Returns dict mapping receipt_number -> total_subtotal
    """
    items_df = parse_storehub_csv(df)

    # Get column names
    receipt_col = next((c for c in ['Receipt Number', 'receipt_number', 'Receipt_Number'] if c in items_df.columns), None)
    subtotal_col = next((c for c in ['SubTotal', 'Subtotal', 'subtotal', 'SUBTOTAL'] if c in items_df.columns), None)

    if not all([receipt_col, subtotal_col]):
        return {}

    subtotals = {}
    for receipt_num, group in items_df.groupby(receipt_col):
        if pd.notna(receipt_num):
            subtotals[str(receipt_num)] = group[subtotal_col].sum()

    return subtotals


# ============================================
# DATA TRANSFORMATION
# ============================================

def get_column_value(row: pd.Series, *column_names) -> any:
    """Get value from row, trying multiple possible column names."""
    for col in column_names:
        if col in row.index:
            val = row[col]
            # Handle pandas NA values
            if pd.isna(val):
                return None
            return val
    return None


def transform_storehub_row(
    row: pd.Series,
    service_charges: Dict[str, float],
    receipt_subtotals: Dict[str, float]
) -> Dict:
    """
    Transform a StoreHub CSV row into transaction format.

    Handles:
    - Column name normalization
    - Service charge allocation
    - Macro category mapping
    - Category exclusion flagging
    - Conversion to cents (integer)
    """
    # Helper to safely convert to float
    def safe_float(val, default=0.0):
        if val is None:
            return default
        try:
            f = float(val)
            # Check for NaN after conversion
            if pd.isna(f) or f != f:  # NaN != NaN is True
                return default
            return f
        except (ValueError, TypeError):
            return default

    # Helper to safely convert to int
    def safe_int(val, default=0):
        if val is None:
            return default
        try:
            f = float(val)
            # Check for NaN after conversion
            if pd.isna(f) or f != f:  # NaN != NaN is True
                return default
            return int(f)
        except (ValueError, TypeError):
            return default

    # Get receipt number
    receipt_num = str(get_column_value(row, 'Receipt Number', 'receipt_number', 'Receipt_Number') or '')

    # Get pricing values (handle SubTotal with capital T)
    item_subtotal = safe_float(get_column_value(row, 'SubTotal', 'Subtotal', 'subtotal', 'SUBTOTAL'), 0)
    receipt_subtotal = receipt_subtotals.get(receipt_num, item_subtotal)
    receipt_sc = service_charges.get(receipt_num, 0)

    # Get category
    category = get_column_value(row, 'Category', 'category', 'CATEGORY')

    # Calculate allocated service charge
    allocated_sc = allocate_service_charge(item_subtotal, receipt_subtotal, receipt_sc)

    # Get other values (keep discount as-is, it's negative in StoreHub)
    discount = safe_float(get_column_value(row, 'Discount', 'discount', 'DISCOUNT'), 0)
    tax = safe_float(get_column_value(row, 'Tax', 'tax', 'TAX'), 0)
    quantity = safe_int(get_column_value(row, 'Quantity', 'quantity', 'QUANTITY', 'Qty'), 1)
    if quantity < 1:
        quantity = 1

    # Calculate unit_price from subtotal/quantity (StoreHub doesn't have Price column)
    unit_price = safe_float(get_column_value(row, 'Price', 'price', 'PRICE', 'Unit Price'), 0)
    if unit_price == 0 and quantity > 0:
        unit_price = item_subtotal / quantity

    # Calculate gross revenue: subtotal + tax + allocated_sc + discount
    # Note: discount is negative in StoreHub, so adding it subtracts the discount
    gross_revenue = item_subtotal + tax + allocated_sc + discount

    # Get timestamp (handle Time column from StoreHub)
    timestamp = get_column_value(row, 'Time', 'Date', 'date', 'DATE', 'Timestamp', 'timestamp')

    # Convert timestamp to ISO string for JSON serialization
    # StoreHub exports timestamps in Manila local time (UTC+8)
    # We must tag naive datetimes with Manila TZ so Supabase stores correct UTC
    if timestamp is not None:
        if hasattr(timestamp, 'isoformat'):
            # If naive datetime (no timezone), assume Manila local time
            if hasattr(timestamp, 'tzinfo') and timestamp.tzinfo is None:
                from datetime import timezone, timedelta
                manila_tz = timezone(timedelta(hours=8))
                timestamp = timestamp.replace(tzinfo=manila_tz)
            timestamp = timestamp.isoformat()
        elif not isinstance(timestamp, str):
            timestamp = str(timestamp)

    return {
        'receipt_number': receipt_num,
        'receipt_timestamp': timestamp,
        'item_name': get_column_value(row, 'Item', 'item', 'ITEM'),
        'category': category,
        'quantity': quantity,
        'unit_price': safe_int(unit_price * 100, 0),
        'subtotal': safe_int(item_subtotal * 100, 0),
        'discount': safe_int(abs(discount) * 100, 0),  # Store as positive for display
        'tax': safe_int(tax * 100, 0),
        'allocated_service_charge': safe_int(allocated_sc * 100, 0),
        'gross_revenue': safe_int(gross_revenue * 100, 0),
        'macro_category': get_macro_category(category),
        'is_excluded': is_excluded_category(category),
        'store_name': get_column_value(row, 'Store', 'store', 'STORE'),
    }


# ============================================
# MENU ENGINEERING (for reference - used in SQL)
# ============================================

def assign_quadrant(
    total_quantity: int,
    avg_price: float,
    median_quantity: float,
    median_price: float
) -> str:
    """
    Assign BCG matrix quadrant to menu item.

    - Star: High popularity, High profit
    - Plowhorse: High popularity, Low profit
    - Puzzle: Low popularity, High profit
    - Dog: Low popularity, Low profit

    Note: Uses avg_price as profit proxy until cost data available.
    """
    high_popularity = total_quantity >= median_quantity
    high_profit = avg_price >= median_price

    if high_popularity and high_profit:
        return 'Star'
    elif high_popularity and not high_profit:
        return 'Plowhorse'
    elif not high_popularity and high_profit:
        return 'Puzzle'
    else:
        return 'Dog'
