"""
Smart Optimizer — AI-driven filesystem intelligence.

Features:
 1. Empty folder detection & bulk removal
 2. Similar/duplicate folder detection & merge
 3. C: drive space-recovery advisor (find large moveable data)
 4. SSD vs HDD placement intelligence
 5. Scattered media file consolidation finder
"""

import os
import re
import shutil
import pathlib
import platform
import subprocess
from collections import defaultdict
from difflib import SequenceMatcher
from typing import Optional

import psutil
import send2trash

from safety import is_blocked_path


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _dir_size(p: pathlib.Path) -> int:
    """Recursively sum file sizes under a directory."""
    total = 0
    try:
        for entry in p.rglob("*"):
            if entry.is_file():
                try:
                    total += entry.stat().st_size
                except OSError:
                    pass
    except (PermissionError, OSError):
        pass
    return total


def _human(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.0f} {unit}"
        n /= 1024
    return f"{n:.1f} TB"


def _is_truly_empty(p: pathlib.Path) -> bool:
    """Return True iff the directory contains no files at any depth."""
    try:
        return not any(entry.is_file() for entry in p.rglob("*"))
    except (PermissionError, OSError):
        return False


# ---------------------------------------------------------------------------
# 1. Empty folder detection
# ---------------------------------------------------------------------------

def scan_empty_folders(root_paths: list[str]) -> list[dict]:
    """Walk root_paths and return all directories that contain no files."""
    results: list[dict] = []
    seen: set[str] = set()

    for root_str in root_paths:
        root = pathlib.Path(root_str)
        if not root.exists():
            continue
        try:
            for dirpath, dirs, files in os.walk(root, topdown=False):
                p = pathlib.Path(dirpath)
                if str(p) in seen:
                    continue
                if is_blocked_path(str(p)):
                    continue
                if not files and _is_truly_empty(p):
                    results.append({
                        "path": str(p),
                        "name": p.name,
                        "parent": str(p.parent),
                    })
                    seen.add(str(p))
        except (PermissionError, OSError):
            pass

    return results


def delete_empty_folders(paths: list[str]) -> dict:
    """Send empty folders to the Recycle Bin."""
    deleted, errors = [], []
    for path in paths:
        if is_blocked_path(path):
            errors.append(f"Blocked: {path}")
            continue
        try:
            send2trash.send2trash(path)
            deleted.append(path)
        except Exception as exc:
            errors.append(f"{path}: {exc}")
    return {"deleted": len(deleted), "errors": errors}


# ---------------------------------------------------------------------------
# 2. Similar / duplicate folder detection
# ---------------------------------------------------------------------------

# Common synonyms that users scatter across drives
_SYNONYM_GROUPS: list[frozenset[str]] = [
    frozenset(["movie", "movies", "film", "films", "cinema", "video", "videos"]),
    frozenset(["music", "song", "songs", "audio", "mp3", "tracks", "track"]),
    frozenset(["picture", "pictures", "photo", "photos", "image", "images", "gallery"]),
    frozenset(["document", "documents", "docs", "doc", "work", "files"]),
    frozenset(["download", "downloads"]),
    frozenset(["backup", "backups", "bak", "archive", "archives"]),
    frozenset(["game", "games", "gaming"]),
    frozenset(["book", "books", "ebook", "ebooks", "reading"]),
]


def _synonym_key(name: str) -> Optional[str]:
    n_full = name.lower().strip()
    for group in _SYNONYM_GROUPS:
        if n_full in group:
            return "|".join(sorted(group))
    return None


def _name_similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def find_similar_folders(root_paths: list[str]) -> list[dict]:
    """
    Find groups of folders that likely contain the same kind of content,
    e.g. 'Movies' and 'Films' on separate drives.
    """
    # Collect all immediate subdirectories from each root
    all_dirs: list[pathlib.Path] = []
    for root_str in root_paths:
        root = pathlib.Path(root_str)
        if not root.exists():
            continue
        try:
            for child in root.iterdir():
                if child.is_dir() and not is_blocked_path(str(child)):
                    all_dirs.append(child)
        except (PermissionError, OSError):
            pass

    # Group by synonym key
    by_key: dict[str, list[pathlib.Path]] = defaultdict(list)
    for d in all_dirs:
        key = _synonym_key(d.name)
        if key:
            by_key[key].append(d)

    # Also cluster by string similarity (≥ 0.82) for names not in synonym list
    unkeyed = [d for d in all_dirs if not _synonym_key(d.name)]
    sim_groups: list[list[pathlib.Path]] = []
    used: set[int] = set()
    for i, da in enumerate(unkeyed):
        if i in used:
            continue
        group = [da]
        used.add(i)
        for j, db in enumerate(unkeyed):
            if j in used or j <= i:
                continue
            if _name_similarity(da.name, db.name) >= 0.82:
                group.append(db)
                used.add(j)
        if len(group) > 1:
            sim_groups.append(group)

    groups: list[dict] = []

    for key, dirs in by_key.items():
        if len(dirs) > 1:
            groups.append({
                "reason": "synonym_names",
                "label": f"Similar name group",
                "folders": [
                    {"path": str(d), "name": d.name, "size_bytes": _dir_size(d)}
                    for d in dirs
                ],
            })

    for grp in sim_groups:
        groups.append({
            "reason": "similar_name",
            "label": "Similar folder names",
            "folders": [
                {"path": str(d), "name": d.name, "size_bytes": _dir_size(d)}
                for d in grp
            ],
        })

    return groups


