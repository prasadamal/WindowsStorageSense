"""
Smart folder organizer.

After a note is saved and its tags are extracted, this service:
1. Finds or creates "smart" folders matching each tag (grouped by category).
2. Links the note to all matching folders.
3. Handles the multi-folder membership model (a note appears in both
   "Bangalore" and "Food" if it has both tags).

Folder naming convention:
- Places → folder named after the place  ("Bangalore", "Chennai")
- Cuisines → "Food" umbrella + cuisine-specific sub-folder ("South Indian Food")
- Activities → folder named after the activity type ("Cafes", "Museums")
- Moods / Topics → title-cased folder name

A folder is "smart" (is_smart=True) if it was auto-created by this service.
Users can rename / merge / delete smart folders just like manual ones.
"""

import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.folder import Folder
from app.models.note_folder import NoteFolder
from app.services.tag_extractor import ExtractedTag


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


async def _get_or_create_folder(
    db: AsyncSession,
    owner_id: int,
    name: str,
    parent_id: int | None = None,
    is_smart: bool = True,
) -> Folder:
    slug = _slug(name)
    result = await db.execute(
        select(Folder).where(
            Folder.owner_id == owner_id,
            Folder.slug == slug,
            Folder.parent_id == parent_id,
        )
    )
    folder = result.scalars().first()
    if folder is None:
        folder = Folder(
            owner_id=owner_id,
            name=name,
            slug=slug,
            parent_id=parent_id,
            is_smart=is_smart,
        )
        db.add(folder)
        await db.flush()  # get the id before commit
    return folder


async def _link_note_to_folder(
    db: AsyncSession, note_id: int, folder_id: int
) -> None:
    result = await db.execute(
        select(NoteFolder).where(
            NoteFolder.note_id == note_id,
            NoteFolder.folder_id == folder_id,
        )
    )
    if result.scalars().first() is None:
        db.add(NoteFolder(note_id=note_id, folder_id=folder_id))


async def organize_note_into_folders(
    db: AsyncSession,
    note_id: int,
    owner_id: int,
    tags: list[ExtractedTag],
) -> list[int]:
    """
    Create / find smart folders and link the note.
    Returns the list of folder IDs the note was added to.
    """
    folder_ids: list[int] = []

    for tag in tags:
        if tag.category == "place":
            folder = await _get_or_create_folder(db, owner_id, tag.name)
            folder_ids.append(folder.id)
            await _link_note_to_folder(db, note_id, folder.id)

        elif tag.category == "cuisine":
            # Parent: "Food" umbrella folder
            food_folder = await _get_or_create_folder(db, owner_id, "Food")
            # Child: specific cuisine
            cuisine_label = f"{tag.name} Food" if "food" not in tag.name.lower() else tag.name
            cuisine_folder = await _get_or_create_folder(
                db, owner_id, cuisine_label, parent_id=food_folder.id
            )
            folder_ids.extend([food_folder.id, cuisine_folder.id])
            await _link_note_to_folder(db, note_id, food_folder.id)
            await _link_note_to_folder(db, note_id, cuisine_folder.id)

        elif tag.category == "activity":
            # Pluralise: "Cafe" → "Cafes"
            label = tag.name if tag.name.endswith("s") else tag.name + "s"
            folder = await _get_or_create_folder(db, owner_id, label)
            folder_ids.append(folder.id)
            await _link_note_to_folder(db, note_id, folder.id)

        elif tag.category in ("mood", "topic", "person"):
            folder = await _get_or_create_folder(db, owner_id, tag.name)
            folder_ids.append(folder.id)
            await _link_note_to_folder(db, note_id, folder.id)

    return list(set(folder_ids))
