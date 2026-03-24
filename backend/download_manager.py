"""
Download Manager & Organizer.

Shows all contents of the Downloads folder grouped by type,
flags old files, and can auto-organize into subfolders.
"""

import os
import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from safety import is_blocked_path

try:
    import send2trash
    HAS_SEND2TRASH = True
except ImportError:
    HAS_SEND2TRASH = False


DOWNLOADS_PATH = Path.home() / "Downloads"

ORGANIZER_MAP: dict[str, str] = {
    # Images
    ".jpg": "Images", ".jpeg": "Images", ".png": "Images", ".gif": "Images",
    ".bmp": "Images", ".heic": "Images", ".webp": "Images", ".svg": "Images",
    # Documents
    ".pdf": "Documents", ".doc": "Documents", ".docx": "Documents",
    ".xls": "Documents", ".xlsx": "Documents", ".ppt": "Documents",
    ".pptx": "Documents", ".txt": "Documents", ".csv": "Documents",
    ".odt": "Documents", ".rtf": "Documents",
    # Videos
    ".mp4": "Videos", ".mkv": "Videos", ".avi": "Videos", ".mov": "Videos",
    ".wmv": "Videos", ".flv": "Videos", ".m4v": "Videos",
    # Music
    ".mp3": "Music", ".flac": "Music", ".aac": "Music", ".wav": "Music",
    ".ogg": "Music", ".m4a": "Music",
    # Installers
    ".exe": "Installers", ".msi": "Installers", ".dmg": "Installers",
    ".pkg": "Installers",
    # Archives
    ".zip": "Archives", ".rar": "Archives", ".7z": "Archives",
    ".tar": "Archives", ".gz": "Archives", ".bz2": "Archives",
    ".iso": "Archives",
}


def list_downloads(stale_days: int = 90) -> dict:
    downloads_dir = str(DOWNLOADS_PATH)
    if not os.path.isdir(downloads_dir):
        return {"path": downloads_dir, "exists": False, "files": [], "total_bytes": 0}

    now_ts = datetime.now(timezone.utc).timestamp()
    cutoff_ts = now_ts - stale_days * 86400

    files = []
    total_bytes = 0

    try:
        for entry in os.scandir(downloads_dir):
            if not entry.is_file(follow_symlinks=False):
                continue
            try:
                st = entry.stat(follow_symlinks=False)
                size = st.st_size
                atime = st.st_atime
                mtime = st.st_mtime
                ext = Path(entry.name).suffix.lower()
                category = ORGANIZER_MAP.get(ext, "Other")
                is_stale = atime < cutoff_ts and mtime < cutoff_ts

                files.append({
                    "name": entry.name,
                    "path": entry.path,
                    "size_bytes": size,
                    "category": category,
                    "extension": ext,
                    "last_accessed": datetime.fromtimestamp(atime, tz=timezone.utc).isoformat(),
                    "last_modified": datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat(),
                    "is_stale": is_stale,
                })
                total_bytes += size
            except OSError:
                continue
    except (PermissionError, OSError):
        pass

    # Group by category
    grouped: dict[str, list] = {}
    for f in files:
        grouped.setdefault(f["category"], []).append(f)

    return {
        "path": downloads_dir,
        "exists": True,
        "files": sorted(files, key=lambda x: x["size_bytes"], reverse=True),
        "grouped": {cat: sorted(grp, key=lambda x: x["size_bytes"], reverse=True)
                    for cat, grp in grouped.items()},
        "total_bytes": total_bytes,
        "stale_count": sum(1 for f in files if f["is_stale"]),
        "stale_bytes": sum(f["size_bytes"] for f in files if f["is_stale"]),
    }


def organize_downloads() -> dict:
    """
    Move files in the Downloads folder into category subfolders.
    Returns a summary of files moved.
    """
    downloads_dir = str(DOWNLOADS_PATH)
    if not os.path.isdir(downloads_dir):
        return {"success": False, "error": "Downloads folder not found"}

    moved = 0
    errors = []

    try:
        for entry in os.scandir(downloads_dir):
            if not entry.is_file(follow_symlinks=False):
                continue
            ext = Path(entry.name).suffix.lower()
            category = ORGANIZER_MAP.get(ext, "Other")
            dest_dir = os.path.join(downloads_dir, category)
            try:
                os.makedirs(dest_dir, exist_ok=True)
                shutil.move(entry.path, os.path.join(dest_dir, entry.name))
                moved += 1
            except (OSError, shutil.Error) as e:
                errors.append(f"{entry.name}: {e}")
    except (PermissionError, OSError) as e:
        return {"success": False, "error": str(e)}

    return {"success": True, "files_moved": moved, "errors": errors}


def delete_stale_downloads(stale_days: int = 90) -> dict:
    """Send stale download files to Recycle Bin — never permanent delete."""
    if not HAS_SEND2TRASH:
        return {"error": "send2trash not available"}

    info = list_downloads(stale_days=stale_days)
    stale_files = [f for f in info["files"] if f["is_stale"]]

    deleted = 0
    errors = []
    for f in stale_files:
        if is_blocked_path(f["path"]):
            continue
        try:
            send2trash.send2trash(f["path"])
            deleted += 1
        except Exception as e:
            errors.append(f"{f['path']}: {e}")

    return {
        "deleted_count": deleted,
        "errors": errors,
        "bytes_freed": sum(f["size_bytes"] for f in stale_files),
    }
