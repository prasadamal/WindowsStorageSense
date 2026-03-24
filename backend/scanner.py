"""
Async disk scanner — Phase 1 core.

Scans drives recursively in background threads, writes results to SQLite,
and exposes progress via an asyncio Queue so the API layer can stream updates.

Safety rules enforced:
  • Blocked paths are skipped.
  • Symlinks are flagged and not followed recursively.
  • Long paths use the \\?\\ prefix.
  • All I/O runs in a thread pool to keep the event loop free.
"""

import asyncio
import json
import os
import sqlite3
import stat
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncGenerator, Optional

import psutil

from database import get_connection, init_db
from safety import BLOCKED_PATHS, enforce_extended_path, is_blocked_path

_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="scanner")


# ---------------------------------------------------------------------------
# Drive helpers
# ---------------------------------------------------------------------------

def list_drives() -> list[dict]:
    """Return info for every mounted drive visible to psutil."""
    drives = []
    for part in psutil.disk_partitions(all=False):
        try:
            usage = psutil.disk_usage(part.mountpoint)
            drives.append(
                {
                    "path": part.mountpoint,
                    "device": part.device,
                    "fstype": part.fstype,
                    "total_bytes": usage.total,
                    "used_bytes": usage.used,
                    "free_bytes": usage.free,
                    "percent_used": usage.percent,
                    "drive_type": _detect_drive_type(part.mountpoint),
                    "label": _get_volume_label(part.mountpoint),
                }
            )
        except (PermissionError, OSError):
            continue
    return drives


def _detect_drive_type(mountpoint: str) -> str:
    """Detect whether a drive is SSD, HDD, Removable, Network, or Unknown."""
    try:
        import wmi  # Windows only
        c = wmi.WMI()
        # Map drive letter to disk index, then check MediaType
        for disk in c.Win32_DiskDrive():
            for partition in disk.associators("Win32_DiskDriveToDiskPartition"):
                for logical in partition.associators("Win32_LogicalDiskToPartition"):
                    if logical.DeviceID.rstrip("\\") == mountpoint.rstrip("\\").rstrip("/"):
                        mt = getattr(disk, "MediaType", "")
                        if "SSD" in (mt or "").upper() or disk.Model and "SSD" in disk.Model.upper():
                            return "SSD"
                        if "Fixed" in (mt or ""):
                            return "HDD"
        return "Unknown"
    except Exception:
        return "Unknown"


def _get_volume_label(mountpoint: str) -> str:
    try:
        import ctypes
        label = ctypes.create_unicode_buffer(256)
        ctypes.windll.kernel32.GetVolumeInformationW(
            mountpoint, label, 256, None, None, None, None, 0
        )
        return label.value or mountpoint
    except Exception:
        return mountpoint


# ---------------------------------------------------------------------------
# File categorisation (inline — also used by categorizer module)
# ---------------------------------------------------------------------------

CATEGORY_MAP: dict[str, str] = {
    # Movies / Video
    ".mp4": "Movies", ".mkv": "Movies", ".avi": "Movies", ".mov": "Movies",
    ".wmv": "Movies", ".flv": "Movies", ".m4v": "Movies", ".ts": "Movies",
    ".webm": "Movies", ".vob": "Movies",
    # Documents
    ".pdf": "Documents", ".doc": "Documents", ".docx": "Documents",
    ".xls": "Documents", ".xlsx": "Documents", ".ppt": "Documents",
    ".pptx": "Documents", ".txt": "Documents", ".odt": "Documents",
    ".csv": "Documents", ".rtf": "Documents", ".md": "Documents",
    # Images
    ".jpg": "Images", ".jpeg": "Images", ".png": "Images", ".gif": "Images",
    ".bmp": "Images", ".tiff": "Images", ".tif": "Images", ".svg": "Images",
    ".heic": "Images", ".webp": "Images", ".raw": "Images", ".cr2": "Images",
    ".nef": "Images",
    # Music
    ".mp3": "Music", ".flac": "Music", ".aac": "Music", ".wav": "Music",
    ".ogg": "Music", ".wma": "Music", ".m4a": "Music", ".opus": "Music",
    # Archives
    ".zip": "Archives", ".rar": "Archives", ".7z": "Archives",
    ".tar": "Archives", ".gz": "Archives", ".bz2": "Archives",
    ".xz": "Archives", ".iso": "Archives",
    # Applications
    ".exe": "Applications", ".msi": "Applications", ".dll": "Applications",
    ".apk": "Applications",
    # Games (common package extensions)
    ".vpk": "Games",
}


def categorise_file(path: str) -> str:
    ext = Path(path).suffix.lower()
    return CATEGORY_MAP.get(ext, "Other")


# ---------------------------------------------------------------------------
# Core scan routine (runs in thread pool)
# ---------------------------------------------------------------------------

