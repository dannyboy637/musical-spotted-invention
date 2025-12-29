# Restaurant Analytics Platform

Multi-tenant analytics dashboard for restaurant businesses.

## Quick Start

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Documentation

See `docs/` folder for:
- `MASTERFILE.md` - Project overview
- `CURRENT_CONTEXT.md` - Current development status
- `specs/` - Phase specifications

## Tech Stack

- **Frontend:** React + TypeScript + Vite + Tailwind
- **Backend:** FastAPI + Python
- **Database:** Supabase (PostgreSQL)
- **Hosting:** Vercel (frontend) + Railway (backend)
