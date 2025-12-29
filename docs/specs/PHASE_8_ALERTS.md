# Phase 8: Alerts & Anomaly Detection

> **Goal:** System surfaces unusual patterns automatically.
> **Branch:** `feature/phase-8-alerts`

---

## Deliverables

### Database
- [ ] `alerts` table

### Backend
- [ ] `backend/modules/anomaly.py` - Detection logic
- [ ] `backend/routes/alerts.py` - Alert endpoints
- [ ] Scheduled job for daily scan

### Frontend
- [ ] Alert banner component
- [ ] Alert list page
- [ ] Dismissal functionality

---

## Alert Types

| Type | Trigger |
|------|---------|
| revenue_drop | Revenue down >20% vs same period |
| item_spike | Item sales up >50% suddenly |
| item_crash | Item sales down >50% suddenly |
| new_star | Item moved to Star quadrant |
| new_dog | Item moved to Dog quadrant |

---

## Schema

```sql
CREATE TABLE alerts (
  id uuid PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id),
  type text NOT NULL,
  severity text DEFAULT 'info', -- info, warning, critical
  title text NOT NULL,
  message text,
  data jsonb,
  created_at timestamptz DEFAULT now(),
  dismissed_at timestamptz,
  dismissed_by uuid REFERENCES users(id)
);
```

---

## Acceptance Criteria

- [ ] Anomaly detection runs on schedule
- [ ] Alerts created for detected anomalies
- [ ] Alert banner shows on dashboard
- [ ] Alerts can be dismissed
- [ ] Alert history viewable

---

*Phase 8 complete when all acceptance criteria checked.*
