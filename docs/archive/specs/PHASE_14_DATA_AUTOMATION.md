# Phase 14: Data Automation (StoreHub Sync)

> **Goal:** Automate daily CSV exports from StoreHub POS to eliminate manual data uploads.
> **Branch:** `main`
> **Status:** COMPLETE

---

## Overview

StoreHub POS has no public API, requiring restaurant clients to manually export CSV files and upload them to the platform. This phase implements automated daily data sync by reverse-engineering StoreHub's internal HTTP API.

### Key Discovery

Through browser network inspection, we discovered StoreHub uses a simple HTTP-based export:

```
POST /login              → Returns session cookie (connect.sid)
GET  /transactions/csv   → Returns CSV file directly
```

**No browser automation needed** - pure HTTP requests with `httpx`.

---

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  cron-job.org   │────▶│  Railway API    │────▶│    StoreHub     │
│  (2am daily)    │     │  /auto-fetch    │     │  HTTP API       │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │   Supabase DB   │
                        │  (transactions) │
                        └─────────────────┘
```

### Flow

1. **cron-job.org** triggers `POST /auto-fetch/trigger?token=xxx` daily at 2am
2. **Railway backend** receives request, validates token
3. **StoreHubClient** logs into StoreHub via HTTP, downloads yesterday's CSV
4. **ImportService** processes CSV, inserts transactions (skips duplicates)
5. **Summary tables** auto-refresh for fast dashboard queries

---

## Deliverables

### Backend

- [x] `backend/scripts/auto_fetch_storehub.py` - Standalone CLI script
  - StoreHubClient class for HTTP-based login/export
  - Supports date override via `FETCH_DATE` env var
  - Dry-run mode for testing
- [x] `backend/routes/auto_fetch.py` - API endpoint for cron triggers
  - `POST /auto-fetch/trigger` - Token-protected, runs in background
  - `GET /auto-fetch/health` - Configuration check
- [x] `backend/migrations/038_fix_transaction_unique_constraint.sql`
  - Fixed duplicate detection (removed `source_row_number` from constraint)
  - Cleaned up existing duplicate transactions

### Database

- [x] Unique constraint fix: `(tenant_id, receipt_number, item_name, receipt_timestamp)`
- [x] Removed old constraint that included `source_row_number`

### External

- [x] cron-job.org configured for daily execution
- [x] Railway environment variables set

---

## StoreHub API Details

### Login Endpoint

```
POST https://{tenant}.storehubhq.com/login
Content-Type: application/json

{"username": "email@example.com", "password": "xxx"}

Response: Sets connect.sid cookie (14-day expiry)
```

### Export Endpoint

```
GET https://{tenant}.storehubhq.com/transactions/csv
  ?from=01%2F07%2F2026       # MM/DD/YYYY, URL-encoded
  &to=01%2F07%2F2026
  &storeId=allStores
  &includeItems=true
  &includePayments=true

Headers:
  Cookie: connect.sid=xxx

Response: CSV file (text/csv)
```

### Rate Limits

- 500 requests/minute (very generous)
- No anti-bot detection observed

---

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `STOREHUB_SUBDOMAIN` | Tenant subdomain | `spottedpigcafe-legazpi` |
| `STOREHUB_USERNAME` | Login email | `user@example.com` |
| `STOREHUB_PASSWORD` | Login password | `xxx` |
| `TARGET_TENANT_ID` | Our platform's tenant UUID | `1545b96f-...` |
| `AUTO_FETCH_SECRET` | Token for API endpoint | `xotc4mDU...` |

---

## Cron Configuration

**Service:** cron-job.org (free tier)

| Setting | Value |
|---------|-------|
| URL | `https://xxx.up.railway.app/auto-fetch/trigger?token=xxx` |
| Method | POST |
| Schedule | `0 2 * * *` (2:00 AM daily) |
| Timezone | Asia/Manila |
| Timeout | 30 seconds (runs in background) |

---

## Duplicate Prevention

### Problem

Original unique constraint included `source_row_number`:
```sql
UNIQUE (tenant_id, receipt_number, item_name, source_row_number)
```

This allowed duplicates because re-importing the same transaction from a different CSV would have a different row number.

### Solution

New constraint uses timestamp instead:
```sql
UNIQUE (tenant_id, receipt_number, item_name, receipt_timestamp)
```

Migration 038 also cleaned up existing duplicates (kept oldest by ID).

---

## Acceptance Criteria

- [x] Script can login to StoreHub via HTTP
- [x] Script can download CSV for any date
- [x] Duplicate transactions are skipped (not duplicated)
- [x] API endpoint is protected by secret token
- [x] Cron job triggers daily at 2am Manila time
- [x] Empty days (restaurant closed) handled gracefully
- [x] Import failures don't crash the endpoint (background execution)

---

## Future Enhancements

When scaling to multiple tenants:

1. **Database credential storage** - `tenant_storehub_credentials` table with encrypted passwords
2. **Per-tenant configuration** - Different subdomain/store per tenant
3. **Separate Railway service** - Dedicated cron worker instead of API endpoint
4. **Monitoring dashboard** - Track success/failure rates per tenant
5. **Retry logic** - Automatic retry on transient failures

---

## Files Created

| File | Description |
|------|-------------|
| `backend/scripts/auto_fetch_storehub.py` | CLI script with StoreHubClient |
| `backend/routes/auto_fetch.py` | API endpoint for cron triggers |
| `backend/migrations/038_fix_transaction_unique_constraint.sql` | Duplicate fix |

## Files Modified

| File | Change |
|------|--------|
| `backend/main.py` | Added auto_fetch router |
| `backend/services/import_service.py` | Updated on_conflict columns |
| `backend/.env` | Added StoreHub credentials |

---

*Phase 14 COMPLETE - All acceptance criteria checked.*