def merge_folders(source: str, destination: str, dry_run: bool = True) -> dict:
    """
    Move all files from *source* into *destination*, preserving sub-directory
    structure, with collision-safe renaming.
    """
    src = pathlib.Path(source)
    dst = pathlib.Path(destination)

    if not src.exists():
        return {"error": f"Source not found: {source}"}
    if is_blocked_path(source) or is_blocked_path(destination):
        return {"error": "Blocked system path — merge refused"}

    moved: list[dict] = []
    errors: list[str] = []

    for item in src.rglob("*"):
        if not item.is_file():
            continue
        rel = item.relative_to(src)
        target = dst / rel
        # Collision-safe naming
        if target.exists():
            stem, suffix = target.stem, target.suffix
            n = 1
            while target.exists():
                target = target.parent / f"{stem} ({n}){suffix}"
                n += 1
        op = {"from": str(item), "to": str(target)}
        if dry_run:
            moved.append(op)
        else:
            try:
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(item), str(target))
                moved.append(op)
            except Exception as exc:
                errors.append(f"{item}: {exc}")

    if not dry_run and not errors:
        try:
            shutil.rmtree(str(src))
        except Exception as exc:
            errors.append(f"Could not remove source dir: {exc}")

    return {
        "moved": len(moved),
        "operations": moved if dry_run else [],
        "errors": errors,
        "dry_run": dry_run,
    }


# ---------------------------------------------------------------------------
# 3. C: drive space-recovery advisor
# ---------------------------------------------------------------------------

_SYSTEM_DIR_NAMES: set[str] = {
    "windows", "program files", "program files (x86)", "programdata",
    "$recycle.bin", "system volume information", "recovery", "boot",
    "perflogs", "msocache",
}

_MOVEABLE_HOME_DIRS = [
    "Documents", "Downloads", "Videos", "Music", "Pictures",
    "Desktop", "OneDrive", "3D Objects", "Saved Games",
]


def get_c_drive_hogs(min_size_mb: int = 100, top_n: int = 25) -> list[dict]:
    """
    Find large non-system directories on C: drive that are candidates
    for moving to another drive to free up system-drive space.
    """
    min_bytes = min_size_mb * 1_048_576
    home = pathlib.Path.home()
    candidates: list[pathlib.Path] = []

    # 1. Standard user data directories
    for name in _MOVEABLE_HOME_DIRS:
        p = home / name
        if p.exists():
            candidates.append(p)

    # 2. Top-level folders on C: that aren't system
    c_drive = pathlib.Path("C:\\")
    if c_drive.exists():
        try:
            for child in c_drive.iterdir():
                if child.is_dir() and child.name.lower() not in _SYSTEM_DIR_NAMES:
                    candidates.append(child)
        except (PermissionError, OSError):
            pass

    seen: set[str] = set()
    results: list[dict] = []

    for path in candidates:
        if str(path) in seen:
            continue
        seen.add(str(path))
        size = _dir_size(path)
        if size >= min_bytes:
            results.append({
                "path": str(path),
                "name": path.name,
                "parent": str(path.parent),
                "size_bytes": size,
                "size_human": _human(size),
                "moveable": True,
            })

    results.sort(key=lambda x: x["size_bytes"], reverse=True)
    return results[:top_n]


# ---------------------------------------------------------------------------
# 4. SSD vs HDD placement intelligence
# ---------------------------------------------------------------------------

def _detect_drive_type(mountpoint: str) -> str:
    """Best-effort: return 'SSD', 'HDD', or 'Unknown'."""
    if platform.system() != "Windows":
        return "Unknown"
    try:
        drive_letter = pathlib.Path(mountpoint).drive  # e.g. 'C:'
        if not drive_letter:
            return "Unknown"
        # Query WMI via PowerShell — no wmi module dependency
        ps = (
            f"$disk = Get-Partition -DriveLetter '{drive_letter[0]}' "
            "-ErrorAction SilentlyContinue | Get-Disk -ErrorAction SilentlyContinue; "
            "if ($disk) { $disk.MediaType } else { 'Unknown' }"
        )
        result = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps],
            capture_output=True, text=True, timeout=5,
        )
        output = result.stdout.strip()
        if "SSD" in output:
            return "SSD"
        if "HDD" in output or "Unspecified" in output or "Fixed" in output:
            return "HDD"
    except Exception:
        pass
    return "Unknown"


