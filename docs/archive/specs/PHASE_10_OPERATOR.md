# Phase 10: Operator Control Hub

> **Goal:** Your command center to monitor all clients + debug technical issues.
> **Branch:** `feature/phase-10-operator`

---

## Overview

Build the Operator Control Hub - your single pane of glass for:
- **Business Monitoring** - All clients' health at a glance
- **Technical Debugging** - Errors, performance, data pipeline status
- **Client Management** - Tenant CRUD, consultant notes
- **AI Tools** - Insight discovery, natural language queries

---

## Control Hub Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  🎛️  Operator Control Hub                              [Dan] [Settings] [?] │
├──────────────────────────────────────────────────────────────────────────────┤
│  [Clients]  [Technical]  [Tools]                                             │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Tab content here...                                                         │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Tab 1: Clients Overview

### Client Cards Grid
Display all tenants as cards showing:
- Tenant name + logo
- Health status indicator (green/yellow/red)
- Revenue this week + trend arrow
- Alert count badge
- Data freshness ("Updated 2h ago")
- Quick actions: View Dashboard, Add Note

### Aggregated Alerts Feed
- All alerts across all tenants in one feed
- Filter by severity (critical/warning/info)
- Filter by tenant
- Click to jump to relevant dashboard

### Task List
Your personal to-do list:
- Add tasks (general or tenant-specific)
- Set priority (high/medium/low)
- Mark complete
- Due date tracking

---

## Tab 2: Technical Monitoring

### System Health Overview
```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ API         │ Database    │ Auth        │ Frontend    │
│ ● Healthy   │ ● Healthy   │ ● Healthy   │ ● Healthy   │
│ 50ms avg    │ 5 conns     │             │ Vercel OK   │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

### API Performance
- Response time chart (last 24h)
- P50, P95, P99 latencies
- Requests per minute
- Error rate percentage

### Slowest Endpoints Table
| Endpoint | Avg (ms) | P95 (ms) | Calls |
|----------|----------|----------|-------|
| /analytics/menu-engineering | 450 | 890 | 234 |
| /analytics/overview | 320 | 650 | 567 |

### Error Log
- List of recent errors with stack traces
- Filter by tenant
- Filter by endpoint
- Filter by time range
- Expandable stack trace view

### Data Pipeline Status
Per-tenant view:
| Tenant | Last Sync | Status | Rows | Action |
|--------|-----------|--------|------|--------|
| Spotted Pig | 2h ago | ✓ | 5,000 | [Sync Now] |
| Restaurant B | 5d ago | ⚠️ | 2,300 | [Sync Now] |

### Database Stats
- Total rows per table
- Storage usage
- Connection pool status
- Slow query log

### User Activity
- Recent logins
- Failed login attempts
- Session durations

---

## Tab 3: Tools

### Tenant Manager
- List all tenants
- Create new tenant
- Edit tenant settings
- Deactivate tenant
- View tenant details

### Consultant Notes
Per-tenant notes panel:
- Add notes with timestamps
- Pin important notes
- Search notes
- Private (only you see these)

### Natural Language Query
For use during client calls:
- Text input: "What were Spotted Pig's top items last week?"
- AI generates answer from data
- Shows underlying query/data used

### Report Center
- View scheduled reports
- Preview before sending
- Manual send
- Report history

---

## Database Tables

### error_logs
```sql
CREATE TABLE error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    user_id UUID REFERENCES users(id),
    endpoint TEXT,
    method TEXT,
    status_code INTEGER,
    error_message TEXT,
    stack_trace TEXT,
    request_body TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### api_metrics
```sql
CREATE TABLE api_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    response_time_ms INTEGER NOT NULL,
    status_code INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_metrics_created ON api_metrics(created_at);
CREATE INDEX idx_api_metrics_endpoint ON api_metrics(endpoint);
```

### data_sync_jobs
> **Note:** This functionality already exists in the `data_import_jobs` table created in Phase 3.
> Use the existing table rather than creating a new one. Add any missing columns if needed.

