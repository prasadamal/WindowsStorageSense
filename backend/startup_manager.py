"""
Startup Manager — reads startup items from all sources:
  1. Registry HKLM Run
  2. Registry HKCU Run
  3. Startup folder (per-user and all-users)
  4. Windows Task Scheduler (scheduled tasks at logon)

Requires elevation only for HKLM / Task Scheduler modifications.
Enable/disable toggle is supported.
"""

import os
import subprocess
from pathlib import Path
from typing import Optional

try:
    import winreg
    HAS_WINREG = True
except ImportError:
    HAS_WINREG = False

from database import get_connection


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

REG_RUN_PATHS = [
    ("HKLM", winreg.HKEY_LOCAL_MACHINE if HAS_WINREG else None,
     r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run"),
    ("HKLM_WOW", winreg.HKEY_LOCAL_MACHINE if HAS_WINREG else None,
     r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run"),
    ("HKCU", winreg.HKEY_CURRENT_USER if HAS_WINREG else None,
     r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run"),
    ("HKCU_RUN_ONCE", winreg.HKEY_CURRENT_USER if HAS_WINREG else None,
     r"SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce"),
]

DISABLED_REG_KEY = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"


def _impact_from_command(command: str) -> str:
    """Crude heuristic: large known-heavy apps → High, unknown → Medium."""
    heavy = ["teams", "onedrive", "skype", "discord", "slack", "zoom", "antivirus", "security"]
    low = ["update", "helper", "notify", "tray"]
    c = command.lower()
    if any(h in c for h in heavy):
        return "High"
    if any(l in c for l in low):
        return "Low"
    return "Medium"


def _read_registry_run(label: str, hive, key_path: str) -> list[dict]:
    if not HAS_WINREG or hive is None:
        return []
    items = []
    try:
        with winreg.OpenKey(hive, key_path, 0, winreg.KEY_READ) as key:
            i = 0
            while True:
                try:
                    name, value, _ = winreg.EnumValue(key, i)
                    i += 1
                    items.append(
                        {
                            "name": name,
                            "command": value,
                            "source": "registry",
                            "source_path": f"{label}\\{key_path}",
                            "enabled": True,
                            "impact": _impact_from_command(value),
                        }
                    )
                except OSError:
                    break
    except OSError:
        pass
    return items


def _read_startup_folder(path: str, source_label: str) -> list[dict]:
    items = []
    if not os.path.isdir(path):
        return items
    for entry in os.scandir(path):
        if entry.is_file():
            items.append(
                {
                    "name": entry.name,
                    "command": entry.path,
                    "source": "startup_folder",
                    "source_path": path,
                    "enabled": True,
                    "impact": "Medium",
                }
            )
    return items


def _read_scheduled_tasks_logon() -> list[dict]:
    """Use schtasks to list tasks that trigger at logon."""
    items = []
    try:
        result = subprocess.run(
            ["schtasks", "/Query", "/FO", "CSV", "/V"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        lines = result.stdout.splitlines()
        if len(lines) < 2:
            return items
        headers = [h.strip('"') for h in lines[0].split(",")]
        for line in lines[1:]:
            if '"At log on"' in line or "ONLOGON" in line.upper():
                cols = line.split(",")
                if len(cols) >= 2:
                    name = cols[0].strip('"').split("\\")[-1]
                    cmd = cols[1].strip('"') if len(cols) > 1 else ""
                    items.append(
                        {
                            "name": name,
                            "command": cmd,
                            "source": "task_scheduler",
                            "source_path": cols[0].strip('"'),
                            "enabled": True,
                            "impact": "Medium",
                        }
                    )
    except Exception:
        pass
    return items


def list_startup_items() -> list[dict]:
    """Collect startup items from all sources."""
    items: list[dict] = []

    # Registry Run keys
    for label, hive, path in REG_RUN_PATHS:
        items.extend(_read_registry_run(label, hive, path))

    # Startup folders
    user_startup = os.path.join(
        os.environ.get("APPDATA", ""),
        r"Microsoft\Windows\Start Menu\Programs\Startup",
    )
    all_startup = os.path.join(
        os.environ.get("ProgramData", r"C:\ProgramData"),
        r"Microsoft\Windows\Start Menu\Programs\StartUp",
    )
    items.extend(_read_startup_folder(user_startup, "Startup Folder (User)"))
    items.extend(_read_startup_folder(all_startup, "Startup Folder (All Users)"))

    # Scheduled tasks at logon
    items.extend(_read_scheduled_tasks_logon())

    # Persist
    conn = get_connection()
    try:
        conn.execute("DELETE FROM startup_items")
        for item in items:
            conn.execute(
                """
                INSERT INTO startup_items(name, command, source, source_path, enabled, impact)
                VALUES(?,?,?,?,?,?)
                """,
                (
                    item["name"],
                    item.get("command", ""),
                    item["source"],
                    item.get("source_path", ""),
                    1 if item.get("enabled", True) else 0,
                    item.get("impact", "Medium"),
                ),
            )
        conn.commit()
    finally:
        conn.close()

    return items


def toggle_startup_item(name: str, source_path: str, enabled: bool) -> dict:
    """Enable or disable a registry-based startup item."""
    if not HAS_WINREG:
        return {"success": False, "error": "winreg not available (non-Windows)"}
    try:
        if "HKLM" in source_path:
            hive = winreg.HKEY_LOCAL_MACHINE
            key_path = source_path.split("\\", 1)[1]
        else:
            hive = winreg.HKEY_CURRENT_USER
            key_path = source_path.split("\\", 1)[1] if "\\" in source_path else source_path

        if not enabled:
            # Move to disabled key
            with winreg.OpenKey(hive, key_path, 0, winreg.KEY_READ) as key:
                value, vtype = winreg.QueryValueEx(key, name)
            with winreg.OpenKey(hive, key_path, 0, winreg.KEY_WRITE) as key:
                winreg.DeleteValue(key, name)
            disabled_path = key_path.replace("Run", "Run_disabled")
            with winreg.CreateKey(hive, disabled_path) as key:
                winreg.SetValueEx(key, name, 0, winreg.REG_SZ, value)
        else:
            disabled_path = source_path.replace("Run", "Run_disabled").split("\\", 1)[1]
            with winreg.OpenKey(hive, disabled_path, 0, winreg.KEY_READ) as key:
                value, vtype = winreg.QueryValueEx(key, name)
            with winreg.OpenKey(hive, disabled_path, 0, winreg.KEY_WRITE) as key:
                winreg.DeleteValue(key, name)
            with winreg.CreateKey(hive, key_path) as key:
                winreg.SetValueEx(key, name, 0, winreg.REG_SZ, value)

        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}
