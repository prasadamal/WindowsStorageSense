"""
Internet Transfer — upload files to a temporary internet link.

Uses file.io: a free, zero-account API that returns a one-time download
URL (file expires after the configured period or first download).

Also provides a helper to launch the Windows Bluetooth File Transfer wizard.
"""

import pathlib
import subprocess

import httpx


# ---------------------------------------------------------------------------
# Internet upload via file.io
# ---------------------------------------------------------------------------

# file.io free plan limits
_MAX_FILE_BYTES = 2_147_483_648  # 2 GiB


async def upload_file(file_path: str, expires: str = "14d") -> dict:
    """
    Upload *file_path* to file.io and return the download link.

    Parameters
    ----------
    file_path : absolute path to an existing file
    expires   : expiry duration accepted by file.io — e.g. "1d", "7d", "14d"

    Returns
    -------
    On success: {"success": True, "url": "...", "expires": "...", "name": "...", "size_bytes": ...}
    On failure: {"error": "..."}
    """
    path = pathlib.Path(file_path)

    if not path.is_file():
        return {"error": f"Not a file: {file_path}"}

    try:
        size = path.stat().st_size
    except OSError as exc:
        return {"error": f"Cannot read file: {exc}"}

    if size > _MAX_FILE_BYTES:
        return {"error": "File exceeds the 2 GB limit for internet transfer."}

    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            with open(file_path, "rb") as fh:
                response = await client.post(
                    "https://file.io",
                    files={"file": (path.name, fh, "application/octet-stream")},
                    data={"expires": expires},
                )
        data = response.json()
        if data.get("success"):
            return {
                "success": True,
                "url": data.get("link") or data.get("url", ""),
                "expires": data.get("expires", expires),
                "name": path.name,
                "size_bytes": size,
            }
        return {"error": data.get("message", "Upload failed — please try again.")}
    except httpx.TimeoutException:
        return {"error": "Upload timed out. Check your internet connection."}
    except Exception as exc:
        return {"error": str(exc)}


# ---------------------------------------------------------------------------
# Bluetooth transfer (Windows built-in wizard)
# ---------------------------------------------------------------------------

def launch_bluetooth_send() -> dict:
    """
    Open the Windows Bluetooth File Transfer wizard (fsquirt.exe).

    The user selects the file and device inside the OS dialog.
    Works on Windows 7 through 11 with a paired Bluetooth device.
    """
    try:
        subprocess.Popen(["fsquirt"])
        return {"launched": True}
    except FileNotFoundError:
        return {
            "launched": False,
            "error": (
                "Bluetooth wizard (fsquirt.exe) not found. "
                "Ensure Windows Bluetooth is enabled and your device supports it."
            ),
        }
    except Exception as exc:
        return {"launched": False, "error": str(exc)}
