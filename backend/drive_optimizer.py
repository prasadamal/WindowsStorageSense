"""
Drive Optimization Advisor — SSD vs HDD Intelligence.

Only shown when the user has both SSD and HDD detected.
Surfaces misplaced items with actionable recommendations.
All moves require user confirmation — nothing is automatic.
"""

import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from database import get_connection
from scanner import list_drives

# How many days without access = "dormant"
DORMANT_DAYS = 90
LARGE_MEDIA_EXTENSIONS = {
    ".mp4", ".mkv", ".avi", ".mov", ".wmv", ".m4v", ".ts", ".vob",
    ".mp3", ".flac", ".wav", ".aac",
    ".iso",
}
BROWSER_PROFILE_PATHS_KEYWORDS = [
    "chrome", "firefox", "edge", "google\\chrome", "mozilla\\firefox", "microsoft\\edge"
]


def _is_dormant(path: str) -> bool:
    try:
        atime = os.path.getatime(path)
        return (datetime.now(timezone.utc).timestamp() - atime) / 86400 > DORMANT_DAYS
    except OSError:
        return False


def _get_recommendations(session_id: int, drives: list[dict]) -> dict:
    ssd_drives = [d for d in drives if d["drive_type"] == "SSD"]
    hdd_drives = [d for d in drives if d["drive_type"] == "HDD"]

    if not ssd_drives or not hdd_drives:
        return {"applicable": False, "reason": "No mixed SSD/HDD configuration detected."}

    conn = get_connection()
    try:
        # Items ON HDD that should be ON SSD
        move_to_ssd: list[dict] = []

        # Frequently accessed files on HDD
        cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        for hdd in hdd_drives:
            rows = conn.execute(
                """
                SELECT path, name, size_bytes, category, last_accessed, drive_path
                FROM files
                WHERE session_id=? AND drive_path=? AND last_accessed > ?
                  AND is_symlink=0 AND size_bytes > 10485760
                ORDER BY size_bytes DESC
                LIMIT 20
                """,
                (session_id, hdd["path"], cutoff),
            ).fetchall()
            for r in rows:
                move_to_ssd.append({
                    "name": r["name"],
                    "path": r["path"],
                    "current_drive": hdd["path"],
                    "current_type": "HDD",
                    "suggested_drive": ssd_drives[0]["path"],
                    "suggested_type": "SSD",
                    "size_bytes": r["size_bytes"],
                    "reason": "Frequently accessed file found on HDD — moving to SSD will improve load times.",
                    "action_type": "move",
                })

        # Items ON SSD that should be ON HDD
        move_to_hdd: list[dict] = []

        for ssd in ssd_drives:
            # Large media files on SSD
            rows = conn.execute(
                """
                SELECT path, name, size_bytes, category, last_accessed, drive_path
                FROM files
                WHERE session_id=? AND drive_path=? AND category='Movies'
                  AND is_symlink=0 AND size_bytes > 104857600
                ORDER BY size_bytes DESC
                LIMIT 20
                """,
                (session_id, ssd["path"]),
            ).fetchall()
            for r in rows:
                move_to_hdd.append({
                    "name": r["name"],
                    "path": r["path"],
                    "current_drive": ssd["path"],
                    "current_type": "SSD",
                    "suggested_drive": hdd_drives[0]["path"],
                    "suggested_type": "HDD",
                    "size_bytes": r["size_bytes"],
                    "reason": "Large media file found on SSD — sequential reads don't benefit from SSD speed. Move to HDD to free up premium storage.",
                    "action_type": "move",
                })

            # Dormant/stale large files on SSD
            stale_cutoff = (datetime.now(timezone.utc) - timedelta(days=DORMANT_DAYS)).isoformat()
            rows = conn.execute(
                """
                SELECT path, name, size_bytes, category, last_accessed, drive_path
                FROM files
                WHERE session_id=? AND drive_path=? AND last_accessed < ?
                  AND is_symlink=0 AND size_bytes > 524288000
                ORDER BY size_bytes DESC
                LIMIT 20
                """,
                (session_id, ssd["path"], stale_cutoff),
            ).fetchall()
            for r in rows:
                move_to_hdd.append({
                    "name": r["name"],
                    "path": r["path"],
                    "current_drive": ssd["path"],
                    "current_type": "SSD",
                    "suggested_drive": hdd_drives[0]["path"],
                    "suggested_type": "HDD",
                    "size_bytes": r["size_bytes"],
                    "reason": f"Large file not accessed in over {DORMANT_DAYS} days — wasting SSD space. Move to HDD.",
                    "action_type": "move",
                })

        return {
            "applicable": True,
            "ssd_drives": ssd_drives,
            "hdd_drives": hdd_drives,
            "move_to_ssd": move_to_ssd[:10],
            "move_to_hdd": move_to_hdd[:10],
        }
    finally:
        conn.close()


def get_drive_optimization(session_id: int) -> dict:
    drives = list_drives()
    recs = _get_recommendations(session_id, drives)

    # SSD/HDD health from SMART (Windows WMI)
    smart_data = _get_smart_data()

    return {
        "recommendations": recs,
        "smart_data": smart_data,
        "drives": drives,
    }


def _get_smart_data() -> list[dict]:
    """Read S.M.A.R.T. data via WMI (Windows only)."""
    results = []
    try:
        import wmi
        c = wmi.WMI(namespace="root/wmi")
        for disk in c.MSStorageDriver_ATAPISmartData():
            results.append({
                "instance_name": getattr(disk, "InstanceName", "Unknown"),
                "vendor_specific": list(getattr(disk, "VendorSpecific", [])[:30]),
            })
    except Exception:
        pass
    return results
