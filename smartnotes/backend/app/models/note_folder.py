"""NoteFolder M2M association — a note can live in multiple folders."""

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class NoteFolder(Base):
    __tablename__ = "note_folders"
    __table_args__ = (UniqueConstraint("note_id", "folder_id", name="uq_note_folder"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    note_id: Mapped[int] = mapped_column(ForeignKey("notes.id", ondelete="CASCADE"), index=True)
    folder_id: Mapped[int] = mapped_column(ForeignKey("folders.id", ondelete="CASCADE"), index=True)

    note: Mapped["Note"] = relationship(back_populates="note_folders")  # noqa: F821
    folder: Mapped["Folder"] = relationship(back_populates="note_folders")  # noqa: F821
