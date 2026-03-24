"""
Game Library Detection.

Detects games installed via:
  • Steam      — libraryfolders.vdf
  • Epic Games — LauncherInstalled.dat
  • GOG Galaxy — registry
  • EA App     — registry / known paths
  • Ubisoft Connect — registry
  • Xbox/Microsoft Store — registry
  • Standalone — common install path scan

Games not launched in 90+ days are flagged.
"""

import json
import os
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

try:
    import winreg
    HAS_WINREG = True
except ImportError:
    HAS_WINREG = False

from database import get_connection


STALE_GAME_DAYS = 90


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


# ---------------------------------------------------------------------------
# Steam
# ---------------------------------------------------------------------------

def _detect_steam() -> list[dict]:
    games: list[dict] = []
    steam_paths = [
        r"C:\Program Files (x86)\Steam",
        r"C:\Program Files\Steam",
    ]
    # Check registry for Steam install path
    if HAS_WINREG:
        try:
            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE,
                                r"SOFTWARE\WOW6432Node\Valve\Steam") as k:
                path, _ = winreg.QueryValueEx(k, "InstallPath")
                steam_paths.insert(0, path)
        except OSError:
            pass

    for steam_root in steam_paths:
        vdf_path = os.path.join(steam_root, "steamapps", "libraryfolders.vdf")
        if not os.path.isfile(vdf_path):
            continue

        library_paths = [os.path.join(steam_root, "steamapps")]
        try:
            content = Path(vdf_path).read_text(encoding="utf-8", errors="ignore")
            # Parse library paths from VDF
            for m in re.finditer(r'"path"\s+"([^"]+)"', content):
                lib = os.path.join(m.group(1), "steamapps")
                if os.path.isdir(lib):
                    library_paths.append(lib)
        except OSError:
            pass

        for lib in library_paths:
            for acf in Path(lib).glob("appmanifest_*.acf"):
                try:
                    acf_content = acf.read_text(encoding="utf-8", errors="ignore")
                    name_m = re.search(r'"name"\s+"([^"]+)"', acf_content)
                    install_dir_m = re.search(r'"installdir"\s+"([^"]+)"', acf_content)
                    appid_m = re.search(r'"appid"\s+"([^"]+)"', acf_content)
                    if not name_m:
                        continue
                    name = name_m.group(1)
                    install_dir = os.path.join(lib, "common", install_dir_m.group(1)) if install_dir_m else lib
                    app_id = appid_m.group(1) if appid_m else ""
                    size = _dir_size(install_dir)
                    last_played = _exe_last_access(install_dir)
                    games.append({
                        "name": name, "platform": "Steam", "install_path": install_dir,
                        "size_bytes": size, "last_played": last_played, "app_id": app_id,
                        "is_stale": _is_stale(last_played),
                    })
                except OSError:
                    continue
        break  # found a valid steam root

    return games


def _exe_last_access(install_dir: str) -> Optional[str]:
    if not os.path.isdir(install_dir):
        return None
    latest = 0.0
    try:
        for root, _, files in os.walk(install_dir):
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
    return datetime.fromtimestamp(latest, tz=timezone.utc).isoformat()


def _is_stale(last_played: Optional[str]) -> bool:
    if not last_played:
        return True
    try:
        dt = datetime.fromisoformat(last_played)
        return (datetime.now(timezone.utc) - dt).days > STALE_GAME_DAYS
    except ValueError:
        return True


# ---------------------------------------------------------------------------
# Epic Games
# ---------------------------------------------------------------------------

def _detect_epic() -> list[dict]:
    games: list[dict] = []
    dat_paths = [
        os.path.join(
            os.environ.get("ProgramData", r"C:\ProgramData"),
            r"Epic\UnrealEngineLauncher\LauncherInstalled.dat",
        )
    ]
    for dat in dat_paths:
        if not os.path.isfile(dat):
            continue
        try:
            data = json.loads(Path(dat).read_text(encoding="utf-8"))
            for item in data.get("InstallationList", []):
                name = item.get("AppName", "Unknown")
                install_dir = item.get("InstallLocation", "")
                size = _dir_size(install_dir)
                last_played = _exe_last_access(install_dir)
                games.append({
                    "name": name, "platform": "Epic", "install_path": install_dir,
                    "size_bytes": size, "last_played": last_played, "app_id": name,
                    "is_stale": _is_stale(last_played),
                })
        except (json.JSONDecodeError, OSError):
            pass
    return games


# ---------------------------------------------------------------------------
# GOG Galaxy
# ---------------------------------------------------------------------------

def _detect_gog() -> list[dict]:
    games: list[dict] = []
    if not HAS_WINREG:
        return games
    gog_keys = [
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\GOG.com\Games"),
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\GOG.com\Games"),
    ]
    for hive, base_path in gog_keys:
        try:
            with winreg.OpenKey(hive, base_path) as base:
                i = 0
                while True:
                    try:
                        game_id = winreg.EnumKey(base, i)
                        i += 1
                        with winreg.OpenKey(base, game_id) as gk:
                            def rv(name, default=""):
                                try:
                                    v, _ = winreg.QueryValueEx(gk, name)
                                    return str(v)
                                except OSError:
                                    return default

                            name = rv("GAMENAME")
                            install_dir = rv("PATH")
                            if not name:
                                continue
                            size = _dir_size(install_dir)
                            last_played = _exe_last_access(install_dir)
                            games.append({
                                "name": name, "platform": "GOG", "install_path": install_dir,
                                "size_bytes": size, "last_played": last_played, "app_id": game_id,
                                "is_stale": _is_stale(last_played),
                            })
                    except OSError:
                        break
        except OSError:
            continue
    return games


