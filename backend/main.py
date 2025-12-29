"""
Restaurant Analytics API - Main Application
"""
import os
from dotenv import load_dotenv

# Load environment variables before other imports
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from routes.auth import router as auth_router

app = FastAPI(
    title="Restaurant Analytics API",
    description="Multi-tenant analytics platform for restaurants",
    version="0.1.0",
)

# Get frontend URL from environment or default to localhost
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# CORS middleware - will be configured properly in Phase 1
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