def _scan_drive_sync(
    drive_path: str,
    session_id: int,
    progress_list: list,
) -> int:
    """Blocking scan of a single drive. Called from thread pool."""
    conn = get_connection()
    file_count = 0
    batch: list[tuple] = []
    BATCH_SIZE = 500

    def flush():
        nonlocal batch
        conn.executemany(
            """
            INSERT OR IGNORE INTO files
                (session_id, path, name, extension, size_bytes, category,
                 last_accessed, last_modified, created_at_ts, is_symlink, drive_path)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
            """,
            batch,
        )
        conn.commit()
        batch = []

    try:
        for root, dirs, files in os.walk(drive_path, topdown=True, followlinks=False):
            # Skip blocked paths
            dirs[:] = [
                d for d in dirs
                if not is_blocked_path(os.path.join(root, d))
                and not os.path.islink(os.path.join(root, d))
            ]

            for fname in files:
                raw_path = os.path.join(root, fname)
                fpath = enforce_extended_path(raw_path)
                try:
                    st = os.lstat(fpath)
                    is_sym = stat.S_ISLNK(st.st_mode)
                    size = st.st_size
                    ext = Path(fname).suffix.lower()
                    cat = CATEGORY_MAP.get(ext, "Other")
                    atime = datetime.fromtimestamp(st.st_atime, tz=timezone.utc).isoformat()
                    mtime = datetime.fromtimestamp(st.st_mtime, tz=timezone.utc).isoformat()
                    ctime = datetime.fromtimestamp(st.st_ctime, tz=timezone.utc).isoformat()

                    batch.append(
                        (
                            session_id, raw_path, fname, ext, size, cat,
                            atime, mtime, ctime, int(is_sym), drive_path,
                        )
                    )
                    file_count += 1
                    if len(batch) >= BATCH_SIZE:
                        flush()
                        progress_list.append(file_count)
                except (PermissionError, OSError):
                    continue
        flush()
    finally:
        conn.close()

    return file_count


# ---------------------------------------------------------------------------
# Public async API
# ---------------------------------------------------------------------------

async def start_scan(drive_paths: list[str]) -> int:
    """Create a scan session and launch background scanning. Returns session_id."""
    conn = get_connection()
    try:
        cur = conn.execute(
            "INSERT INTO scan_sessions(drive_paths, status) VALUES(?,?)",
            (json.dumps(drive_paths), "running"),
        )
        session_id = cur.lastrowid
        conn.commit()
    finally:
        conn.close()

    asyncio.get_event_loop().run_in_executor(
        _executor, _run_full_scan, session_id, drive_paths
    )
    return session_id


def _run_full_scan(session_id: int, drive_paths: list[str]) -> None:
    """Runs in a thread — scans all drives and marks session complete."""
    conn = get_connection()
    progress: list[int] = []
    try:
        total = 0
        for drive in drive_paths:
            total += _scan_drive_sync(drive, session_id, progress)
        conn.execute(
            "UPDATE scan_sessions SET status=?, finished_at=CURRENT_TIMESTAMP WHERE id=?",
            ("complete", session_id),
        )
        conn.commit()
    except Exception as exc:
        conn.execute(
            "UPDATE scan_sessions SET status=? WHERE id=?",
            (f"error: {exc}", session_id),
        )
        conn.commit()
    finally:
        conn.close()


async def get_scan_status(session_id: int) -> dict:
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM scan_sessions WHERE id=?", (session_id,)
        ).fetchone()
        if not row:
            return {"status": "not_found"}
        count_row = conn.execute(
            "SELECT COUNT(*) as cnt FROM files WHERE session_id=?", (session_id,)
        ).fetchone()
        return {
            "session_id": row["id"],
            "status": row["status"],
            "started_at": row["started_at"],
            "finished_at": row["finished_at"],
            "files_found": count_row["cnt"] if count_row else 0,
        }
    finally:
        conn.close()


async def get_top_files(session_id: int, limit: int = 50) -> list[dict]:
    """Return the largest files from a completed scan."""
    conn = get_connection()
    try:
        rows = conn.execute(
            """
            SELECT path, name, extension, size_bytes, category, last_accessed,
                   last_modified, drive_path, is_symlink
            FROM files
            WHERE session_id=? AND is_symlink=0
            ORDER BY size_bytes DESC
            LIMIT ?
            """,
            (session_id, limit),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


async def get_category_summary(session_id: int) -> list[dict]:
    """Return total size per file category."""
    conn = get_connection()
    try:
        rows = conn.execute(
            """
            SELECT category,
                   COUNT(*) as file_count,
                   SUM(size_bytes) as total_bytes
            FROM files
            WHERE session_id=? AND is_symlink=0
            GROUP BY category
            ORDER BY total_bytes DESC
            """,
            (session_id,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


async def get_latest_session_id() -> Optional[int]:
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT id FROM scan_sessions WHERE status='complete' ORDER BY id DESC LIMIT 1"
        ).fetchone()
        return row["id"] if row else None
    finally:
        conn.close()
