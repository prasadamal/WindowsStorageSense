"""
Folders CRUD routes.

GET    /folders          — all folders (tree structure) for current user.
POST   /folders          — create a manual folder.
GET    /folders/{id}     — folder detail + note count.
PATCH  /folders/{id}     — rename, recolor, re-parent.
DELETE /folders/{id}     — delete folder (notes are NOT deleted).
GET    /folders/{id}/notes — paginated notes in this folder.
POST   /folders/{id}/notes/{note_id} — manually add note to folder.
DELETE /folders/{id}/notes/{note_id} — remove note from folder.
"""

import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import Pagination, get_current_user
from app.db.session import get_db
from app.models.folder import Folder
from app.models.note import Note
from app.models.note_folder import NoteFolder
from app.models.user import User
from app.schemas.folder import FolderCreate, FolderOut, FolderTree, FolderUpdate
from app.schemas.note import NoteList, NoteOut

router = APIRouter(prefix="/folders", tags=["folders"])


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


async def _note_count(db: AsyncSession, folder_id: int) -> int:
    result = await db.execute(
        select(func.count()).where(NoteFolder.folder_id == folder_id)
    )
    return result.scalar_one()


async def _folder_out(folder: Folder, db: AsyncSession) -> FolderOut:
    count = await _note_count(db, folder.id)
    out = FolderOut.model_validate(folder)
    out.note_count = count
    return out


def _build_tree(
    folders: list[FolderOut], parent_id: int | None = None
) -> list[FolderTree]:
    tree: list[FolderTree] = []
    for f in folders:
        if f.parent_id == parent_id:
            node = FolderTree(**f.model_dump())
            node.children = _build_tree(folders, parent_id=f.id)
            tree.append(node)
    return tree


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[FolderTree])
async def list_folders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Folder)
        .where(Folder.owner_id == current_user.id)
        .order_by(Folder.name)
    )
    folders = result.scalars().all()
    flat = [await _folder_out(f, db) for f in folders]
    return _build_tree(flat)


@router.post("", response_model=FolderOut, status_code=status.HTTP_201_CREATED)
async def create_folder(
    payload: FolderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    slug = _slug(payload.name)
    # Ensure uniqueness within the same parent
    existing = await db.execute(
        select(Folder).where(
            Folder.owner_id == current_user.id,
            Folder.slug == slug,
            Folder.parent_id == payload.parent_id,
        )
    )
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail="A folder with this name already exists here")

    folder = Folder(
        owner_id=current_user.id,
        name=payload.name,
        slug=slug,
        description=payload.description,
        color=payload.color,
        parent_id=payload.parent_id,
        is_smart=False,
    )
    db.add(folder)
    await db.flush()
    await db.refresh(folder)
    return await _folder_out(folder, db)


@router.get("/{folder_id}", response_model=FolderOut)
async def get_folder(
    folder_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Folder).where(Folder.id == folder_id, Folder.owner_id == current_user.id)
    )
    folder = result.scalars().first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    return await _folder_out(folder, db)


@router.patch("/{folder_id}", response_model=FolderOut)
async def update_folder(
    folder_id: int,
    payload: FolderUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Folder).where(Folder.id == folder_id, Folder.owner_id == current_user.id)
    )
    folder = result.scalars().first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(folder, field, value)
    if payload.name:
        folder.slug = _slug(payload.name)

    await db.flush()
    await db.refresh(folder)
    return await _folder_out(folder, db)


@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_folder(
    folder_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Folder).where(Folder.id == folder_id, Folder.owner_id == current_user.id)
    )
    folder = result.scalars().first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    await db.delete(folder)


@router.get("/{folder_id}/notes", response_model=NoteList)
async def list_folder_notes(
    folder_id: int,
    pagination: Pagination = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify folder ownership
    folder_result = await db.execute(
        select(Folder).where(Folder.id == folder_id, Folder.owner_id == current_user.id)
    )
    if not folder_result.scalars().first():
        raise HTTPException(status_code=404, detail="Folder not found")

    count_result = await db.execute(
        select(func.count())
        .select_from(NoteFolder)
        .where(NoteFolder.folder_id == folder_id)
    )
    total = count_result.scalar_one()

    note_ids_result = await db.execute(
        select(NoteFolder.note_id)
        .where(NoteFolder.folder_id == folder_id)
        .offset(pagination.offset)
        .limit(pagination.page_size)
    )
    note_ids = [r[0] for r in note_ids_result.all()]

    notes_result = await db.execute(
        select(Note)
        .where(Note.id.in_(note_ids))
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


@router.post("/{folder_id}/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def add_note_to_folder(
    folder_id: int,
    note_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    folder_result = await db.execute(
        select(Folder).where(Folder.id == folder_id, Folder.owner_id == current_user.id)
    )
    if not folder_result.scalars().first():
        raise HTTPException(status_code=404, detail="Folder not found")

    note_result = await db.execute(
        select(Note).where(Note.id == note_id, Note.owner_id == current_user.id)
    )
    if not note_result.scalars().first():
        raise HTTPException(status_code=404, detail="Note not found")

    existing = await db.execute(
        select(NoteFolder).where(NoteFolder.note_id == note_id, NoteFolder.folder_id == folder_id)
    )
    if not existing.scalars().first():
        db.add(NoteFolder(note_id=note_id, folder_id=folder_id))


@router.delete("/{folder_id}/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_note_from_folder(
    folder_id: int,
    note_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(NoteFolder).where(NoteFolder.note_id == note_id, NoteFolder.folder_id == folder_id)
    )
    nf = result.scalars().first()
    if not nf:
        raise HTTPException(status_code=404, detail="Note not in this folder")
    await db.delete(nf)
