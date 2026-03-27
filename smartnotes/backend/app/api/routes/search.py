"""
Full-text search route.

GET /search?q=bangalore food&page=1&page_size=20

Searches note titles, bodies, descriptions, and tag names.
Uses SQLite FTS via LIKE for portability; in production swap for
PostgreSQL full-text search or pgvector semantic search.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import Pagination, get_current_user
from app.db.session import get_db
from app.models.note import Note
from app.models.tag import NoteTag, Tag
from app.models.user import User
from app.schemas.note import NoteList

router = APIRouter(prefix="/search", tags=["search"])


@router.get("", response_model=NoteList)
async def search_notes(
    q: str = Query(..., min_length=1, max_length=200),
    pagination: Pagination = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pattern = f"%{q.strip()}%"

    # Notes matching by text fields
    text_match = select(Note.id).where(
        Note.owner_id == current_user.id,
        or_(
            Note.title.ilike(pattern),
            Note.body.ilike(pattern),
            Note.description.ilike(pattern),
            Note.url.ilike(pattern),
        ),
    )

    # Notes matching by tag name
    tag_match = (
        select(NoteTag.note_id)
        .join(Tag, Tag.id == NoteTag.tag_id)
        .where(
            Tag.owner_id == current_user.id,
            Tag.name.ilike(pattern),
        )
    )

    # Union of both
    from sqlalchemy import union

    combined = union(text_match, tag_match).subquery()

    from sqlalchemy import func

    count_result = await db.execute(
        select(func.count()).select_from(combined)
    )
    total = count_result.scalar_one()

    notes_result = await db.execute(
        select(Note)
        .where(Note.id.in_(select(combined)))
        .options(selectinload(Note.tags))
        .order_by(Note.created_at.desc())
        .offset(pagination.offset)
        .limit(pagination.page_size)
    )
    notes = notes_result.scalars().all()

    from app.api.routes.notes import _enrich_note_out
    items = [await _enrich_note_out(n, db) for n in notes]

    return NoteList(
        items=items,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
        has_next=(pagination.offset + pagination.page_size) < total,
    )
