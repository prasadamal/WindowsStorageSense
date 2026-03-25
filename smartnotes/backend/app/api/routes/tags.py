"""
Tags CRUD routes.

GET    /tags          — all tags for current user.
POST   /tags          — create a tag manually.
DELETE /tags/{id}     — delete a tag.
GET    /tags/{id}/notes — notes that have this tag.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import Pagination, get_current_user
from app.db.session import get_db
from app.models.note import Note
from app.models.tag import NoteTag, Tag
from app.models.user import User
from app.schemas.note import NoteList
from app.schemas.tag import TagCreate, TagOut

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("", response_model=list[TagOut])
async def list_tags(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Tag).where(Tag.owner_id == current_user.id).order_by(Tag.name)
    )
    return result.scalars().all()


@router.post("", response_model=TagOut, status_code=status.HTTP_201_CREATED)
async def create_tag(
    payload: TagCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = await db.execute(
        select(Tag).where(Tag.owner_id == current_user.id, Tag.name == payload.name)
    )
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail="Tag already exists")

    tag = Tag(
        owner_id=current_user.id,
        name=payload.name,
        category=payload.category,
        color=payload.color,
    )
    db.add(tag)
    await db.flush()
    await db.refresh(tag)
    return tag


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(
    tag_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Tag).where(Tag.id == tag_id, Tag.owner_id == current_user.id)
    )
    tag = result.scalars().first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    await db.delete(tag)


@router.get("/{tag_id}/notes", response_model=NoteList)
async def list_tag_notes(
    tag_id: int,
    pagination: Pagination = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tag_result = await db.execute(
        select(Tag).where(Tag.id == tag_id, Tag.owner_id == current_user.id)
    )
    if not tag_result.scalars().first():
        raise HTTPException(status_code=404, detail="Tag not found")

    from sqlalchemy import func

    count_result = await db.execute(
        select(func.count())
        .select_from(NoteTag)
        .where(NoteTag.tag_id == tag_id)
    )
    total = count_result.scalar_one()

    note_ids_result = await db.execute(
        select(NoteTag.note_id)
        .where(NoteTag.tag_id == tag_id)
        .offset(pagination.offset)
        .limit(pagination.page_size)
    )
    note_ids = [r[0] for r in note_ids_result.all()]

    notes_result = await db.execute(
        select(Note)
        .where(Note.id.in_(note_ids), Note.owner_id == current_user.id)
        .options(selectinload(Note.tags))
        .order_by(Note.created_at.desc())
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
