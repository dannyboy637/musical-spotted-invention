# API Reference

Restaurant Analytics API documentation. Base URL: `https://api.yourapp.com` (or `http://localhost:8000` for development).

## Authentication

All API requests (except `/health`) require a valid JWT token in the Authorization header.

```bash
Authorization: Bearer <your-jwt-token>
```

Tokens are obtained by logging in through Supabase Auth. The token contains:
- `sub`: User ID
- `email`: User email
- `role`: User role (operator, owner, viewer)
- `tenant_id`: Associated tenant ID (if applicable)

### Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "error_code",
  "message": "Human-readable error message",
  "detail": "Additional details (optional)"
}
```

Common HTTP status codes:
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

---

## Health Check

### GET /health

Check API health status.

```bash
curl https://api.yourapp.com/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-06T12:00:00.000Z",
  "version": "0.1.0"
}
```

---

## Authentication

### GET /auth/me

Get current user profile.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://api.yourapp.com/auth/me
```

Response:
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "full_name": "John Doe",
  "role": "owner",
  "tenant_id": "uuid",
  "tenant": {
    "id": "uuid",
    "name": "Joe's Diner",
    "slug": "joes-diner"
  }
}
```

---

## Analytics

All analytics endpoints accept these query parameters:
- `start_date` (string, YYYY-MM-DD): Start of date range
- `end_date` (string, YYYY-MM-DD): End of date range
- `branches` (string, comma-separated): Filter by branch names
- `categories` (string, comma-separated): Filter by categories

### GET /api/analytics/overview

Get KPI summary for dashboard.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.yourapp.com/api/analytics/overview?start_date=2026-01-01&end_date=2026-01-31"
```

Response:
```json
{
  "total_revenue": 1250000,
  "total_transactions": 4523,
  "avg_ticket": 27650,
  "unique_items": 85,
  "period_growth": 12.5
}
```

### GET /api/analytics/menu-engineering

Get menu engineering quadrant analysis.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.yourapp.com/api/analytics/menu-engineering"
```

Response:
```json
{
  "items": [
    {
      "item_name": "Burger Deluxe",
      "category": "Mains",
      "total_quantity": 523,
      "total_revenue": 156900,
      "avg_price": 30000,
      "quadrant": "Star",
      "profit_margin": 0.45
    }
  ],
  "quadrant_counts": {
    "Star": 12,
    "Plowhorse": 8,
    "Puzzle": 15,
    "Dog": 10
  }
}
```

### GET /api/analytics/dayparting

Get sales breakdown by daypart.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.yourapp.com/api/analytics/dayparting"
```

Response:
```json
{
  "dayparts": [
    {
      "daypart": "Breakfast",
      "start_hour": 6,
      "end_hour": 11,
      "revenue": 250000,
      "transactions": 890,
      "percentage": 20
    },
    {
      "daypart": "Lunch",
      "start_hour": 11,
      "end_hour": 15,
      "revenue": 450000,
      "transactions": 1523,
      "percentage": 36
    }
  ]
}
```

### GET /api/analytics/hourly-heatmap

Get hourly sales heatmap data.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.yourapp.com/api/analytics/hourly-heatmap"
```

Response:
```json
{
  "heatmap": [
    {"day": 0, "hour": 8, "revenue": 15000, "transactions": 12},
    {"day": 0, "hour": 9, "revenue": 25000, "transactions": 23}
  ]
}
```

### GET /api/analytics/day-of-week

Get day-of-week analysis.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.yourapp.com/api/analytics/day-of-week"
```

Response:
```json
{
  "days": [
    {"day": "Monday", "day_index": 0, "revenue": 180000, "transactions": 650},
    {"day": "Tuesday", "day_index": 1, "revenue": 165000, "transactions": 590}
  ]
}
```

### GET /api/analytics/year-over-year

Get year-over-year comparison.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.yourapp.com/api/analytics/year-over-year"
```

Response:
```json
{
  "current_year": {
    "year": 2026,
    "revenue": 15000000,
    "transactions": 52000
  },
  "previous_year": {
    "year": 2025,
    "revenue": 13500000,
    "transactions": 48000
  },
  "growth": {
    "revenue_percent": 11.1,
    "transactions_percent": 8.3
  }
}
```

### GET /api/analytics/performance/trends

Get detailed time series trends.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.yourapp.com/api/analytics/performance/trends?granularity=daily"
```

Query parameters:
- `granularity`: `daily`, `weekly`, or `monthly`

Response:
```json
{
  "daily": [
    {"date": "2026-01-01", "revenue": 45000, "transactions": 156},
    {"date": "2026-01-02", "revenue": 52000, "transactions": 178}
  ],
  "best_day": {"date": "2026-01-15", "revenue": 78000},
  "worst_day": {"date": "2026-01-03", "revenue": 32000}
}
```

