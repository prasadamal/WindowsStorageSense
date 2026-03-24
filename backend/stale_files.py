"""
Stale file detection — files not opened or modified in over 12 months.
"""

from datetime import datetime, timedelta, timezone
from database import get_connection

STALE_THRESHOLD_DAYS = 365


def get_stale_files(session_id: int, threshold_days: int = STALE_THRESHOLD_DAYS) -> dict:
    """Return files not accessed for `threshold_days` days."""
    conn = get_connection()
    try:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=threshold_days)).isoformat()
        rows = conn.execute(
            """
            SELECT path, name, extension, size_bytes, category, last_accessed, last_modified, drive_path
            FROM files
            WHERE session_id=?
              AND is_symlink=0
              AND last_accessed IS NOT NULL
              AND last_accessed < ?
            ORDER BY size_bytes DESC
            """,
            (session_id, cutoff),
        ).fetchall()

        files = [dict(r) for r in rows]
        total_bytes = sum(f["size_bytes"] for f in files)

        return {
            "threshold_days": threshold_days,
            "file_count": len(files),
            "total_bytes": total_bytes,
            "files": files,
        }
    finally:
        conn.close()
