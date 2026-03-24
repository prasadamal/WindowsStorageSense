"""
Media Organizer — scan the filesystem and organize media files into the
standard Windows library folders (Music, Videos, Pictures).

Supports preview (dry-run) and live organization with collision handling.
"""

import os
import shutil
import pathlib
from datetime import datetime

# ---------------------------------------------------------------------------
# Extension → category mapping
# ---------------------------------------------------------------------------

MEDIA_EXTENSIONS: dict[str, set[str]] = {
    "Music": {
        ".mp3", ".flac", ".wav", ".aac", ".ogg", ".m4a", ".wma",
        ".opus", ".aiff", ".ape", ".alac",
    },
    "Videos": {
        ".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm",
        ".m4v", ".ts", ".mpg", ".mpeg", ".vob", ".3gp", ".rmvb",
    },
    "Pictures": {
        ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".tiff",
        ".tif", ".heic", ".heif", ".raw", ".cr2", ".nef", ".arw",
        ".dng", ".svg", ".ico",
    },
}

# Build a fast lookup table: extension → category
_EXT_TO_CATEGORY: dict[str, str] = {}
for _cat, _exts in MEDIA_EXTENSIONS.items():
    for _ext in _exts:
        _EXT_TO_CATEGORY[_ext] = _cat

# Standard Windows library locations
LIBRARY_PATHS: dict[str, pathlib.Path] = {
    "Music":    pathlib.Path.home() / "Music",
    "Videos":   pathlib.Path.home() / "Videos",
    "Pictures": pathlib.Path.home() / "Pictures",
}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _safe_stat_size(p: pathlib.Path) -> int:
    try:
        return p.stat().st_size
    except OSError:
        return 0


def _unique_dest(dest_dir: pathlib.Path, filename: str) -> pathlib.Path:
    """Return a collision-free destination path."""
    target = dest_dir / filename
    if not target.exists():
        return target
    stem = pathlib.Path(filename).stem
    suffix = pathlib.Path(filename).suffix
    n = 1
    while target.exists():
        target = dest_dir / f"{stem} ({n}){suffix}"
        n += 1
    return target


def _scan_for_media(
    scan_paths: list[str],
    categories: list[str] | None = None,
) -> dict[str, list[pathlib.Path]]:
    """Walk scan_paths and return categorised media file lists."""
    cats = set(categories or list(MEDIA_EXTENSIONS.keys()))
    found: dict[str, list[pathlib.Path]] = {c: [] for c in cats}

    # Absolute paths of standard library dirs — skip files already there
    lib_roots = {str(p).lower() for p in LIBRARY_PATHS.values()}

    for scan_path in scan_paths:
        p = pathlib.Path(scan_path)
        if not p.exists():
            continue
        for root, dirs, files in os.walk(p, followlinks=False):
            root_lower = root.lower()
            # Skip content already inside a library folder
            if any(root_lower.startswith(lr) for lr in lib_roots):
                dirs.clear()
                continue
            for filename in files:
                ext = pathlib.Path(filename).suffix.lower()
                cat = _EXT_TO_CATEGORY.get(ext)
                if cat and cat in cats:
                    found[cat].append(pathlib.Path(root) / filename)

    return found


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def preview_organization(
    scan_paths: list[str],
    categories: list[str] | None = None,
) -> dict:
    """
    Dry-run: return a preview of which files would be moved and where.
    Limits the item list to 200 per category to keep the response lean.
    """
    found = _scan_for_media(scan_paths, categories)
    result: dict = {}
    total_files = 0
    total_bytes = 0

    for cat, files in found.items():
        dest_dir = LIBRARY_PATHS[cat]
        cat_bytes = sum(_safe_stat_size(f) for f in files)
        preview_items = [
            {
                "path": str(f),
                "name": f.name,
                "size_bytes": _safe_stat_size(f),
                "destination": str(_unique_dest(dest_dir, f.name)),
            }
            for f in files[:200]
        ]
        result[cat] = {
            "count": len(files),
            "preview": preview_items,
            "total_bytes": cat_bytes,
            "destination": str(dest_dir),
        }
        total_files += len(files)
        total_bytes += cat_bytes

    return {
        "categories": result,
        "total_files": total_files,
        "total_bytes": total_bytes,
    }


def organize_media(
    scan_paths: list[str],
    categories: list[str] | None = None,
    dry_run: bool = False,
) -> dict:
    """
    Move media files to their respective library folders.

    If *dry_run* is True nothing is moved — only the planned operations
    are returned.
    """
    found = _scan_for_media(scan_paths, categories)
    results: dict = {}

    for cat, files in found.items():
        dest_dir = LIBRARY_PATHS[cat]
        if not dry_run:
            dest_dir.mkdir(parents=True, exist_ok=True)

        moved: list[dict] = []
        skipped: list[str] = []
        errors: list[str] = []

        for src in files:
            dest = _unique_dest(dest_dir, src.name)

            # If an identical file already exists at the default location, skip
            default_dest = dest_dir / src.name
            if (
                default_dest.exists()
                and _safe_stat_size(src) == _safe_stat_size(default_dest)
            ):
                skipped.append(str(src))
                continue

            op = {"from": str(src), "to": str(dest)}
            if dry_run:
                moved.append(op)
            else:
                try:
                    shutil.move(str(src), str(dest))
                    moved.append(op)
                except Exception as exc:
                    errors.append(f"{src}: {exc}")

        results[cat] = {
            "moved": len(moved),
            "skipped": len(skipped),
            "errors": errors,
            "destination": str(dest_dir),
            "operations": moved if dry_run else [],
        }

    return {"results": results, "dry_run": dry_run}


def get_library_stats() -> dict:
    """Return size statistics for each standard media library folder."""
    stats = {}
    for cat, lib_path in LIBRARY_PATHS.items():
        if not lib_path.exists():
            stats[cat] = {"path": str(lib_path), "exists": False, "count": 0, "size_bytes": 0}
            continue
        count = 0
        size = 0
        exts = MEDIA_EXTENSIONS[cat]
        for root, _, files in os.walk(lib_path):
            for f in files:
                if pathlib.Path(f).suffix.lower() in exts:
                    count += 1
                    try:
                        size += (pathlib.Path(root) / f).stat().st_size
                    except OSError:
                        pass
        stats[cat] = {
            "path": str(lib_path),
            "exists": True,
            "count": count,
            "size_bytes": size,
        }
    return stats
