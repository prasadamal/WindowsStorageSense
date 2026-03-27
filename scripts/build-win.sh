#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# build-win.sh — Cross-platform build helper (Linux/macOS CI or Wine environment)
#
# Usage:
#   ./scripts/build-win.sh [--skip-icons] [--skip-pyinstaller] [--skip-frontend]
#
# This script mirrors build-win.ps1 but runs on Linux/macOS CI agents where
# the frontend can be built (Vite/Node) and PyInstaller output can be verified.
# The actual Windows .exe installer requires electron-builder to run on Windows
# or in a Wine environment. For pure CI artifact building use GitHub Actions.
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
SCRIPTS="$ROOT/scripts"

# Ensure Python can locate its own standard library.
# A stale or wrong PYTHONHOME/PYTHONPATH causes the fatal
# "Could not find platform independent libraries" error at startup.
# Unsetting them lets Python resolve its prefix from the executable location.
unset PYTHONHOME 2>/dev/null || true
unset PYTHONPATH 2>/dev/null || true

SKIP_ICONS=false
SKIP_PYINSTALLER=false
SKIP_FRONTEND=false

for arg in "$@"; do
  case $arg in
    --skip-icons)          SKIP_ICONS=true ;;
    --skip-pyinstaller)    SKIP_PYINSTALLER=true ;;
    --skip-frontend)       SKIP_FRONTEND=true ;;
  esac
done

step() { echo ""; echo "══ $1 ══"; }
ok()   { echo "  ✓ $1"; }
die()  { echo "✗ ERROR: $1"; exit 1; }

# ── Icons ────────────────────────────────────────────────────────────────────
if [ "$SKIP_ICONS" = false ]; then
  step "Generating icons"
  # Note: installs Pillow into the current Python environment.
  # In CI, this runs inside a fresh virtual env or container, so no conflicts.
  # For local development, use `python3 -m pip install Pillow` inside your own venv first.
  python3 -m pip install Pillow --quiet
  python3 "$SCRIPTS/generate-icon.py"
  ok "Icons generated"
fi

# ── Python backend ────────────────────────────────────────────────────────────
if [ "$SKIP_PYINSTALLER" = false ]; then
  step "Installing Python deps + PyInstaller"
  python3 -m pip install -r "$BACKEND/requirements.txt" --quiet
  python3 -m pip install pyinstaller --quiet
  ok "Python deps installed"

  step "Running PyInstaller"
  cd "$BACKEND"
  pyinstaller backend.spec --clean --noconfirm
  ok "Backend compiled"
  cd "$ROOT"
fi

# ── React frontend ────────────────────────────────────────────────────────────
if [ "$SKIP_FRONTEND" = false ]; then
  step "Installing npm deps"
  cd "$FRONTEND"
  npm install --silent
  ok "npm installed"

  step "Building React frontend"
  npm run build:react
  ok "Vite build done → frontend/dist/"
  cd "$ROOT"
fi

step "Build steps complete"
echo ""
echo "  Next: run 'electron-builder build --win' on a Windows machine"
echo "  or push a tag to trigger the GitHub Actions release workflow."
echo ""
