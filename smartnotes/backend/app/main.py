"""
SmartNotes FastAPI Application.

Run locally:
    uvicorn app.main:app --reload --port 8000

Production:
    gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth, folders, notes, search, tags
from app.core.config import get_settings
from app.db.base import Base  # noqa: F401 — registers all models
from app.db.session import engine

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup (use Alembic migrations in production)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "SmartNotes backend API — save links from any platform, "
        "auto-tag and auto-organise into smart folders."
    ),
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/api/v1")
app.include_router(notes.router, prefix="/api/v1")
app.include_router(folders.router, prefix="/api/v1")
app.include_router(tags.router, prefix="/api/v1")
app.include_router(search.router, prefix="/api/v1")


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok", "version": settings.APP_VERSION}
