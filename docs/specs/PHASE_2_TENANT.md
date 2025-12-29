# Phase 2: Tenant System

> **Goal:** Multi-tenant data model with proper isolation.
> **Branch:** `feature/phase-2-tenant`

---

## Deliverables

### Database
- [ ] `tenants` table
- [ ] `users.tenant_id` foreign key
- [ ] RLS policies for tenant isolation
- [ ] Operator role can access all tenants

### Backend
- [ ] Tenant context middleware
- [ ] `backend/routes/tenant.py` - CRUD (operator only)

### Frontend
- [ ] Tenant context provider
- [ ] Tenant switcher (operator only)

---

## Schema

```sql
CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  settings jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE users ADD COLUMN tenant_id uuid REFERENCES tenants(id);
ALTER TABLE users ADD COLUMN role text DEFAULT 'viewer';
```

---

## Acceptance Criteria

- [ ] Tenants table exists with sample data
- [ ] Users associated with tenants
- [ ] RLS prevents cross-tenant data access
- [ ] Operator can view all tenants
- [ ] API endpoints require tenant context

---

*Phase 2 complete when all acceptance criteria checked.*