def get_drive_placement_advice() -> dict:
    """
    Inspect all drives, classify SSD vs HDD, and produce recommendations:
    - Move large media files from SSD → HDD
    - Consider pinning frequently-used data to SSD
    """
    drives: list[dict] = []
    for part in psutil.disk_partitions(all=False):
        try:
            usage = psutil.disk_usage(part.mountpoint)
            drives.append({
                "path": part.mountpoint,
                "device": part.device,
                "fstype": part.fstype,
                "total_bytes": usage.total,
                "used_bytes": usage.used,
                "free_bytes": usage.free,
                "percent_used": round(usage.percent, 1),
                "drive_type": _detect_drive_type(part.mountpoint),
            })
        except OSError:
            pass

    ssds = [d for d in drives if d["drive_type"] == "SSD"]
    hdds = [d for d in drives if d["drive_type"] == "HDD"]
    recommendations: list[dict] = []

    _LARGE_MEDIA_EXTS = {
        ".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm",
        ".m4v", ".iso", ".img",
    }

    if ssds and hdds:
        large_on_ssd: list[dict] = []
        for ssd in ssds:
            try:
                for entry in pathlib.Path(ssd["path"]).rglob("*"):
                    if not entry.is_file():
                        continue
                    if entry.suffix.lower() not in _LARGE_MEDIA_EXTS:
                        continue
                    if is_blocked_path(str(entry)):
                        continue
                    try:
                        sz = entry.stat().st_size
                        if sz > 524_288_000:  # > 500 MB
                            large_on_ssd.append({
                                "path": str(entry),
                                "name": entry.name,
                                "size_bytes": sz,
                                "from_drive": ssd["path"],
                                "suggested_drive": hdds[0]["path"],
                            })
                    except OSError:
                        pass
                    if len(large_on_ssd) >= 30:
                        break
            except (PermissionError, OSError):
                pass

        if large_on_ssd:
            total_bytes = sum(f["size_bytes"] for f in large_on_ssd)
            recommendations.append({
                "type": "move_media_to_hdd",
                "title": "Move large media files from SSD to HDD",
                "description": (
                    f"{len(large_on_ssd)} large video/image files "
                    f"({_human(total_bytes)}) occupy your SSD. "
                    "Moving them to HDD frees SSD space and may improve system performance."
                ),
                "files": large_on_ssd,
                "potential_savings": total_bytes,
            })
        else:
            recommendations.append({
                "type": "ok",
                "title": "SSD looks optimally used",
                "description": "No large media files detected on your SSD. Good placement!",
                "files": [],
                "potential_savings": 0,
            })
    elif ssds:
        recommendations.append({
            "type": "info",
            "title": "SSD only — consider adding an HDD",
            "description": "All your drives are SSDs. Consider adding a large HDD for media storage.",
            "files": [],
            "potential_savings": 0,
        })
    else:
        recommendations.append({
            "type": "info",
            "title": "Drive type detection not available",
            "description": (
                "Could not determine SSD vs HDD type. "
                "Run on Windows with PowerShell for full drive analysis."
            ),
            "files": [],
            "potential_savings": 0,
        })

    return {"drives": drives, "recommendations": recommendations}


# ---------------------------------------------------------------------------
# 5. Scattered file finder
# ---------------------------------------------------------------------------

_SCATTER_MEDIA_EXTS = {
    ".mp3", ".flac", ".wav", ".aac", ".ogg", ".m4a",   # music
    ".mp4", ".mkv", ".avi", ".mov", ".wmv",              # video
    ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp",    # images
}

_LIBRARY_PATHS = {
    "Music":    pathlib.Path.home() / "Music",
    "Videos":   pathlib.Path.home() / "Videos",
    "Pictures": pathlib.Path.home() / "Pictures",
}


def find_scattered_files(root_paths: list[str], limit: int = 200) -> list[dict]:
    """
    Find media files that live outside the standard library folders,
    i.e. scattered across random directories.
    """
    lib_strs = {str(p).lower() for p in _LIBRARY_PATHS.values()}
    results: list[dict] = []

    for root_str in root_paths:
        root = pathlib.Path(root_str)
        if not root.exists():
            continue
        try:
            for entry in root.rglob("*"):
                if not entry.is_file():
                    continue
                if entry.suffix.lower() not in _SCATTER_MEDIA_EXTS:
                    continue
                if is_blocked_path(str(entry)):
                    continue
                # Skip if already inside a library dir
                entry_lower = str(entry).lower()
                if any(entry_lower.startswith(lib) for lib in lib_strs):
                    continue
                try:
                    size = entry.stat().st_size
                except OSError:
                    size = 0

                # Determine where it should go
                ext = entry.suffix.lower()
                if ext in {".mp3", ".flac", ".wav", ".aac", ".ogg", ".m4a"}:
                    suggested = str(_LIBRARY_PATHS["Music"])
                elif ext in {".mp4", ".mkv", ".avi", ".mov", ".wmv"}:
                    suggested = str(_LIBRARY_PATHS["Videos"])
                else:
                    suggested = str(_LIBRARY_PATHS["Pictures"])

                results.append({
                    "path": str(entry),
                    "name": entry.name,
                    "size_bytes": size,
                    "extension": ext,
                    "suggested_destination": suggested,
                })
                if len(results) >= limit:
                    break
        except (PermissionError, OSError):
            pass
        if len(results) >= limit:
            break

    return sorted(results, key=lambda x: x["size_bytes"], reverse=True)
