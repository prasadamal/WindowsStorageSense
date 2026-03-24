"""
Deep File Analyzer — comprehensive filesystem analysis.

Features:
 1. Largest files ranking with categories
 2. Extension statistics (count + size per extension)
 3. File age distribution (last-modified buckets)
 4. Orphaned file detection (stray installers, logs, crash dumps)
 5. Folder size tree for treemap visualization
"""

import os
import re
import pathlib
from collections import defaultdict
from datetime import datetime, timezone
from typing import Optional

from safety import is_blocked_path


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe_stat(p: pathlib.Path) -> tuple[int, float]:
    """Return (size_bytes, mtime) without raising."""
    try:
        st = p.stat()
        return st.st_size, st.st_mtime
    except OSError:
        return 0, 0.0


def _categorize(ext: str) -> str:
    _IMAGE = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".tiff", ".heic", ".svg", ".raw"}
    _VIDEO = {".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm", ".m4v", ".ts", ".mpg"}
    _AUDIO = {".mp3", ".flac", ".wav", ".aac", ".ogg", ".m4a", ".wma", ".opus", ".aiff"}
    _DOC   = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".md", ".csv"}
    _ARCH  = {".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz"}
    if ext in _IMAGE:                   return "Images"
    if ext in _VIDEO:                   return "Videos"
    if ext in _AUDIO:                   return "Music"
    if ext in _DOC:                     return "Documents"
    if ext in _ARCH:                    return "Archives"
    if ext in {".exe", ".msi", ".pkg"}: return "Applications"
    return "Other"


# ---------------------------------------------------------------------------
# 1. Largest files
# ---------------------------------------------------------------------------

def get_largest_files(root_paths: list[str], limit: int = 100) -> list[dict]:
    """Walk root_paths and return the top *limit* files sorted by size."""
    items: list[tuple[int, pathlib.Path, float]] = []

    for root_str in root_paths:
        root = pathlib.Path(root_str)
        if not root.exists():
            continue
        try:
            for entry in root.rglob("*"):
                if not entry.is_file():
                    continue
                if is_blocked_path(str(entry)):
                    continue
                size, mtime = _safe_stat(entry)
                if size > 0:
                    items.append((size, entry, mtime))
        except (PermissionError, OSError):
            pass

    items.sort(key=lambda x: x[0], reverse=True)

    results: list[dict] = []
    for size, entry, mtime in items[:limit]:
        ext = entry.suffix.lower()
        modified = ""
        if mtime:
            try:
                modified = datetime.fromtimestamp(mtime).isoformat()
            except (OSError, OverflowError):
                pass
        results.append({
            "path": str(entry),
            "name": entry.name,
            "size_bytes": size,
            "extension": ext,
            "category": _categorize(ext),
            "modified": modified,
        })
    return results


# ---------------------------------------------------------------------------
# 2. Extension statistics
# ---------------------------------------------------------------------------

def get_extension_stats(root_paths: list[str]) -> list[dict]:
    """Count files and total size per file extension."""
    stats: dict[str, dict] = defaultdict(lambda: {"count": 0, "size_bytes": 0})

    for root_str in root_paths:
        root = pathlib.Path(root_str)
        if not root.exists():
            continue
        try:
            for entry in root.rglob("*"):
                if not entry.is_file():
                    continue
                if is_blocked_path(str(entry)):
                    continue
                ext = entry.suffix.lower() or "(no ext)"
                size, _ = _safe_stat(entry)
                stats[ext]["count"] += 1
                stats[ext]["size_bytes"] += size
        except (PermissionError, OSError):
            pass

    result = [{"extension": ext, **data} for ext, data in stats.items()]
    return sorted(result, key=lambda x: x["size_bytes"], reverse=True)


# ---------------------------------------------------------------------------
# 3. File age distribution
# ---------------------------------------------------------------------------

_AGE_BUCKETS: list[tuple[str, int]] = [
    ("< 1 month",   30),
    ("1–3 months",  90),
    ("3–6 months",  180),
    ("6–12 months", 365),
    ("1–2 years",   730),
    ("2–5 years",   1825),
    ("> 5 years",   999_999),
]


def get_age_distribution(root_paths: list[str]) -> list[dict]:
    """Bucket all files by how long ago they were last modified."""
    now = datetime.now(timezone.utc).timestamp()
    buckets: dict[str, dict] = {
        label: {"count": 0, "size_bytes": 0}
        for label, _ in _AGE_BUCKETS
    }

    for root_str in root_paths:
        root = pathlib.Path(root_str)
        if not root.exists():
            continue
        try:
            for entry in root.rglob("*"):
                if not entry.is_file():
                    continue
                if is_blocked_path(str(entry)):
                    continue
                size, mtime = _safe_stat(entry)
                age_days = (now - mtime) / 86400 if mtime else 999_999
                for label, max_days in _AGE_BUCKETS:
                    if age_days <= max_days:
                        buckets[label]["count"] += 1
                        buckets[label]["size_bytes"] += size
                        break
        except (PermissionError, OSError):
            pass

    return [{"age": label, **data} for label, data in buckets.items()]