# ---------------------------------------------------------------------------
# EA App
# ---------------------------------------------------------------------------

def _detect_ea() -> list[dict]:
    games: list[dict] = []
    ea_paths = [
        r"C:\Program Files\EA Games",
        os.path.join(os.environ.get("ProgramFiles", r"C:\Program Files"), "EA Games"),
    ]
    for base in ea_paths:
        if not os.path.isdir(base):
            continue
        try:
            for entry in os.scandir(base):
                if entry.is_dir():
                    size = _dir_size(entry.path)
                    last_played = _exe_last_access(entry.path)
                    games.append({
                        "name": entry.name, "platform": "EA", "install_path": entry.path,
                        "size_bytes": size, "last_played": last_played, "app_id": entry.name,
                        "is_stale": _is_stale(last_played),
                    })
        except (PermissionError, OSError):
            pass
    return games


# ---------------------------------------------------------------------------
# Ubisoft Connect
# ---------------------------------------------------------------------------

def _detect_ubisoft() -> list[dict]:
    games: list[dict] = []
    if not HAS_WINREG:
        return games
    try:
        with winreg.OpenKey(
            winreg.HKEY_LOCAL_MACHINE,
            r"SOFTWARE\WOW6432Node\Ubisoft\Launcher\Installs",
        ) as base:
            i = 0
            while True:
                try:
                    game_id = winreg.EnumKey(base, i)
                    i += 1
                    with winreg.OpenKey(base, game_id) as gk:
                        try:
                            install_dir, _ = winreg.QueryValueEx(gk, "InstallDir")
                        except OSError:
                            continue
                        name = Path(install_dir).name
                        size = _dir_size(install_dir)
                        last_played = _exe_last_access(install_dir)
                        games.append({
                            "name": name, "platform": "Ubisoft", "install_path": install_dir,
                            "size_bytes": size, "last_played": last_played, "app_id": game_id,
                            "is_stale": _is_stale(last_played),
                        })
                except OSError:
                    break
    except OSError:
        pass
    return games


# ---------------------------------------------------------------------------
# Xbox / Microsoft Store
# ---------------------------------------------------------------------------

def _detect_xbox() -> list[dict]:
    """Read Xbox/MS Store game installs from the registry."""
    games: list[dict] = []
    if not HAS_WINREG:
        return games
    try:
        with winreg.OpenKey(
            winreg.HKEY_LOCAL_MACHINE,
            r"SOFTWARE\Microsoft\GamingServices\PackageRepository\Root",
        ) as base:
            i = 0
            while True:
                try:
                    pkg = winreg.EnumKey(base, i)
                    i += 1
                    with winreg.OpenKey(base, pkg) as pk:
                        try:
                            install_dir, _ = winreg.QueryValueEx(pk, "Root")
                        except OSError:
                            continue
                        name = pkg.split("_")[0]
                        size = _dir_size(install_dir)
                        last_played = _exe_last_access(install_dir)
                        games.append({
                            "name": name, "platform": "Xbox", "install_path": install_dir,
                            "size_bytes": size, "last_played": last_played, "app_id": pkg,
                            "is_stale": _is_stale(last_played),
                        })
                except OSError:
                    break
    except OSError:
        pass
    return games


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def detect_all_games() -> list[dict]:
    all_games: list[dict] = []
    all_games.extend(_detect_steam())
    all_games.extend(_detect_epic())
    all_games.extend(_detect_gog())
    all_games.extend(_detect_ea())
    all_games.extend(_detect_ubisoft())
    all_games.extend(_detect_xbox())

    # Persist to DB
    conn = get_connection()
    try:
        conn.execute("DELETE FROM game_library")
        for g in all_games:
            conn.execute(
                """
                INSERT INTO game_library(name, platform, install_path, size_bytes, last_played, app_id)
                VALUES(?,?,?,?,?,?)
                """,
                (g["name"], g["platform"], g["install_path"],
                 g["size_bytes"], g.get("last_played"), g.get("app_id", "")),
            )
        conn.commit()
    finally:
        conn.close()

    return sorted(all_games, key=lambda g: g.get("size_bytes", 0), reverse=True)


def get_games_from_db() -> list[dict]:
    conn = get_connection()
    try:
        rows = conn.execute("SELECT * FROM game_library ORDER BY size_bytes DESC").fetchall()
        now = datetime.now(timezone.utc)
        result = []
        for r in rows:
            d = dict(r)
            if r["last_played"]:
                try:
                    dt = datetime.fromisoformat(r["last_played"])
                    d["is_stale"] = (now - dt).days > STALE_GAME_DAYS
                except ValueError:
                    d["is_stale"] = True
            else:
                d["is_stale"] = True
            result.append(d)
        return result
    finally:
        conn.close()


def get_total_game_size() -> int:
    conn = get_connection()
    try:
        row = conn.execute("SELECT SUM(size_bytes) as total FROM game_library").fetchone()
        return row["total"] or 0
    finally:
        conn.close()
