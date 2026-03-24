# WindowsStorageSense

A modern Windows desktop app that replaces the frustrating experience of Windows File Explorer and native storage management — combining what WinDirStat, Revo Uninstaller, TreeSize, and the Android Files app do into a single cohesive tool.

---

## Architecture

| Layer | Technology |
|-------|-----------|
| Frontend | Electron + React + Tailwind CSS |
| Backend | Python FastAPI (local HTTP API on port 8765) |
| Database | SQLite (local, all data stays on-device) |

---

## Features

| # | Feature | Status |
|---|---------|--------|
| 1 | Onboarding wizard (drive selection → mode → initial scan) | ✅ |
| 2 | Storage Dashboard (drives, categories, health score, quick wins) | ✅ |
| 3 | Disk Space Analyzer (treemap, top 50 files, progressive scan) | ✅ |
| 4 | Smart File Categorizer (Movies, Docs, Images, Music, etc.) | ✅ |
| 5 | Large File Spotlight (top 50 by size, cross-drive) | ✅ |
| 6 | Duplicate File Finder (size → 64KB partial hash → full MD5, perceptual hash for images) | ✅ |
| 7 | Stale File Detection (12-month threshold) | ✅ |
| 8 | Junk Cleaner (16 categories, user confirmation, Recycle Bin only) | ✅ |
| 9 | Smart Uninstaller (real folder sizes, leftover cleanup) | ✅ |
| 10 | Startup Manager (Registry, Startup folder, Task Scheduler) | ✅ |
| 11 | Game Library Detection (Steam, Epic, GOG, EA, Ubisoft, Xbox) | ✅ |
| 12 | Download Manager & Organizer (auto-organize, stale flagging) | ✅ |
| 13 | Media Library View | ⏳ Phase 4 |
| 14 | Smart File Explorer (dual pane, tabs, preview) | ⏳ Phase 5 |
| 15 | Scheduled Background Scanning + Tray Notifications | ✅ |
| 16 | Drive Optimization Advisor (SSD vs HDD intelligence) | ✅ |

---

## Safety Rules (Hardcoded)

- `C:\Windows`, `C:\Windows\System32`, `C:\Program Files`, `C:\Program Files (x86)` are permanently blocked from modification
- **All deletions go to the Windows Recycle Bin** — no permanent delete option
- Every deletion shows a preview confirmation screen before executing
- Duplicate detection uses **hash comparison only** — never filename similarity
- Symlinks are detected, flagged, and not followed recursively
- Paths >260 characters use the `\\?\` extended path prefix
- All scanning runs in background threads — UI always remains responsive

---

## Project Structure

```
WindowsStorageSense/
├── backend/                  # Python FastAPI backend
│   ├── main.py               # FastAPI app + all routes
│   ├── database.py           # SQLite schema & helpers
│   ├── scanner.py            # Async disk scanner
│   ├── categorizer.py        # File categorization
│   ├── duplicate_finder.py   # Three-stage duplicate detection
│   ├── stale_files.py        # Stale file detection
│   ├── junk_cleaner.py       # Junk categories & cleanup
│   ├── uninstaller.py        # Smart uninstaller
│   ├── startup_manager.py    # Startup items manager
│   ├── game_library.py       # Game library detection
│   ├── drive_optimizer.py    # SSD/HDD optimization advisor
│   ├── download_manager.py   # Downloads manager
│   ├── scheduler.py          # Background scan scheduler
│   ├── safety.py             # Safety rules enforcement
│   └── requirements.txt
└── frontend/                 # Electron + React frontend
    ├── electron/
    │   ├── main.js           # Electron main process
    │   └── preload.js        # IPC bridge
    ├── src/
    │   ├── App.jsx           # Main app with sidebar routing
    │   ├── api.js            # Axios API client
    │   ├── store/            # Zustand state management
    │   ├── pages/            # All page components
    │   │   ├── Dashboard.jsx
    │   │   ├── StorageAnalyzer.jsx
    │   │   ├── FilesPage.jsx
    │   │   ├── DuplicatesPage.jsx
    │   │   ├── JunkCleaner.jsx
    │   │   ├── UninstallerPage.jsx
    │   │   ├── StartupManager.jsx
    │   │   ├── GamesPage.jsx
    │   │   ├── DownloadsPage.jsx
    │   │   ├── DriveOptimizer.jsx
    │   │   ├── SettingsPage.jsx
    │   │   └── OnboardingPage.jsx
    │   └── utils.js          # formatBytes, colours, etc.
    ├── package.json
    ├── vite.config.js
    └── tailwind.config.js
```

---

## Getting Started

### Backend

```bash
cd backend
pip install -r requirements.txt
python main.py --host 127.0.0.1 --port 8765
```

### Frontend (development)

```bash
cd frontend
npm install
npm run dev
```

### Production build

```bash
cd frontend
npm run build    # Vite + electron-builder → .exe installer
```

---

## What Was NOT Built (Future Phases)

The following features were specified in the product brief but are deferred to future phases:

- **Media Library View** (Phase 4): OMDB/TMDB metadata enrichment, poster display, low-quality duplicate detection
- **Smart File Explorer** (Phase 5): Dual pane, tabbed navigation, preview panel, bulk rename, file tagging, fast indexed search
- **Code signing & SmartScreen whitelisting** (Phase 6): Requires a valid certificate purchase
- **AI/natural language features**: Explicitly out of scope per product brief
- **Cloud connectivity**: Explicitly out of scope per product brief
- **macOS/Linux support**: Windows-only per product brief

---

## Privacy

All file scanning and analysis happens **locally only**. No file names, paths, metadata, or any user data is transmitted externally. No telemetry of any kind is collected.

