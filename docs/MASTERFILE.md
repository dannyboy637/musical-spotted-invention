# Restaurant Analytics Platform - Master Documentation

> **Project:** Multi-tenant restaurant analytics SaaS
> **Owner:** Dan (Operator/Developer/Consultant)
> **Client Zero:** Spotted Pig Manila

---

## Quick Links

| Document | Purpose |
|----------|---------|
| [CURRENT_CONTEXT.md](CURRENT_CONTEXT.md) | **READ FIRST** - Current state, active work |
| [SESSION_LOG.md](SESSION_LOG.md) | Append-only session history |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design, how pieces connect |
| [ROADMAP.md](ROADMAP.md) | Phase summaries + progress tracking |
| [LEGACY_CODE.md](LEGACY_CODE.md) | Existing MVP code to port (not rewrite) |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Colors, typography, components |
| [API_SPEC.md](API_SPEC.md) | Endpoint definitions |

### Phase Specs
| Phase | Status | Spec |
|-------|--------|------|
| 0 - Scaffold | 🟡 In Progress | [specs/PHASE_0_SCAFFOLD.md](specs/PHASE_0_SCAFFOLD.md) |
| 1 - Auth | ⬜ Not Started | [specs/PHASE_1_AUTH.md](specs/PHASE_1_AUTH.md) |
| 2 - Tenant | ⬜ Not Started | [specs/PHASE_2_TENANT.md](specs/PHASE_2_TENANT.md) |
| 3 - Data | ⬜ Not Started | [specs/PHASE_3_DATA.md](specs/PHASE_3_DATA.md) |
| 4 - Layout | ⬜ Not Started | [specs/PHASE_4_LAYOUT.md](specs/PHASE_4_LAYOUT.md) |
| 5 - API | ⬜ Not Started | [specs/PHASE_5_API.md](specs/PHASE_5_API.md) |
| 6 - Charts | ⬜ Not Started | [specs/PHASE_6_CHARTS.md](specs/PHASE_6_CHARTS.md) |
| 7 - Modules | ⬜ Not Started | [specs/PHASE_7_MODULES.md](specs/PHASE_7_MODULES.md) |
| 8 - Alerts | ⬜ Not Started | [specs/PHASE_8_ALERTS.md](specs/PHASE_8_ALERTS.md) |
| 9 - Reports | ⬜ Not Started | [specs/PHASE_9_REPORTS.md](specs/PHASE_9_REPORTS.md) |
| 10 - Operator | ⬜ Not Started | [specs/PHASE_10_OPERATOR.md](specs/PHASE_10_OPERATOR.md) |
| 11 - Polish | ⬜ Not Started | [specs/PHASE_11_POLISH.md](specs/PHASE_11_POLISH.md) |
| 12 - Validation | ⬜ Not Started | [specs/PHASE_12_VALIDATION.md](specs/PHASE_12_VALIDATION.md) |

---

## Business Context

### What We're Building
A consulting-first analytics platform where Dan:
1. Receives CSV exports from restaurant clients (StoreHub POS)
2. Uploads/cleans data via internal tools
3. Configures dashboards per client
4. Clients access polished analytics with username/password

### Two Interfaces
1. **Client Dashboard** - What restaurants see (clean, simple, data-focused)
2. **Operator Control Hub** - What Dan sees (all clients, debugging, AI tools)

### Tech Stack
- **Frontend:** React + Vite + TypeScript + TailwindCSS + shadcn/ui
- **Backend:** FastAPI + Python
- **Database:** Supabase (PostgreSQL + Auth + Storage)
- **Hosting:** Vercel (frontend) + Railway (backend) + Supabase (managed)

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Monorepo | Yes | Simpler at this scale |
| Database | Supabase | Auth + Storage + Postgres in one |
| State management | Zustand | Simpler than Redux |
| Data fetching | React Query | Caching, loading states built-in |
| UI components | shadcn/ui | Copy-paste, customizable |
| Charts | Recharts | React-native, good defaults |
| Design | Navy + Gold | Professional, not "AI-generated" look |

---

*Last updated: 2024-12-30*
