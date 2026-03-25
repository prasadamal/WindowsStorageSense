"""Folder ORM model — both smart (AI-generated) and manual folders."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Folder(Base):
    __tablename__ = "folders"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("folders.id", ondelete="SET NULL"), nullable=True, index=True
    )

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(220), nullable=False, index=True)  # lowercase identifier
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    cover_image_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    color: Mapped[str | None] = mapped_column(String(7), nullable=True)  # hex colour #RRGGBB
    is_smart: Mapped[bool] = mapped_column(Boolean, default=False)   # AI-generated folder

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    owner: Mapped["User"] = relationship(back_populates="folders")  # noqa: F821
    parent: Mapped["Folder | None"] = relationship(
        back_populates="children", remote_side="Folder.id"
    )
    children: Mapped[list["Folder"]] = relationship(back_populates="parent")
    note_folders: Mapped[list["NoteFolder"]] = relationship(  # noqa: F821
        back_populates="folder", cascade="all, delete-orphan"
    )
