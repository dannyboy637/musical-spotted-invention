# API Specification

## Base URL
- Development: `http://localhost:8000`
- Production: `https://api.yourapp.com`

## Authentication
All endpoints (except `/health` and `/auth/*`) require JWT in header:
```
Authorization: Bearer <token>
```

---

## Endpoints

### Health
```
GET /health
Response: { "status": "healthy" }
```

### Auth
```
POST /auth/login
Body: { "email": "...", "password": "..." }
Response: { "access_token": "...", "user": {...} }

POST /auth/logout
Response: { "success": true }

POST /auth/forgot-password
Body: { "email": "..." }
Response: { "success": true }
```

### Tenants (Operator Only)
```
GET /tenants
Response: [{ "id": "...", "name": "...", "slug": "..." }, ...]

POST /tenants
Body: { "name": "...", "slug": "..." }
Response: { "id": "...", ... }

GET /tenants/:id
PUT /tenants/:id
DELETE /tenants/:id
```

### Analytics
All analytics endpoints accept query params:
- `start_date` (YYYY-MM-DD)
- `end_date` (YYYY-MM-DD)
- `branches` (comma-separated)
- `categories` (comma-separated)

```
GET /api/analytics/overview
Response: {
  "revenue": 2400000,
  "transactions": 3500,
  "avg_check": 685,
  "items_sold": 12000,
  "period_comparison": {
    "revenue_change": 12.5,
    "transactions_change": 8.2
  }
}

GET /api/analytics/menu-engineering
Response: {
  "items": [
    {
      "name": "Tapa",
      "category": "Rice Bowls",
      "quantity": 3278,
      "revenue": 1440768,
      "quadrant": "Star"
    },
    ...
  ],
  "summary": {
    "stars": 45,
    "plowhorses": 12,
    "puzzles": 8,
    "dogs": 35
  }
}

GET /api/analytics/dayparting
Response: {
  "heatmap": [...],
  "peak_hours": [...],
  "daypart_summary": [...]
}

GET /api/analytics/performance
GET /api/analytics/categories
GET /api/analytics/bundles
```

### Alerts
```
GET /api/alerts
Response: [{ "id": "...", "type": "...", "message": "...", ... }]

POST /api/alerts/:id/dismiss
Response: { "success": true }
```

### Reports (Operator)
```
GET /api/reports/pending
POST /api/reports/:id/approve
POST /api/reports/:id/send
```

### Operator
```
GET /api/operator/overview
GET /api/operator/system-health
GET /api/operator/error-logs
GET /api/operator/api-metrics
GET /api/operator/data-pipeline

POST /api/operator/sync/:tenant_id
POST /api/operator/query
Body: { "tenant_id": "...", "question": "..." }
Response: { "answer": "...", "data": {...} }
```

---

## Error Responses

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token"
  }
}
```

Common codes:
- `UNAUTHORIZED` - 401
- `FORBIDDEN` - 403
- `NOT_FOUND` - 404
- `VALIDATION_ERROR` - 422
- `INTERNAL_ERROR` - 500

---

*Last updated: 2024-12-30*
