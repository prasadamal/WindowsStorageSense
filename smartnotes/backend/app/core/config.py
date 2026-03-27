"""
Application configuration loaded from environment variables.

Copy .env.example → .env and fill in the values before running.
"""

from functools import lru_cache
from typing import List

from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

    # ── App ──────────────────────────────────────────────────────────────────
    APP_NAME: str = "SmartNotes"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # ── Database ─────────────────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite+aiosqlite:///./smartnotes.db"

    # ── Security ─────────────────────────────────────────────────────────────
    SECRET_KEY: str = "change-me-in-production-use-a-long-random-string"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7   # 7 days
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 30  # 30 days
    ALGORITHM: str = "HS256"

    # ── CORS ─────────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "exp://localhost:8081"]

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_origins(cls, v: str | List[str]) -> List[str]:
        if isinstance(v, str):
            return [o.strip() for o in v.split(",")]
        return v

    # ── AI / NLP ─────────────────────────────────────────────────────────────
    OPENAI_API_KEY: str = ""          # Optional — enables GPT-based tag extraction
    OPENAI_MODEL: str = "gpt-4o-mini"

    # ── Metadata extraction ───────────────────────────────────────────────────
    REQUEST_TIMEOUT_SECONDS: int = 10
    MAX_CONTENT_LENGTH: int = 2 * 1024 * 1024  # 2 MB cap when scraping pages

    # ── Pagination ────────────────────────────────────────────────────────────
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100


@lru_cache
def get_settings() -> Settings:
    return Settings()
