# Phase 2: Tenant System

> **Goal:** Multi-tenant data model with proper isolation.
> **Branch:** `main`

---

## Roles (Updated from Phase 1)

| Role | Description | Access |
|------|-------------|--------|
| `operator` | Platform super-admin | All tenants, full system access |
| `owner` | Restaurant client | Single tenant, full dashboard |
| `viewer` | Staff accounts | Single tenant, read-only |

**Note:** Phase 1 roles (`admin`, `manager`, `viewer`) replaced with (`operator`, `owner`, `viewer`).

---

## Deliverables

### Database
- [x] `tenants` table
- [x] `users.tenant_id` foreign key
- [x] RLS policies for tenant isolation
- [x] Operator role can access all tenants
- [x] Role enum updated: operator/owner/viewer

### Backend
- [x] Tenant context middleware (`get_user_with_tenant`, `require_operator`)
- [x] `backend/routes/tenant.py` - CRUD (operator only)
- [x] `/auth/me` returns tenant info

### Frontend
- [x] Tenant store (`tenantStore.ts`)
- [x] Tenant switcher (operator only)
- [x] Auth store updated with tenant types

---

## Schema

```sql
-- Tenants table
CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  settings jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Updated roles enum
CREATE TYPE user_role AS ENUM ('operator', 'owner', 'viewer');

-- Users table additions
ALTER TABLE users ADD COLUMN tenant_id uuid REFERENCES tenants(id);
```

---

## API Endpoints

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | `/tenants` | All | List tenants (operator: all, others: own) |
| GET | `/tenants/{id}` | All | Get tenant details |
| POST | `/tenants` | Operator | Create tenant |
| PUT | `/tenants/{id}` | Operator | Update tenant |
| DELETE | `/tenants/{id}` | Operator | Delete tenant |

---

## Acceptance Criteria

- [x] Tenants table exists with RLS
- [x] Users have tenant_id FK
- [x] Role enum updated: operator/owner/viewer
- [x] RLS prevents cross-tenant data access
- [x] Operator can CRUD all tenants
- [x] Owner/viewer only see their tenant
- [x] `/auth/me` returns tenant info
- [x] Frontend tenant switcher works for operators

---

## Migration File

Run `backend/migrations/002_create_tenants_table.sql` in Supabase SQL Editor.

---

*Phase 2 COMPLETE*
