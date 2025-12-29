# System Architecture

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                        │
│                      React + Vite + TypeScript                               │
│                                                                              │
│  State: Zustand (auth, UI) + React Query (server data)                      │
│  Hosted: Vercel                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS / JSON
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND                                         │
│                         FastAPI + Python                                     │
│                                                                              │
│  Routes: auth | tenant | analytics | reports | operator                      │
│  Modules: menu_engineering | dayparting | market_basket | costs | anomaly   │
│  Hosted: Railway                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Supabase Client
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SUPABASE                                        │
│                                                                              │
│  PostgreSQL + RLS  │  Auth (users)  │  Storage (CSVs)                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Multi-Tenant Design

### Single App, Isolated Data

All tenants use the same codebase. Data isolation via:
1. **Row-Level Security (RLS)** - Postgres policies filter by `tenant_id`
2. **Middleware** - Every request extracts tenant from JWT
3. **Storage Buckets** - Each tenant has isolated folder

### User Roles

| Role | Access |
|------|--------|
| `operator` | All tenants, Control Hub, admin functions |
| `owner` | Single tenant, full dashboard access |
| `viewer` | Single tenant, read-only |

---

## Frontend Structure

```
frontend/src/
├── components/          # Shared UI components
│   ├── ui/              # shadcn/ui components
│   ├── charts/          # Chart wrappers
│   └── layout/          # Shell, Sidebar, Header
├── modules/             # Feature modules
│   ├── auth/
│   ├── dashboard/
│   └── operator/
├── hooks/
├── stores/              # Zustand stores
├── lib/                 # Utilities, API client
└── types/
```

---

## Backend Structure

```
backend/
├── main.py              # FastAPI app
├── routes/
│   ├── auth.py
│   ├── tenant.py
│   ├── analytics.py
│   ├── reports.py
│   └── operator.py
├── modules/
│   ├── menu_engineering.py
│   ├── dayparting.py
│   ├── market_basket.py
│   └── costs.py
├── middleware/
│   ├── auth.py
│   └── logging.py
└── db/
    └── supabase.py
```

---

## Database Schema (Core Tables)

```sql
tenants (id, name, slug, settings, created_at)
users (id, tenant_id, role, email, created_at)
transactions (id, tenant_id, receipt_number, timestamp, branch, item_name, category, quantity, gross_revenue, ...)
menu_items (id, tenant_id, item_name, category, total_quantity, total_revenue, quadrant, ...)
alerts (id, tenant_id, type, message, severity, created_at, dismissed_at)
```

---

## External Services

| Service | Purpose |
|---------|---------|
| Supabase | Database, Auth, Storage |
| Vercel | Frontend hosting |
| Railway | Backend hosting |
| Resend | Email (reports) |
| Claude API | AI insights |

---

*Last updated: 2024-12-30*
