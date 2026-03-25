"""Tag ORM model and NoteTag association table."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Tag(Base):
    __tablename__ = "tags"
    __table_args__ = (UniqueConstraint("owner_id", "name", name="uq_tag_owner_name"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # e.g. "place", "cuisine", "activity", "mood", "person", "topic"
    color: Mapped[str | None] = mapped_column(String(7), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    notes: Mapped[list["Note"]] = relationship(  # noqa: F821
        secondary="note_tags", back_populates="tags"
    )


class NoteTag(Base):
    """Many-to-many join table between notes and tags."""

    __tablename__ = "note_tags"
    __table_args__ = (UniqueConstraint("note_id", "tag_id", name="uq_note_tag"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    note_id: Mapped[int] = mapped_column(ForeignKey("notes.id", ondelete="CASCADE"), index=True)
    tag_id: Mapped[int] = mapped_column(ForeignKey("tags.id", ondelete="CASCADE"), index=True)
    is_auto: Mapped[bool] = mapped_column(default=True)  # True = AI-generated; False = user-added
