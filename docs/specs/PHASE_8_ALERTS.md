# Phase 8: Alerts & Anomaly Detection

> **Goal:** System surfaces unusual patterns automatically.
> **Branch:** `feature/phase-8-alerts`

---

## Deliverables

### Database
- [x] `alerts` table
- [x] `alert_settings` table (per-tenant thresholds)

### Backend
- [x] `backend/modules/anomaly.py` - Detection logic
- [x] `backend/routes/alerts.py` - Alert endpoints
- [x] Auto-scan after data import (replaces cron job)
- [x] Manual scan trigger endpoint

### Frontend
- [x] Alert banner component (dashboard only)
- [x] Alert list page (`/alerts`)
- [x] Dismissal functionality (owner only)
- [x] Alert settings in Settings modal

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

- [x] Anomaly detection runs on schedule (after data import + manual trigger)
- [x] Alerts created for detected anomalies
- [x] Alert banner shows on dashboard
- [x] Alerts can be dismissed (owner only)
- [x] Alert history viewable
- [x] Per-tenant configurable thresholds
- [x] 7-day cooldown prevents duplicate alerts

---

*Phase 8 COMPLETE - All acceptance criteria checked.*