```sql
-- Existing table: data_import_jobs (from Phase 3)
-- Already has: id, tenant_id, status, file_name, row_count, error_message, timestamps
-- May need to add: file_size_bytes, rows_processed, rows_inserted, rows_skipped
```

### operator_tasks
```sql
CREATE TABLE operator_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    tenant_id UUID REFERENCES tenants(id),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
    due_date DATE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### consultant_notes
```sql
CREATE TABLE consultant_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    content TEXT NOT NULL,
    is_pinned BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## API Endpoints

```
GET  /api/v1/operator/health           # System health status
GET  /api/v1/operator/errors           # Error logs
GET  /api/v1/operator/metrics          # API performance metrics
GET  /api/v1/operator/sync-status      # Data pipeline status
POST /api/v1/operator/sync/{tenant_id} # Trigger manual sync

GET  /api/v1/operator/tasks            # List tasks
POST /api/v1/operator/tasks            # Create task
PATCH /api/v1/operator/tasks/{id}      # Update task
DELETE /api/v1/operator/tasks/{id}     # Delete task

GET  /api/v1/operator/notes/{tenant_id}  # List notes for tenant
POST /api/v1/operator/notes/{tenant_id}  # Add note
PATCH /api/v1/operator/notes/{id}        # Update note
DELETE /api/v1/operator/notes/{id}       # Delete note

POST /api/v1/operator/insights/{tenant_id}  # Generate AI insights
POST /api/v1/operator/query                 # Natural language query
```

---

## Middleware for Metrics Collection

```python
# middleware/metrics.py
@app.middleware("http")
async def collect_metrics(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    response_time_ms = int((time.time() - start_time) * 1000)
    
    # Log to database asynchronously
    tenant_id = getattr(request.state, 'tenant_id', None)
    asyncio.create_task(log_metric(
        tenant_id=tenant_id,
        endpoint=request.url.path,
        method=request.method,
        response_time_ms=response_time_ms,
        status_code=response.status_code
    ))
    
    return response
```

---

## Frontend Structure

```
frontend/src/modules/operator/
├── index.tsx                    # Control Hub layout with tabs
├── components/
│   ├── ClientsTab/
│   │   ├── ClientCards.tsx
│   │   ├── AlertsFeed.tsx
│   │   └── TaskList.tsx
│   ├── TechnicalTab/
│   │   ├── SystemHealth.tsx
│   │   ├── ApiMetrics.tsx
│   │   ├── ErrorLog.tsx
│   │   ├── DataPipeline.tsx
│   │   ├── DatabaseStats.tsx
│   │   └── UserActivity.tsx
│   └── ToolsTab/
│       ├── TenantManager.tsx
│       ├── ConsultantNotes.tsx
│       ├── NaturalLanguageQuery.tsx
│       └── ReportCenter.tsx
└── hooks/
    ├── useOperatorOverview.ts
    ├── useSystemHealth.ts
    └── useErrorLogs.ts
```

---

## Acceptance Criteria

### Clients Tab
- [ ] Client cards show all tenants with health status
- [ ] Revenue + trend displayed per tenant
- [ ] Alert count visible
- [ ] Data freshness indicator
- [ ] Click to jump into tenant dashboard
- [ ] Aggregated alerts feed works
- [ ] Task list with add/complete functionality

### Technical Tab
- [ ] System health overview (API, DB, Auth, Frontend)
- [ ] API performance chart with response times
- [ ] Slowest endpoints table
- [ ] Error log with stack traces viewable
- [ ] Data pipeline status per tenant
- [ ] Manual sync trigger works
- [ ] Database stats displayed
- [ ] User activity log with failed logins

### Tools Tab
- [ ] Tenant manager: list, create, edit
- [ ] Consultant notes: add, view, pin per tenant
- [ ] Natural language query returns answers
- [ ] Report preview and send works

### General
- [ ] Only operators can access Control Hub
- [ ] Auto-refresh for real-time data (every 30s)
- [ ] Mobile responsive layout

---

*Phase 10 complete when all acceptance criteria are checked.*
