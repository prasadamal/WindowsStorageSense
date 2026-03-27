"""Pydantic schemas for Tag endpoints."""

from datetime import datetime

from pydantic import BaseModel, Field


class TagCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    category: str | None = None
    color: str | None = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")


class TagOut(BaseModel):
    id: int
    name: str
    category: str | None
    color: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
