# WindowsStorageSense

A modern Windows desktop utility that brings **WinDirStat + Revo Uninstaller + TreeSize + System Monitor** into a single, beautiful application — shipped as a proper NSIS installer like any market-grade software.

---

## Architecture

| Layer     | Technology |
|-----------|------------|
| Frontend  | Electron 30 + React 18 + Tailwind CSS + Recharts |
| Backend   | Python 3.11 FastAPI (local HTTP on `127.0.0.1:8765`) |
| Database  | SQLite (all data stays on-device, never leaves the machine) |
| Packaging | PyInstaller → one-directory bundle; electron-builder → NSIS installer |

### How the EXE works

```
WindowsStorageSense-Setup.exe   (NSIS installer)
 └─ installs →  WindowsStorageSense/
       ├─ WindowsStorageSense.exe      (Electron shell)
       └─ resources/
             ├─ app.asar               (React UI)
             └─ backend/              (PyInstaller bundle)
                   ├─ main.exe         (FastAPI + uvicorn)
                   └─ *.dll / *.pyd   (all Python C-extensions bundled)
```

On launch Electron starts `resources/backend/main.exe`, waits for it to respond on `/health`, then shows the main window.  No Python installation required on the end-user's machine.

---

## Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Dashboard** | Drive usage, storage breakdown pie chart, health score ring, quick wins |
| 2 | **Deep Analyzer** | Largest files, extension stats, age distribution, orphaned files, folder tree |
| 3 | **System Monitor** | Live CPU/RAM/disk I/O/network gauges + sparklines updated every 2 s |
| 4 | **File Explorer** | Browse, copy, cut, paste, rename, delete, search — fully keyboard-driven |
| 5 | **Smart Optimizer** | Empty folder finder, similar folder merger, C-drive hog analysis, SSD/HDD placement |
| 6 | **Media Organizer** | Detect, preview, and batch-organize photos/videos/music by date/type |
| 7 | **Downloads Manager** | Manage and clean the Downloads folder; delete stale items |
| 8 | **Junk Cleaner** | Windows temp, recycle bin, browser caches, log files — sends to Recycle Bin |
| 9 | **Duplicate Finder** | Content-hash deduplication; keeps original, removes copies |
| 10 | **Quick Transfer** | LAN/WiFi file transfer + internet upload (file.io) |
| 11 | **Startup Manager** | Disable/enable startup programs |
| 12 | **Uninstaller** | Remove apps + leftover registry/file artifacts |
| 13 | **Games Library** | Detect Steam/Origin games, show sizes |
| 14 | **Drive Advisor** | SSD vs HDD placement recommendations |
| 15 | **One-Click Cleanup** | Junk + empty folders removed in a single click |
| 16 | **HTML Report Export** | Self-contained analysis report opened in system browser |
| 17 | **Command Palette** | Ctrl+K fuzzy-search navigation across all pages |
| 18 | **Toast Notifications** | Success/error/warning/info slide-in toasts |
| 19 | **Error Boundary** | React crash boundary — shows "Try again" instead of white screen |
| 20 | **Tray Icon** | Runs in the system tray; minimize-to-tray instead of quit |

---

## Building a Windows Installer (EXE)

### Prerequisites (Windows)

- **Python 3.9+** — [python.org](https://www.python.org/downloads/)
- **Node.js 18+** — [nodejs.org](https://nodejs.org/)
- **Git**

### One-command build

```powershell
# From the repository root on Windows:
.\scripts\build-win.ps1
```

This will:
1. Install Pillow and generate `frontend/public/icon.ico` + `tray-icon.png`
2. Install Python deps + PyInstaller; compile `backend/dist/main/main.exe`
3. Install npm deps; build the React app with Vite
4. Run electron-builder to produce `frontend/dist-electron/WindowsStorageSense Setup 3.0.0.exe`

### Manual steps

```powershell
# 1. Generate icons
pip install Pillow
python scripts/generate-icon.py

# 2. Compile Python backend
cd backend
pip install -r requirements.txt pyinstaller
pyinstaller backend.spec --clean --noconfirm
cd ..

# 3. Build React frontend
cd frontend
npm install
npm run build:react
cd ..

# 4. Package with electron-builder
cd frontend
npm run build:electron
```

### GitHub Actions (automated releases)

Push a version tag to trigger an automated build and GitHub Release:

```bash
git tag v3.0.0
git push origin v3.0.0
```

The workflow in `.github/workflows/build.yml` builds on `windows-latest` and attaches the `.exe` installer to the release automatically.

---

## Development

```bash
# Install Python deps
pip install -r backend/requirements.txt

# Install npm deps
cd frontend && npm install && cd ..

# Run in dev mode (hot-reload React + live backend)
cd frontend && npm run dev
```

---

## Troubleshooting

### `build-win.ps1` is "not recognized as a cmdlet, function, script file, or operable program"

This error means PowerShell could not load the script. Two common causes:

**1. Wrong working directory**

You must run the script from the **repository root**, not from inside a sub-folder and not from a drive root:

```powershell
# Clone the repo, then cd into it:
git clone https://github.com/prasadamal/WindowsStorageSense.git
cd WindowsStorageSense

# Now run the build script:
.\scripts\build-win.ps1
```

**2. PowerShell execution policy blocks scripts**

Fresh Windows installations default to the `Restricted` execution policy, which prevents running any `.ps1` file.  Run this once in an **elevated** (Administrator) PowerShell window to allow local scripts:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

`RemoteSigned` lets you run local scripts (like this one) while still requiring downloaded scripts to be signed.  Re-run `.\scripts\build-win.ps1` after setting the policy.

**3. PowerShell version too old**

The build script requires **PowerShell 5.1 or later** (shipped with Windows 10/11).  Check your version with:

```powershell
$PSVersionTable.PSVersion
```

If you are on Windows 7/8 you may need to install [WMF 5.1](https://www.microsoft.com/en-us/download/details.aspx?id=54616).

---

## Security

- All data is stored locally in SQLite at `%LOCALAPPDATA%\WindowsStorageSense\`
- No telemetry, no network calls except local `127.0.0.1:8765`
- Deletions always go to the Windows Recycle Bin (via `send2trash`)
- System directories (`C:\Windows`, `C:\Program Files`, etc.) are permanently blocked from modification