# ---------------------------------------------------------------------------
# 4. Orphaned file detection
# ---------------------------------------------------------------------------

_SAFE_INSTALLER_PARENTS = {
    "downloads", "installers", "setup", "install", "packages",
}

_ORPHAN_STRAY_EXTS = {
    ".log":  "Log file",
    ".tmp":  "Temp file",
    ".temp": "Temp file",
    ".dmp":  "Crash dump",
    ".chk":  "Disk check artifact",
    ".bak":  "Backup file",
    ".old":  "Old/replaced file",
}

_INSTALLER_PATTERNS = [
    re.compile(r"setup[\s\-_]?.*\.exe$",  re.IGNORECASE),
    re.compile(r"install[\s\-_]?.*\.exe$", re.IGNORECASE),
    re.compile(r".*[\s\-_]setup\.exe$",   re.IGNORECASE),
    re.compile(r"unins\d+\.exe$",          re.IGNORECASE),
]


def find_orphaned_files(root_paths: list[str], limit: int = 200) -> list[dict]:
    """
    Locate files that are likely safe to delete:
    - Setup/installer .exe files outside designated installer directories
    - .log, .tmp, .dmp, .bak, .old files anywhere outside system dirs
    """
    results: list[dict] = []

    for root_str in root_paths:
        root = pathlib.Path(root_str)
        if not root.exists():
            continue
        try:
            for entry in root.rglob("*"):
                if not entry.is_file():
                    continue
                if is_blocked_path(str(entry)):
                    continue

                ext = entry.suffix.lower()
                parent_name = entry.parent.name.lower()
                reason: Optional[str] = None

                # Stray installers
                if ext in {".exe", ".msi"}:
                    if parent_name not in _SAFE_INSTALLER_PARENTS:
                        for pat in _INSTALLER_PATTERNS:
                            if pat.match(entry.name):
                                reason = "Stray installer"
                                break

                # Log / temp / dump files
                if not reason and ext in _ORPHAN_STRAY_EXTS:
                    reason = _ORPHAN_STRAY_EXTS[ext]

                if reason:
                    size, mtime = _safe_stat(entry)
                    modified = ""
                    if mtime:
                        try:
                            modified = datetime.fromtimestamp(mtime).isoformat()
                        except (OSError, OverflowError):
                            pass
                    results.append({
                        "path": str(entry),
                        "name": entry.name,
                        "size_bytes": size,
                        "reason": reason,
                        "extension": ext,
                        "modified": modified,
                    })
                    if len(results) >= limit:
                        break
        except (PermissionError, OSError):
            pass

        if len(results) >= limit:
            break

    return sorted(results, key=lambda x: x["size_bytes"], reverse=True)


# ---------------------------------------------------------------------------
# 5. Folder size tree (for treemap)
# ---------------------------------------------------------------------------

def get_folder_tree(root_path: str, depth: int = 3) -> dict:
    """
    Build a recursive folder-size tree up to *depth* levels.
    The returned structure is compatible with recharts <Treemap>.
    Each node: { name, path, size, children? }
    """
    root = pathlib.Path(root_path)
    if not root.exists():
        return {"name": root_path, "path": root_path, "size": 0}

    def _build(p: pathlib.Path, rem: int) -> dict:
        node: dict = {"name": p.name or str(p), "path": str(p)}

        if not p.is_dir() or rem == 0:
            size, _ = _safe_stat(p)
            node["size"] = size
            return node

        children: list[dict] = []
        dir_total = 0
        try:
            for child in sorted(p.iterdir(), key=lambda x: x.name.lower()):
                if is_blocked_path(str(child)):
                    continue
                child_node = _build(child, rem - 1)
                cs = child_node.get("size", 0)
                dir_total += cs
                if cs > 0:
                    children.append(child_node)
        except (PermissionError, OSError):
            pass

        node["size"] = dir_total
        if children:
            node["children"] = children
        return node

    return _build(root, depth)


# ---------------------------------------------------------------------------
# 6. Comprehensive summary (single API call)
# ---------------------------------------------------------------------------

def analyze(root_paths: list[str], top_files: int = 50) -> dict:
    """Run all analyses and return a combined result dict."""
    return {
        "largest_files": get_largest_files(root_paths, limit=top_files),
        "extension_stats": get_extension_stats(root_paths)[:30],
        "age_distribution": get_age_distribution(root_paths),
        "orphaned_files": find_orphaned_files(root_paths, limit=100),
    }