### GET /api/analytics/bundles

Get frequently purchased item pairs.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.yourapp.com/api/analytics/bundles?min_frequency=10"
```

Response:
```json
{
  "bundles": [
    {
      "item_a": "Burger",
      "item_b": "Fries",
      "frequency": 245,
      "combined_revenue": 735000
    }
  ]
}
```

### GET /api/analytics/categories

Get category breakdown.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.yourapp.com/api/analytics/categories"
```

Response:
```json
{
  "categories": [
    {"category": "Mains", "revenue": 650000, "quantity": 2100, "item_count": 15},
    {"category": "Beverages", "revenue": 180000, "quantity": 3500, "item_count": 25}
  ]
}
```

---

## Alerts

### GET /api/alerts

List alerts for current tenant.

Query parameters:
- `status`: `active`, `dismissed`, or `all`
- `type`: `revenue_drop`, `item_spike`, `item_crash`, `quadrant_change`
- `limit`: Number of results (default 50)

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.yourapp.com/api/alerts?status=active&limit=10"
```

Response:
```json
{
  "alerts": [
    {
      "id": "uuid",
      "type": "revenue_drop",
      "severity": "warning",
      "message": "Revenue dropped 15% compared to last week",
      "data": {"current": 450000, "previous": 530000, "change_percent": -15.1},
      "created_at": "2026-01-06T08:00:00Z",
      "dismissed": false
    }
  ],
  "total": 5
}
```

### POST /api/alerts/{id}/dismiss

Dismiss an alert (owner/operator only).

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  "https://api.yourapp.com/api/alerts/abc123/dismiss"
```

### POST /api/alerts/scan

Trigger anomaly scan (operator only).

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  "https://api.yourapp.com/api/alerts/scan"
```

### GET /api/alerts/settings

Get alert settings for current tenant.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.yourapp.com/api/alerts/settings"
```

### PUT /api/alerts/settings

Update alert settings (owner/operator only).

```bash
curl -X PUT -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"revenue_threshold": 10, "item_threshold": 30, "quadrant_enabled": true}' \
  "https://api.yourapp.com/api/alerts/settings"
```

---

## Reports

### POST /api/reports/generate

Generate a report for a tenant.

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": "uuid", "period_type": "week"}' \
  "https://api.yourapp.com/api/reports/generate"
```

Parameters:
- `tenant_id`: Tenant UUID
- `period_type`: `week`, `month`, `quarter`, or `year`

### GET /api/reports

List reports.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.yourapp.com/api/reports?status=pending"
```

### GET /api/reports/{id}

Get single report.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.yourapp.com/api/reports/abc123"
```

### POST /api/reports/{id}/approve

Approve a report for sending.

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  "https://api.yourapp.com/api/reports/abc123/approve"
```

### POST /api/reports/{id}/send

Send approved report via email.

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email_override": "optional@email.com"}' \
  "https://api.yourapp.com/api/reports/abc123/send"
```

---

## Data Management

### POST /data/upload

Upload transaction data (CSV).

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -F "file=@transactions.csv" \
  "https://api.yourapp.com/data/upload"
```

### GET /data/transactions

List transactions with pagination.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.yourapp.com/data/transactions?page=1&limit=100"
```

### GET /data/menu-items

List menu items.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.yourapp.com/data/menu-items"
```

### GET /data/import-jobs

List import job history.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.yourapp.com/data/import-jobs"
```

---

## Tenants (Operator Only)

### GET /tenants

List all tenants.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.yourapp.com/tenants"
```

### POST /tenants

Create new tenant.

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "New Restaurant", "slug": "new-restaurant"}' \
  "https://api.yourapp.com/tenants"
```

### PUT /tenants/{id}

Update tenant.

```bash
curl -X PUT -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Name"}' \
  "https://api.yourapp.com/tenants/abc123"
```

---

## Rate Limiting

The API enforces rate limits to ensure fair usage:

- **Standard endpoints**: 100 requests per minute
- **Heavy operations**: 20 requests per minute (reports, imports)
- **Authentication**: 10 requests per minute

When rate limited, you'll receive a `429` response:

```json
{
  "error": "rate_limit_exceeded",
  "message": "Too many requests. Please slow down.",
  "retry_after": 60
}
```

The `Retry-After` header indicates when you can retry.

---

## OpenAPI Documentation

Interactive API documentation is available at:
- **Swagger UI**: `https://api.yourapp.com/docs`
- **ReDoc**: `https://api.yourapp.com/redoc`
