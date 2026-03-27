"""
Re-export Base so Alembic's env.py only needs one import.
All models must be imported here so SQLAlchemy knows about them
before `Base.metadata.create_all()` or Alembic auto-generates migrations.
"""

from app.db.session import Base  # noqa: F401

# Import all models to register them with Base.metadata
from app.models.user import User  # noqa: F401
from app.models.note import Note  # noqa: F401
from app.models.folder import Folder  # noqa: F401
from app.models.tag import Tag, NoteTag  # noqa: F401
from app.models.note_folder import NoteFolder  # noqa: F401
