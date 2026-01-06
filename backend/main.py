"""
Restaurant Analytics API - Main Application
"""
import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# Load environment variables before other imports
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from routes.auth import router as auth_router
from routes.tenant import router as tenant_router
from routes.data import router as data_router
from routes.analytics import router as analytics_router
from routes.alerts import router as alerts_router
from routes.reports import router as reports_router
from routes.operator import router as operator_router
from middleware.metrics import MetricsMiddleware
from db.supabase import supabase


def cleanup_stale_import_jobs(timeout_hours: int = 1):
    """Clean up any import jobs stuck in processing state."""
    try:
        result = supabase.rpc("cleanup_stale_import_jobs", {
            "p_timeout_hours": timeout_hours,
        }).execute()
        data = result.data if result.data else {"jobs_cleaned": 0}
        jobs_cleaned = data.get("jobs_cleaned", 0)
        if jobs_cleaned > 0:
            print(f"Startup: Cleaned up {jobs_cleaned} stale import job(s)", flush=True)
    except Exception as e:
        # Don't fail startup if cleanup fails (function might not exist yet)
        print(f"Startup: Stale job cleanup skipped ({e})", flush=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup: Clean up any stale import jobs from previous crashes
    print("Starting up...", flush=True)
    cleanup_stale_import_jobs()
    yield
    # Shutdown
    print("Shutting down...", flush=True)


app = FastAPI(
    title="Restaurant Analytics API",
    description="Multi-tenant analytics platform for restaurants",
    version="0.1.0",
    lifespan=lifespan,
)

# Get frontend URL from environment or default to localhost
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# Middleware order matters! Last added = runs first (outermost)
# 1. MetricsMiddleware (inner) - only sees non-OPTIONS requests
# 2. CORSMiddleware (outer) - handles OPTIONS preflight immediately
app.add_middleware(MetricsMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        FRONTEND_URL,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "0.1.0",
    }


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Restaurant Analytics API",
        "docs": "/docs",
        "health": "/health",
    }


# Include routers
app.include_router(auth_router)
app.include_router(tenant_router)
app.include_router(data_router)
app.include_router(analytics_router)
app.include_router(alerts_router)
app.include_router(reports_router)
app.include_router(operator_router)
