"""
Restaurant Analytics API - Main Application
"""
import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# Load environment variables before other imports
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from datetime import datetime
from routes.auth import router as auth_router
from routes.tenant import router as tenant_router
from routes.data import router as data_router
from routes.analytics import router as analytics_router
from routes.alerts import router as alerts_router
from routes.reports import router as reports_router
from routes.operator import router as operator_router
from routes.auto_fetch import router as auto_fetch_router
from routes.exclusions import router as exclusions_router
from middleware.auth_context import AuthContextMiddleware
from middleware.metrics import MetricsMiddleware
from middleware.rate_limit import limiter
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
    skip_startup_tasks = os.getenv("SKIP_STARTUP_TASKS", "false").lower() == "true"
    if skip_startup_tasks:
        print("Startup: Skipping startup tasks (SKIP_STARTUP_TASKS=true)", flush=True)
    else:
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

# Add rate limiter to app state
app.state.limiter = limiter

# Custom rate limit exceeded handler with JSON response
@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={
            "error": "rate_limit_exceeded",
            "message": "Too many requests. Please slow down.",
            "detail": str(exc.detail),
            "retry_after": getattr(exc, "retry_after", 60),
        },
        headers={"Retry-After": str(getattr(exc, "retry_after", 60))},
    )

# Global exception handler for unhandled errors
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Log the error (MetricsMiddleware will catch this too)
    print(f"Unhandled error: {type(exc).__name__}: {exc}", flush=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_server_error",
            "message": "An unexpected error occurred. Please try again later.",
        },
    )

# Get frontend URL from environment or default to localhost
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
DEBUG = os.getenv("DEBUG", "false").lower() == "true"

# Build allowed origins - only include localhost in debug mode
ALLOWED_ORIGINS = [FRONTEND_URL]
if DEBUG:
    ALLOWED_ORIGINS.append("http://localhost:5173")

# Middleware order matters! Last added = runs first (outermost)
# Order from outer to inner: GZip -> CORS -> Metrics -> Rate Limit -> Routes

# GZip compression for responses > 1000 bytes
app.add_middleware(GZipMiddleware, minimum_size=1000)

# MetricsMiddleware - only sees non-OPTIONS requests
app.add_middleware(MetricsMiddleware)

# CORSMiddleware - handles OPTIONS preflight immediately
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# AuthContextMiddleware - sets request.state.user/tenant_id when possible
app.add_middleware(AuthContextMiddleware)


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
app.include_router(auto_fetch_router)
app.include_router(exclusions_router)
