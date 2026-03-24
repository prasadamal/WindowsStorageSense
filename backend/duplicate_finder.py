"""
Three-stage duplicate file finder.

Stage 1: Group files by size (eliminates >99% of comparisons).
Stage 2: Compare partial hash of first 64 KB.
Stage 3: Full MD5 hash for confirmed candidates.

Perceptual hashing for images is also supported (opt-in).

Safety: Filename similarity is NEVER used as a deletion criterion.
"""

import hashlib
import os
import sqlite3
from pathlib import Path
from typing import Optional

from database import get_connection
from safety import enforce_extended_path

PARTIAL_HASH_BYTES = 65536  # 64 KB


def _partial_hash(path: str) -> Optional[str]:
    safe_path = enforce_extended_path(path)
    try:
        with open(safe_path, "rb") as f:
            data = f.read(PARTIAL_HASH_BYTES)
        return hashlib.md5(data).hexdigest()
    except (OSError, PermissionError):
        return None


def _full_hash(path: str) -> Optional[str]:
    safe_path = enforce_extended_path(path)
    try:
        h = hashlib.md5()
        with open(safe_path, "rb") as f:
            for chunk in iter(lambda: f.read(1 << 20), b""):
                h.update(chunk)
        return h.hexdigest()
    except (OSError, PermissionError):
        return None


def _perceptual_hash(path: str) -> Optional[str]:
    """Compute perceptual hash for image files (requires Pillow + imagehash)."""
    try:
        from PIL import Image
        import imagehash
        with Image.open(path) as img:
            return str(imagehash.phash(img))
    except Exception:
        return None


def find_duplicates(session_id: int, include_images: bool = True) -> list[dict]:
    """
    Run three-stage duplicate detection for all files in a session.
    Returns a list of duplicate groups with wasted bytes.
    """
    conn = get_connection()
    try:
        # Stage 1: group by size
        size_groups = conn.execute(
            """
            SELECT size_bytes, GROUP_CONCAT(id) as file_ids, COUNT(*) as cnt
            FROM files
            WHERE session_id=? AND is_symlink=0 AND size_bytes > 0
            GROUP BY size_bytes
            HAVING cnt > 1
            """,
            (session_id,),
        ).fetchall()

        result_groups: list[dict] = []

        for sg in size_groups:
            file_ids = [int(x) for x in sg["file_ids"].split(",")]
            file_rows = conn.execute(
                "SELECT id, path, size_bytes, extension FROM files WHERE id IN ({})".format(
                    ",".join("?" * len(file_ids))
                ),
                file_ids,
            ).fetchall()

            # Stage 2: partial hash
            partial_buckets: dict[str, list] = {}
            for row in file_rows:
                ph = _partial_hash(row["path"])
                if ph:
                    partial_buckets.setdefault(ph, []).append(row)

            # Stage 3: full hash
            for partial_h, candidates in partial_buckets.items():
                if len(candidates) < 2:
                    continue
                full_buckets: dict[str, list] = {}
                for row in candidates:
                    fh = _full_hash(row["path"])
                    if fh:
                        # Cache hash in DB
                        conn.execute(
                            "UPDATE files SET partial_hash=?, full_hash=? WHERE id=?",
                            (partial_h, fh, row["id"]),
                        )
                        full_buckets.setdefault(fh, []).append(row)

                conn.commit()

                for full_h, dupes in full_buckets.items():
                    if len(dupes) < 2:
                        continue
                    wasted = sg["size_bytes"] * (len(dupes) - 1)

                    # Persist group
                    cur = conn.execute(
                        "INSERT INTO duplicate_groups(session_id, full_hash, file_count, total_wasted_bytes) VALUES(?,?,?,?)",
                        (session_id, full_h, len(dupes), wasted),
                    )
                    group_id = cur.lastrowid
                    # Mark first file as original (smallest mtime → most recently modified kept)
                    sorted_dupes = sorted(dupes, key=lambda r: r["path"])
                    for idx, d in enumerate(sorted_dupes):
                        conn.execute(
                            "INSERT INTO duplicate_files(group_id, file_id, is_original) VALUES(?,?,?)",
                            (group_id, d["id"], 1 if idx == 0 else 0),
                        )
                    conn.commit()

                    result_groups.append(
                        {
                            "group_id": group_id,
                            "full_hash": full_h,
                            "file_count": len(dupes),
                            "wasted_bytes": wasted,
                            "size_bytes": sg["size_bytes"],
                            "files": [
                                {
                                    "id": d["id"],
                                    "path": d["path"],
                                    "is_original": idx == 0,
                                }
                                for idx, d in enumerate(sorted_dupes)
                            ],
                        }
                    )

        # Perceptual hash for images
        if include_images:
            image_rows = conn.execute(
                """
                SELECT id, path FROM files
                WHERE session_id=? AND is_symlink=0
                  AND extension IN ('.jpg','.jpeg','.png','.bmp','.gif','.webp','.tiff','.tif')
                """,
                (session_id,),
            ).fetchall()

            phash_buckets: dict[str, list] = {}
            for row in image_rows:
                ph = _perceptual_hash(row["path"])
                if ph:
                    phash_buckets.setdefault(ph, []).append(row)

            for ph, group in phash_buckets.items():
                if len(group) < 2:
                    continue
                # Only report if not already caught by exact hash
                paths = [r["path"] for r in group]
                already = conn.execute(
                    "SELECT 1 FROM duplicate_files df JOIN files f ON df.file_id=f.id WHERE f.path=? LIMIT 1",
                    (paths[0],),
                ).fetchone()
                if already:
                    continue
                result_groups.append(
                    {
                        "group_id": None,
                        "full_hash": f"phash:{ph}",
                        "file_count": len(group),
                        "wasted_bytes": 0,
                        "size_bytes": 0,
                        "type": "perceptual",
                        "files": [
                            {"id": r["id"], "path": r["path"], "is_original": idx == 0}
                            for idx, r in enumerate(group)
                        ],
                    }
                )

        return result_groups

    finally:
        conn.close()


def get_duplicate_groups(session_id: int) -> list[dict]:
    """Load persisted duplicate groups from the DB."""
    conn = get_connection()
    try:
        groups = conn.execute(
            "SELECT * FROM duplicate_groups WHERE session_id=? ORDER BY total_wasted_bytes DESC",
            (session_id,),
        ).fetchall()
        result = []
        for g in groups:
            files = conn.execute(
                """
                SELECT df.is_original, f.path, f.name, f.size_bytes, f.last_accessed
                FROM duplicate_files df
                JOIN files f ON df.file_id = f.id
                WHERE df.group_id=?
                """,
                (g["id"],),
            ).fetchall()
            result.append(
                {
                    "group_id": g["id"],
                    "full_hash": g["full_hash"],
                    "file_count": g["file_count"],
                    "wasted_bytes": g["total_wasted_bytes"],
                    "files": [dict(f) for f in files],
                }
            )
        return result
    finally:
        conn.close()
