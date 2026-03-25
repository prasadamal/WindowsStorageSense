"""Pydantic schemas for Folder endpoints."""

from datetime import datetime

from pydantic import BaseModel, Field


class FolderCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = Field(None, max_length=500)
    color: str | None = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")
    parent_id: int | None = None


class FolderUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    color: str | None = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")
    cover_image_url: str | None = None
    parent_id: int | None = None


class FolderOut(BaseModel):
    id: int
    owner_id: int
    parent_id: int | None
    name: str
    slug: str
    description: str | None
    cover_image_url: str | None
    color: str | None
    is_smart: bool
    note_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FolderTree(FolderOut):
    children: list["FolderTree"] = []
