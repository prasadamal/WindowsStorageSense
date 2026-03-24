"""
File Explorer module — browse and manage the filesystem.

Provides directory listing, file operations (create, rename, move, copy,
delete, open), quick-access locations, and clipboard-style cut/copy/paste.
"""

import os
import shutil
import pathlib
import subprocess
from datetime import datetime
from typing import Optional

from safety import is_blocked_path
import send2trash


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _format_entry(path: pathlib.Path) -> dict:
    """Return a normalised dict describing a single filesystem entry."""
    try:
        stat = path.stat()
        is_dir = path.is_dir()
        size = 0 if is_dir else stat.st_size
        modified = datetime.fromtimestamp(stat.st_mtime).isoformat()
    except (PermissionError, OSError):
        is_dir = path.is_dir()
        size = 0
        modified = ""

    ext = "" if is_dir else path.suffix.lower()
    return {
        "name": path.name,
        "path": str(path),
        "is_dir": is_dir,
        "size_bytes": size,
        "modified": modified,
        "extension": ext,
        "icon": _icon_for(path, is_dir, ext),
    }


def _icon_for(path: pathlib.Path, is_dir: bool, ext: str) -> str:
    if is_dir:
        return "folder"
    _image_exts = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".tiff", ".heic", ".svg", ".ico"}
    _video_exts = {".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm", ".m4v", ".ts", ".mpg", ".mpeg"}
    _audio_exts = {".mp3", ".flac", ".wav", ".aac", ".ogg", ".m4a", ".wma", ".opus"}
    _doc_exts   = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".md", ".csv"}
    _arch_exts  = {".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz"}
    _code_exts  = {".py", ".js", ".ts", ".jsx", ".tsx", ".html", ".css", ".json", ".xml", ".yaml", ".yml", ".sh", ".bat"}
    if ext in _image_exts:  return "image"
    if ext in _video_exts:  return "video"
    if ext in _audio_exts:  return "audio"
    if ext in _doc_exts:    return "document"
    if ext in _arch_exts:   return "archive"
    if ext in _code_exts:   return "code"
    if ext == ".exe":       return "exe"
    return "file"


# ---------------------------------------------------------------------------
# Directory listing
# ---------------------------------------------------------------------------

def list_directory(path: str, show_hidden: bool = False) -> dict:
    """List the contents of a directory, sorted folders-first."""
    p = pathlib.Path(path)
    if not p.exists():
        raise FileNotFoundError(f"Path not found: {path}")
    if not p.is_dir():
        raise NotADirectoryError(f"Not a directory: {path}")

    entries = []
    try:
        children = sorted(p.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower()))
        for child in children:
            if not show_hidden and child.name.startswith("."):
                continue
            entries.append(_format_entry(child))
    except PermissionError:
        pass

    # Build breadcrumbs (from root → current)
    breadcrumbs = []
    cur = p
    while True:
        breadcrumbs.insert(0, {"name": cur.name or str(cur), "path": str(cur)})
        parent = cur.parent
        if parent == cur:
            break
        cur = parent

    return {
        "path": str(p),
        "entries": entries,
        "breadcrumbs": breadcrumbs,
        "parent": str(p.parent) if p.parent != p else None,
        "total": len(entries),
    }


# ---------------------------------------------------------------------------
# Quick-access locations
# ---------------------------------------------------------------------------

def get_quick_access() -> list:
    """Return commonly used filesystem locations."""
    home = pathlib.Path.home()
    candidates = [
        ("Desktop",   home / "Desktop"),
        ("Documents", home / "Documents"),
        ("Downloads", home / "Downloads"),
        ("Music",     home / "Music"),
        ("Pictures",  home / "Pictures"),
        ("Videos",    home / "Videos"),
        ("OneDrive",  home / "OneDrive"),
    ]
    result = []
    for name, p in candidates:
        if p.exists():
            result.append({"name": name, "path": str(p)})
    return result


# ---------------------------------------------------------------------------
# File-system operations
# ---------------------------------------------------------------------------

def create_folder(parent_path: str, name: str) -> dict:
    """Create a new folder inside parent_path."""
    if is_blocked_path(parent_path):
        raise PermissionError(f"Blocked path: {parent_path}")
    new_dir = pathlib.Path(parent_path) / name
    new_dir.mkdir(parents=False, exist_ok=False)
    return _format_entry(new_dir)


def rename_item(path: str, new_name: str) -> dict:
    """Rename a file or folder (stays in the same directory)."""
    if is_blocked_path(path):
        raise PermissionError(f"Blocked path: {path}")
    p = pathlib.Path(path)
    new_path = p.parent / new_name
    p.rename(new_path)
    return _format_entry(new_path)


def move_items(paths: list, destination: str) -> dict:
    """Move files/folders to the destination directory."""
    dest = pathlib.Path(destination)
    moved, errors = [], []
    for src_path in paths:
        if is_blocked_path(src_path):
            errors.append(f"Blocked: {src_path}")
            continue
        try:
            src = pathlib.Path(src_path)
            target = dest / src.name
            # Handle name collision
            if target.exists():
                stem, suffix = src.stem, src.suffix
                n = 1
                while target.exists():
                    target = dest / f"{stem} ({n}){suffix}"
                    n += 1
            shutil.move(str(src), str(target))
            moved.append(src_path)
        except Exception as exc:
            errors.append(f"{src_path}: {exc}")
    return {"moved": moved, "errors": errors}


def copy_items(paths: list, destination: str) -> dict:
    """Copy files/folders to the destination directory."""
    dest = pathlib.Path(destination)
    copied, errors = [], []
    for src_path in paths:
        try:
            src = pathlib.Path(src_path)
            target = dest / src.name
            # Handle name collision
            if target.exists():
                stem, suffix = src.stem, src.suffix
                n = 1
                while target.exists():
                    target = dest / f"{stem} ({n}){suffix}"
                    n += 1
            if src.is_dir():
                shutil.copytree(str(src), str(target))
            else:
                shutil.copy2(str(src), str(target))
            copied.append(src_path)
        except Exception as exc:
            errors.append(f"{src_path}: {exc}")
    return {"copied": copied, "errors": errors}


def delete_items(paths: list) -> dict:
    """Send files/folders to the Recycle Bin."""
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
    return {"deleted": deleted, "errors": errors}


# ---------------------------------------------------------------------------
# File launching
# ---------------------------------------------------------------------------

def open_file(path: str) -> dict:
    """Open a file with its default application (os.startfile on Windows; xdg-open fallback on Linux/macOS)."""
    try:
        os.startfile(path)  # Windows-only – preferred method
        return {"opened": True}
    except AttributeError:
        # Fallback for non-Windows (testing)
        subprocess.Popen(["xdg-open", path])
        return {"opened": True}
    except Exception as exc:
        return {"opened": False, "error": str(exc)}


def open_in_explorer(path: str) -> dict:
    """Open Windows Explorer at the given path (or select the file)."""
    try:
        p = pathlib.Path(path)
        if p.is_file():
            subprocess.Popen(["explorer", "/select,", str(p)])
        else:
            subprocess.Popen(["explorer", str(p)])
        return {"opened": True}
    except Exception as exc:
        return {"opened": False, "error": str(exc)}


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------

def search_files(root_path: str, query: str, limit: int = 200) -> list:
    """Recursively search for files/folders matching the query string."""
    root = pathlib.Path(root_path)
    query_lower = query.lower()
    results = []
    try:
        for entry in root.rglob("*"):
            if query_lower in entry.name.lower():
                results.append(_format_entry(entry))
                if len(results) >= limit:
                    break
    except (PermissionError, OSError):
        pass
    return results
