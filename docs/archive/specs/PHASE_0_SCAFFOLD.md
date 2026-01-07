# Phase 0: Project Scaffold

> **Goal:** Working dev environment with frontend talking to backend.
> **Branch:** `main`
> **Status:** 🟡 In Progress

---

## Deliverables

### Backend (FastAPI)
- [x] `backend/main.py` - FastAPI app with CORS and health endpoint
- [x] `backend/requirements.txt` - Dependencies
- [x] `backend/.env.example` - Environment template
- [x] `backend/.gitignore`
- [x] Virtual environment working

### Frontend (React + Vite + TypeScript)
- [x] Vite scaffold with React + TypeScript
- [x] TailwindCSS configured
- [x] React Query installed
- [x] Zustand installed
- [x] Path aliases (@/) configured
- [x] `.env.example`
- [ ] Build test (`npm run build`)
- [ ] Dev server test (`npm run dev`)

### Root
- [x] `.gitignore` - Combined Python/Node
- [x] `README.md` - Quick start

---

## Acceptance Criteria

- [ ] `npm run build` completes without errors
- [ ] `npm run dev` starts on localhost:5173
- [ ] Frontend fetches /health from backend
- [ ] Initial commit pushed to main

---

*Phase 0 complete when all acceptance criteria checked.*
