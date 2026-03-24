"""
Safety rules — permanently hardcoded, non-negotiable.
These paths and behaviours cannot be changed by any user setting.
"""

import os
from pathlib import Path

# Paths that are PERMANENTLY blocked from modification or deletion
BLOCKED_PATHS: list[str] = [
    r"C:\Windows",
    r"C:\Windows\System32",
    r"C:\Program Files",
    r"C:\Program Files (x86)",
]


def is_blocked_path(path: str) -> bool:
    """Return True if the given path falls inside a blocked location."""
    # Normalise separators to backslash for Windows path comparison
    norm = path.replace("/", "\\").rstrip("\\").lower()
    for blocked in BLOCKED_PATHS:
        blocked_norm = blocked.rstrip("\\").lower()
        if norm == blocked_norm or norm.startswith(blocked_norm + "\\"):
            return True
    # Also block hidden system partitions (drive roots that are not the user's data drive)
    try:
        p = Path(path)
        if p.stat().st_file_attributes & 0x2:  # FILE_ATTRIBUTE_HIDDEN
            if p.parent == p:  # root of a drive
                return True
    except (AttributeError, OSError):
        pass
    return False


def enforce_extended_path(path: str) -> str:
    r"""
    Prepend \\?\ extended path prefix for paths longer than 260 characters.
    Required on Windows to handle long paths.
    """
    if len(path) > 260 and not path.startswith("\\\\?\\"):
        return "\\\\?\\" + path
    return path


def is_symlink_safe(path: str) -> bool:
    """Return True if the path is NOT a recursive / dangerous symlink."""
    try:
        real = os.path.realpath(path)
        return not real.startswith(path)  # simple guard against self-referential loops
    except OSError:
        return False
