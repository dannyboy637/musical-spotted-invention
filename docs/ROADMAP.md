# Development Roadmap

## Phase Overview

| Phase | Name | Goal | Est. Time |
|-------|------|------|-----------|
| 0 | Scaffold | Project structure, dev environment | 1 day |
| 1 | Auth | Supabase auth, protected routes | 2 days |
| 2 | Tenant | Multi-tenant data model, RLS | 2 days |
| 3 | Data | Import pipeline, data processing | 3 days |
| 4 | Layout | App shell, navigation, filters | 2 days |
| 5 | API | Analytics endpoints | 3 days |
| 6 | Charts | Chart components, patterns | 2 days |
| 7 | Modules | All dashboard modules | 5 days |
| 8 | Alerts | Anomaly detection, notifications | 2 days |
| 9 | Reports | Scheduled email reports | 2 days |
| 10 | Operator | Control Hub, debugging tools | 3 days |
| 11 | Polish | Error handling, mobile, perf | 2 days |
| 12 | Validation | Second tenant test | 1 day |

**Total:** ~4 weeks

---

## Phase Details

### Phase 0: Scaffold ✅ COMPLETE
**Branch:** `main`

- [x] Backend: FastAPI with health endpoint
- [x] Frontend: Vite + React + TypeScript
- [x] Dependencies: TailwindCSS v4, React Query, Zustand
- [x] Test frontend build
- [x] Frontend-backend integration verified

---

### Phase 1: Auth
**Branch:** `feature/phase-1-auth`

- [ ] Supabase project setup
- [ ] Auth UI (login, forgot password)
- [ ] JWT handling in frontend
- [ ] Protected routes
- [ ] Auth middleware in backend

---

### Phase 2: Tenant
**Branch:** `feature/phase-2-tenant`

- [ ] Database schema (tenants, users)
- [ ] RLS policies
- [ ] Tenant context in requests
- [ ] User-tenant association

---

### Phase 3: Data
**Branch:** `feature/phase-3-data`

- [ ] CSV upload to Supabase Storage
- [ ] Import script (port from legacy)
- [ ] Data cleaning pipeline
- [ ] Transactions table
- [ ] Menu items aggregation

---

### Phase 4: Layout
**Branch:** `feature/phase-4-layout`

- [ ] App shell component
- [ ] Sidebar navigation
- [ ] Header with tenant switcher
- [ ] Global filters (date, branch)
- [ ] Mobile responsive

---

### Phase 5: API
**Branch:** `feature/phase-5-api`

- [ ] Analytics endpoints
- [ ] Menu engineering calculations
- [ ] Dayparting analysis
- [ ] Performance metrics
- [ ] Caching strategy

---

### Phase 6: Charts
**Branch:** `feature/phase-6-charts`

- [ ] Chart wrapper components
- [ ] Standard chart configs
- [ ] Loading/empty states
- [ ] Export functionality

---

### Phase 7: Modules
**Branch:** `feature/phase-7-modules`

Sub-phases:
- [ ] 7A: Executive Dashboard
- [ ] 7B: Menu Engineering
- [ ] 7C: Time Intelligence
- [ ] 7D: Performance Analytics
- [ ] 7E: Branch Comparison
- [ ] 7F: Category Deep Dive
- [ ] 7G: Recommendations
- [ ] 7H: Cost Management

---

### Phase 8: Alerts
**Branch:** `feature/phase-8-alerts`

- [ ] Anomaly detection logic
- [ ] Alerts table
- [ ] Alert banner UI
- [ ] Scheduled scan job
- [ ] Dismissal functionality

---

### Phase 9: Reports
**Branch:** `feature/phase-9-reports`

- [ ] Report generation
- [ ] Email service (Resend)
- [ ] AI narrative draft
- [ ] Preview UI
- [ ] Scheduled weekly job
- [ ] Approval flow

---

### Phase 10: Operator Control Hub
**Branch:** `feature/phase-10-operator`

**Tab 1: Clients Overview**
- [ ] Tenant health cards
- [ ] Aggregated alerts feed
- [ ] Task list

**Tab 2: Technical Monitoring**
- [ ] System health status
- [ ] API performance metrics
- [ ] Error log with stack traces
- [ ] Data pipeline status
- [ ] Database stats
- [ ] User activity log

**Tab 3: Tools**
- [ ] Tenant manager
- [ ] Consultant notes
- [ ] Natural language query
- [ ] Report center

---

### Phase 11: Polish
**Branch:** `feature/phase-11-polish`

- [ ] Error boundaries
- [ ] 404 page
- [ ] Loading skeletons
- [ ] Empty states
- [ ] Mobile audit
- [ ] Performance audit
- [ ] Security audit
- [ ] Rate limiting

---

### Phase 12: Validation
**Branch:** `feature/phase-12-validation`

- [ ] Create second tenant
- [ ] Migrate test data
- [ ] Configure dashboard
- [ ] Verify data isolation
- [ ] Document onboarding process

---

## Progress Log

### 2024-12-30 - Phase 0 Complete
- All scaffold tasks completed
- Frontend build tested successfully
- Frontend-backend integration verified
- Ready for Phase 1: Authentication

### 2024-12-29 - Phase 0 Started
- Backend scaffold complete
- Frontend scaffold complete

---

*Last updated: 2024-12-30*
