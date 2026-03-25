"""
Notes CRUD routes.

POST /notes        — create a note from a shared URL or free text.
                     Triggers async metadata extraction + tag extraction +
                     smart folder assignment.
GET  /notes        — paginated list of all notes for the current user.
GET  /notes/{id}   — single note detail.
PATCH /notes/{id}  — update title, body, tags, folders, visit status.
DELETE /notes/{id} — soft-delete (actually deletes from DB).
"""

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import Pagination, get_current_user
from app.db.session import get_db
from app.models.note import Note
from app.models.note_folder import NoteFolder
from app.models.tag import NoteTag, Tag
from app.models.user import User
from app.schemas.note import NoteCreate, NoteList, NoteOut, NoteUpdate
from app.services.folder_organizer import organize_note_into_folders
from app.services.metadata_extractor import extract_metadata
from app.services.tag_extractor import ExtractedTag, extract_tags

router = APIRouter(prefix="/notes", tags=["notes"])


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _enrich_note_out(note: Note, db: AsyncSession) -> NoteOut:
    """Build NoteOut, including folder_ids resolved from NoteFolder rows."""
    nf_result = await db.execute(
        select(NoteFolder.folder_id).where(NoteFolder.note_id == note.id)
    )
    folder_ids = [row[0] for row in nf_result.all()]
    data = NoteOut.model_validate(note)
    data.folder_ids = folder_ids
    return data


async def _get_or_create_tag(
    db: AsyncSession, owner_id: int, tag: ExtractedTag
) -> Tag:
    result = await db.execute(
        select(Tag).where(Tag.owner_id == owner_id, Tag.name == tag.name)
    )
    obj = result.scalars().first()
    if obj is None:
        obj = Tag(owner_id=owner_id, name=tag.name, category=tag.category)
        db.add(obj)
        await db.flush()
    return obj


async def _apply_tags(
    db: AsyncSession, note: Note, tag_ids: list[int], owner_id: int
) -> None:
    # Remove existing tags
    await db.execute(
        NoteTag.__table__.delete().where(NoteTag.note_id == note.id)
    )
    for tid in tag_ids:
        db.add(NoteTag(note_id=note.id, tag_id=tid, is_auto=False))


async def _apply_folders(
    db: AsyncSession, note: Note, folder_ids: list[int]
) -> None:
    await db.execute(
        NoteFolder.__table__.delete().where(NoteFolder.note_id == note.id)
    )
    for fid in folder_ids:
        db.add(NoteFolder(note_id=note.id, folder_id=fid))


# ── Background post-processing ─────────────────────────────────────────────────

async def _post_process_note(note_id: int, owner_id: int, url: str) -> None:
    """
    Run after the HTTP response is sent:
    1. Extract link metadata.
    2. Extract tags.
    3. Auto-assign smart folders.
    Runs in its own DB session so it doesn't block the request.
    """
    from app.db.session import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(select(Note).where(Note.id == note_id))
            note = result.scalars().first()
            if note is None:
                return

            # 1. Metadata
            meta = await extract_metadata(url)
            note.title = note.title or meta.title
            note.description = meta.description
            note.thumbnail_url = meta.thumbnail_url
            note.source_platform = meta.source_platform
            await db.flush()

            # 2. Tag extraction
            extracted = await extract_tags(note.title, note.description, note.body)
            tag_objs: list[Tag] = []
            for et in extracted:
                t = await _get_or_create_tag(db, owner_id, et)
                tag_objs.append(t)

            # Link tags (auto-generated)
            for t in tag_objs:
                exists = await db.execute(
                    select(NoteTag).where(
                        NoteTag.note_id == note_id, NoteTag.tag_id == t.id
                    )
                )
                if exists.scalars().first() is None:
                    db.add(NoteTag(note_id=note_id, tag_id=t.id, is_auto=True))

            # 3. Smart folder assignment
            await organize_note_into_folders(db, note_id, owner_id, extracted)

            await db.commit()
        except Exception:
            await db.rollback()


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
async def create_note(
    payload: NoteCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    note = Note(
        owner_id=current_user.id,
        url=payload.url,
        title=payload.title,
        body=payload.body,
    )
    db.add(note)
    await db.flush()

    # User-supplied tags / folders (override)
    if payload.tag_ids:
        await _apply_tags(db, note, payload.tag_ids, current_user.id)
    if payload.folder_ids:
        await _apply_folders(db, note, payload.folder_ids)

    await db.refresh(note, ["tags"])

    # Kick off background enrichment if a URL was provided
    if payload.url:
        background_tasks.add_task(
            _post_process_note, note.id, current_user.id, payload.url
        )

    return await _enrich_note_out(note, db)


@router.get("", response_model=NoteList)
async def list_notes(
    pagination: Pagination = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count_result = await db.execute(
        select(func.count()).where(Note.owner_id == current_user.id)
    )
    total = count_result.scalar_one()

    result = await db.execute(
        select(Note)
        .where(Note.owner_id == current_user.id)
        .options(selectinload(Note.tags))
        .order_by(Note.created_at.desc())
        .offset(pagination.offset)
        .limit(pagination.page_size)
    )
    notes = result.scalars().all()
    items = [await _enrich_note_out(n, db) for n in notes]

    return NoteList(
        items=items,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
        has_next=(pagination.offset + pagination.page_size) < total,
    )


@router.get("/{note_id}", response_model=NoteOut)
async def get_note(
    note_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Note)
        .where(Note.id == note_id, Note.owner_id == current_user.id)
        .options(selectinload(Note.tags))
    )
    note = result.scalars().first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return await _enrich_note_out(note, db)


@router.patch("/{note_id}", response_model=NoteOut)
async def update_note(
    note_id: int,
    payload: NoteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Note)
        .where(Note.id == note_id, Note.owner_id == current_user.id)
        .options(selectinload(Note.tags))
    )
    note = result.scalars().first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    update_data = payload.model_dump(exclude_unset=True)
    tag_ids = update_data.pop("tag_ids", None)
    folder_ids = update_data.pop("folder_ids", None)

    for field, value in update_data.items():
        setattr(note, field, value)

    if tag_ids is not None:
        await _apply_tags(db, note, tag_ids, current_user.id)
    if folder_ids is not None:
        await _apply_folders(db, note, folder_ids)

    await db.refresh(note, ["tags"])
    return await _enrich_note_out(note, db)


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    note_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Note).where(Note.id == note_id, Note.owner_id == current_user.id)
    )
    note = result.scalars().first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    await db.delete(note)
