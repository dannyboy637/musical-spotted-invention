# Current Context

> **Last updated:** 2024-12-30
> **Read this file at the start of every Claude Code session.**

---

## Active Phase: Phase 2 - Dashboard (Not Started)

**Branch:** `main` (Phase 1 merged)
**Spec:** `docs/specs/PHASE_2_DASHBOARD.md` (to be created)
**Status:** Not started

---

## Completed Phases

### Phase 0: Scaffold - COMPLETE
- Backend: FastAPI with health endpoint, CORS configured
- Frontend: Vite + React + TypeScript + Tailwind CSS v4
- Dependencies: @tanstack/react-query, zustand, axios
- Build and dev server tested and working
- Frontend fetches from backend /health endpoint

### Phase 1: Authentication - COMPLETE
- Supabase project configured
- Database: `users` table with roles (admin, manager, viewer), RLS policies, auto-create trigger
- Backend: JWT validation middleware, `/auth/me` endpoint
- Frontend: Zustand auth store, LoginPage, ForgotPasswordPage, ProtectedRoute, PublicRoute
- Session persistence working
- Loading spinners for better UX

---

## Environment

- Backend: `http://localhost:8000`
- Frontend: `http://localhost:5173`
- Supabase: Project configured (credentials in `.env` files)

---

## Quick Start Commands

```bash
# Backend
cd backend
source venv/bin/activate
uvicorn main:app --reload

# Frontend
cd frontend
npm run dev
```

---

## Project Structure

```
backend/
├── main.py              # FastAPI app entry
├── db/supabase.py       # Supabase client
├── middleware/auth.py   # JWT validation
├── routes/auth.py       # Auth endpoints
└── migrations/          # SQL migrations

frontend/src/
├── lib/supabase.ts              # Supabase client
├── stores/authStore.ts          # Auth state (Zustand)
├── modules/auth/                # Login, ForgotPassword pages
├── modules/dashboard/           # Dashboard page
└── components/layout/           # ProtectedRoute, PublicRoute
```

---

## Session Instructions

**At end of session, always:**
1. Update this file with current state
2. Append summary to `SESSION_LOG.md`
3. Commit work to appropriate branch

**Command to remind Claude Code:**
```
End of session. Update CURRENT_CONTEXT.md and append to SESSION_LOG.md
```
