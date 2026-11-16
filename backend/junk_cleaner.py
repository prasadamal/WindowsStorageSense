"""
Junk cleaner — scans known junk locations and reports sizes.
Never auto-cleans; the user must confirm before any deletion.
All deletions go to the Recycle Bin (via send2trash).
"""

import os
import glob
import sqlite3
from pathlib import Path
from typing import Optional

from database import get_connection
from safety import is_blocked_path

try:
    import send2trash
    HAS_SEND2TRASH = True
except ImportError:
    HAS_SEND2TRASH = False


# ---------------------------------------------------------------------------
# Junk category definitions
# ---------------------------------------------------------------------------

def _dir_size(path: str) -> int:
    total = 0
    try:
        for entry in os.scandir(path):
            try:
                if entry.is_file(follow_symlinks=False):
                    total += entry.stat(follow_symlinks=False).st_size
                elif entry.is_dir(follow_symlinks=False):
                    total += _dir_size(entry.path)
            except OSError:
                continue
    except (PermissionError, OSError):
        pass
    return total


def _file_size(path: str) -> int:
    try:
        return os.path.getsize(path)
    except OSError:
        return 0


def _get_junk_categories() -> list[dict]:
    """Return all junk categories with their paths and sizes."""
    user_profile = os.environ.get("USERPROFILE", str(Path.home()))
    system_drive = os.environ.get("SystemDrive", "C:")
    local_app_data = os.environ.get("LOCALAPPDATA", str(Path.home() / "AppData" / "Local"))
    app_data = os.environ.get("APPDATA", str(Path.home() / "AppData" / "Roaming"))

    categories = [
        {
            "id": "windows_temp",
            "label": "Windows Temp Folder",
            "paths": [os.path.join(system_drive + os.sep, "Windows", "Temp")],
        },
        {
            "id": "user_temp",
            "label": "User Temp Folder",
            "paths": [os.environ.get("TEMP", os.path.join(local_app_data, "Temp"))],
        },
        {
            "id": "prefetch",
            "label": "Prefetch Files",
            "paths": [os.path.join(system_drive + os.sep, "Windows", "Prefetch")],
        },
        {
            "id": "thumbnail_cache",
            "label": "Thumbnail Cache",
            "paths": [
                os.path.join(local_app_data, r"Microsoft\Windows\Explorer"),
            ],
        },
        {
            "id": "windows_update_cache",
            "label": "Windows Update Download Cache",
            "paths": [os.path.join(system_drive + os.sep, "Windows", "SoftwareDistribution", "Download")],
        },
        {
            "id": "recycle_bin",
            "label": "Recycle Bin",
            "paths": [os.path.join(system_drive + os.sep, "$Recycle.Bin")],
        },
        {
            "id": "chrome_cache",
            "label": "Chrome Browser Cache",
            "paths": [
                os.path.join(local_app_data, r"Google\Chrome\User Data\Default\Cache"),
                os.path.join(local_app_data, r"Google\Chrome\User Data\Default\Code Cache"),
            ],
        },
        {
            "id": "firefox_cache",
            "label": "Firefox Browser Cache",
            "paths": list(
                glob.glob(os.path.join(local_app_data, r"Mozilla\Firefox\Profiles\*\cache2"))
            ),
        },
        {
            "id": "edge_cache",
            "label": "Microsoft Edge Browser Cache",
            "paths": [
                os.path.join(local_app_data, r"Microsoft\Edge\User Data\Default\Cache"),
                os.path.join(local_app_data, r"Microsoft\Edge\User Data\Default\Code Cache"),
            ],
        },
        {
            "id": "log_files",
            "label": "System Log Files",
            "paths": [
                os.path.join(system_drive + os.sep, "Windows", "Logs"),
                os.path.join(local_app_data, r"Microsoft\Windows\WER"),
            ],
        },
        {
            "id": "windows_old",
            "label": "Windows.old Folder",
            "paths": [os.path.join(system_drive + os.sep, "Windows.old")],
        },
        {
            "id": "crash_dumps",
            "label": "Crash Dump Files",
            "paths": [
                os.path.join(local_app_data, r"CrashDumps"),
                os.path.join(system_drive + os.sep, "Windows", "Minidump"),
                os.path.join(system_drive + os.sep, "Windows", "MEMORY.DMP"),
            ],
        },
        {
            "id": "delivery_optimization",
            "label": "Delivery Optimization Cache",
            "paths": [os.path.join(system_drive + os.sep, "Windows", "SoftwareDistribution", "DeliveryOptimization")],
        },
        {
            "id": "npm_cache",
            "label": "npm Cache (Developer)",
            "paths": [os.path.join(local_app_data, r"npm-cache")],
        },
        {
            "id": "pip_cache",
            "label": "pip Cache (Developer)",
            "paths": [os.path.join(local_app_data, r"pip\Cache")],
        },
        {
            "id": "nuget_cache",
            "label": "NuGet Cache (Developer)",
            "paths": [os.path.join(local_app_data, r"NuGet\Cache")],
        },
    ]

    result = []
    for cat in categories:
        total_bytes = 0
        existing_paths = []
        for p in cat["paths"]:
            if os.path.isdir(p):
                total_bytes += _dir_size(p)
                existing_paths.append(p)
            elif os.path.isfile(p):
                total_bytes += _file_size(p)
                existing_paths.append(p)

        result.append(
            {
                "id": cat["id"],
                "label": cat["label"],
                "paths": existing_paths,
                "size_bytes": total_bytes,
                "exists": len(existing_paths) > 0,
            }
        )

    return result


def scan_junk(session_id: int) -> list[dict]:
    """Scan all junk categories, persist to DB, and return results."""
    categories = _get_junk_categories()
    conn = get_connection()
    try:
        # Clear old junk for this session
        conn.execute("DELETE FROM junk_items WHERE session_id=?", (session_id,))
        for cat in categories:
            for p in cat["paths"]:
                size = _dir_size(p) if os.path.isdir(p) else _file_size(p)
                conn.execute(
                    "INSERT INTO junk_items(session_id, category, path, size_bytes) VALUES(?,?,?,?)",
                    (session_id, cat["id"], p, size),
                )
        conn.commit()
    finally:
        conn.close()
    return categories


def delete_junk_categories(category_ids: list[str]) -> dict:
    """
    Delete files in the selected junk categories.
    Files go to the Recycle Bin — no permanent delete.
    Returns summary of actions taken.
    """
    if not HAS_SEND2TRASH:
        return {"error": "send2trash not available"}

    all_cats = _get_junk_categories()
    selected = [c for c in all_cats if c["id"] in category_ids]

    deleted_bytes = 0
    errors = []

    for cat in selected:
        for path in cat["paths"]:
            if is_blocked_path(path):
                errors.append(f"Blocked path skipped: {path}")
                continue
            try:
                send2trash.send2trash(path)
                deleted_bytes += cat["size_bytes"]
            except Exception as e:
                errors.append(f"{path}: {e}")

    return {
        "deleted_bytes": deleted_bytes,
        "categories_processed": len(selected),
        "errors": errors,
    }
