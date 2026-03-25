"""Note ORM model."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Note(Base):
    __tablename__ = "notes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)

    # ── Content ───────────────────────────────────────────────────────────────
    url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)          # user's personal note
    description: Mapped[str | None] = mapped_column(Text, nullable=True)   # OG description
    thumbnail_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    source_platform: Mapped[str | None] = mapped_column(String(50), nullable=True)  # youtube|instagram|twitter|maps|web

    # ── Metadata ──────────────────────────────────────────────────────────────
    is_visited: Mapped[bool] = mapped_column(default=False)
    visit_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1-5
    visit_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    owner: Mapped["User"] = relationship(back_populates="notes")  # noqa: F821
    tags: Mapped[list["Tag"]] = relationship(  # noqa: F821
        secondary="note_tags", back_populates="notes", lazy="selectin"
    )
    note_folders: Mapped[list["NoteFolder"]] = relationship(  # noqa: F821
        back_populates="note", cascade="all, delete-orphan"
    )
