"""
Smart Uninstaller — reads installed apps from the Windows registry,
calculates real folder sizes, detects last-used date, and runs
the standard Windows uninstall process.

After uninstall, scans AppData, ProgramData, and the registry
for leftover files and registry entries.

Requires: pywin32 (winreg), send2trash
"""

import os
import subprocess
import winreg
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
# Registry helpers
# ---------------------------------------------------------------------------

UNINSTALL_KEYS = [
    (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
    (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"),
    (winreg.HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
]


def _read_reg_str(key, name: str, default: str = "") -> str:
    try:
        val, _ = winreg.QueryValueEx(key, name)
        return str(val)
    except OSError:
        return default


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


def _get_exe_last_used(install_location: str) -> Optional[str]:
    """Estimate last-used from the most recently accessed .exe in the install folder."""
    if not install_location or not os.path.isdir(install_location):
        return None
    latest = 0.0
    try:
        for root, _, files in os.walk(install_location):
            for f in files:
                if f.lower().endswith(".exe"):
                    try:
                        t = os.path.getatime(os.path.join(root, f))
                        if t > latest:
                            latest = t
                    except OSError:
                        pass
    except (PermissionError, OSError):
        pass
    if latest == 0:
        return None
    from datetime import datetime, timezone
    return datetime.fromtimestamp(latest, tz=timezone.utc).isoformat()


def list_installed_apps() -> list[dict]:
    apps = []
    seen: set[str] = set()

    for hive, key_path in UNINSTALL_KEYS:
        try:
            with winreg.OpenKey(hive, key_path) as key:
                i = 0
                while True:
                    try:
                        subkey_name = winreg.EnumKey(key, i)
                        i += 1
                        with winreg.OpenKey(key, subkey_name) as subkey:
                            name = _read_reg_str(subkey, "DisplayName")
                            if not name or name in seen:
                                continue
                            seen.add(name)

                            install_loc = _read_reg_str(subkey, "InstallLocation")
                            uninstall_cmd = _read_reg_str(subkey, "UninstallString")
                            publisher = _read_reg_str(subkey, "Publisher")
                            install_date = _read_reg_str(subkey, "InstallDate")
                            est_size_kb = 0
                            try:
                                est_size_kb, _ = winreg.QueryValueEx(subkey, "EstimatedSize")
                            except OSError:
                                pass

                            real_size = _dir_size(install_loc) if install_loc else 0
                            last_used = _get_exe_last_used(install_loc)

                            apps.append(
                                {
                                    "name": name,
                                    "install_location": install_loc,
                                    "uninstall_cmd": uninstall_cmd,
                                    "publisher": publisher,
                                    "install_date": install_date,
                                    "estimated_size_bytes": est_size_kb * 1024,
                                    "real_size_bytes": real_size,
                                    "last_used": last_used,
                                    "has_background": False,  # TODO: check services/tasks
                                }
                            )
                    except OSError:
                        break
        except OSError:
            continue

    return sorted(apps, key=lambda a: a.get("real_size_bytes", 0), reverse=True)


def uninstall_app(app_name: str, uninstall_cmd: str) -> dict:
    """Run the standard Windows uninstall process for the given app."""
    if not uninstall_cmd:
        return {"success": False, "error": "No uninstall command found"}
    try:
        result = subprocess.run(
            uninstall_cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=300,
        )
        return {
            "success": result.returncode == 0,
            "returncode": result.returncode,
            "stdout": result.stdout[-2000:],
            "stderr": result.stderr[-2000:],
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Uninstall timed out"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def find_leftovers(app_name: str, install_location: str) -> dict:
    """
    After uninstall, scan common locations for leftover files/registry entries.
    Returns findings for user confirmation — nothing is deleted automatically.
    """
    keywords = [w.lower() for w in app_name.replace("-", " ").split() if len(w) > 3]
    search_dirs = [
        os.path.join(os.environ.get("APPDATA", ""), ""),
        os.path.join(os.environ.get("LOCALAPPDATA", ""), ""),
        r"C:\ProgramData",
    ]
    if install_location:
        search_dirs.append(install_location)

    found_files: list[dict] = []
    for base in search_dirs:
        if not os.path.isdir(base):
            continue
        try:
            for entry in os.scandir(base):
                name_lower = entry.name.lower()
                if any(kw in name_lower for kw in keywords):
                    size = _dir_size(entry.path) if entry.is_dir(follow_symlinks=False) else 0
                    found_files.append(
                        {
                            "path": entry.path,
                            "is_dir": entry.is_dir(follow_symlinks=False),
                            "size_bytes": size,
                        }
                    )
        except (PermissionError, OSError):
            continue

    # Registry leftover scan
    reg_keys: list[dict] = []
    reg_search_paths = [
        (winreg.HKEY_CURRENT_USER, r"SOFTWARE"),
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE"),
    ]
    for hive, path in reg_search_paths:
        try:
            with winreg.OpenKey(hive, path) as key:
                i = 0
                while True:
                    try:
                        subkey_name = winreg.EnumKey(key, i)
                        i += 1
                        if any(kw in subkey_name.lower() for kw in keywords):
                            reg_keys.append(
                                {
                                    "hive": "HKCU" if hive == winreg.HKEY_CURRENT_USER else "HKLM",
                                    "path": f"{path}\\{subkey_name}",
                                }
                            )
                    except OSError:
                        break
        except OSError:
            continue

    return {
        "app_name": app_name,
        "leftover_files": found_files,
        "leftover_registry_keys": reg_keys,
        "total_leftover_bytes": sum(f["size_bytes"] for f in found_files),
    }


def delete_leftovers(paths: list[str]) -> dict:
    """Send leftover files/folders to Recycle Bin — never permanent delete."""
    if not HAS_SEND2TRASH:
        return {"error": "send2trash not available"}
    errors = []
    deleted = 0
    for p in paths:
        if is_blocked_path(p):
            errors.append(f"Blocked: {p}")
            continue
        try:
            send2trash.send2trash(p)
            deleted += 1
        except Exception as e:
            errors.append(f"{p}: {e}")
    return {"deleted_count": deleted, "errors": errors}
