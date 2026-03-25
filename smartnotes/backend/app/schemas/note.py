"""Pydantic schemas for Note endpoints."""

from datetime import datetime

from pydantic import BaseModel, Field, HttpUrl

from app.schemas.tag import TagOut


class NoteCreate(BaseModel):
    url: str | None = Field(None, max_length=2000)
    title: str | None = Field(None, max_length=500)
    body: str | None = None
    tag_ids: list[int] = []
    folder_ids: list[int] = []


class NoteUpdate(BaseModel):
    title: str | None = Field(None, max_length=500)
    body: str | None = None
    is_visited: bool | None = None
    visit_rating: int | None = Field(None, ge=1, le=5)
    visit_note: str | None = None
    tag_ids: list[int] | None = None
    folder_ids: list[int] | None = None


class NoteOut(BaseModel):
    id: int
    owner_id: int
    url: str | None
    title: str | None
    body: str | None
    description: str | None
    thumbnail_url: str | None
    source_platform: str | None
    is_visited: bool
    visit_rating: int | None
    visit_note: str | None
    tags: list[TagOut]
    folder_ids: list[int]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class NoteList(BaseModel):
    items: list[NoteOut]
    total: int
    page: int
    page_size: int
    has_next: bool
