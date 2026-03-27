<#
.SYNOPSIS
    End-to-end Windows build script for WindowsStorageSense.
    Produces a single NSIS installer: dist/WindowsStorageSense-Setup.exe

.DESCRIPTION
    Steps performed:
      1. Generate icon.ico / tray-icon.png via Pillow
      2. Compile Python backend with PyInstaller -> backend/dist/main/main.exe
      3. Build React frontend with Vite -> frontend/dist/
      4. Package everything with electron-builder -> NSIS installer

.USAGE
    # From the repository root:
    .\scripts\build-win.ps1

    # Skip specific steps (for re-runs):
    .\scripts\build-win.ps1 -SkipIcons -SkipPyInstaller

.NOTES
    Requirements:
      - Python 3.9+ in PATH
      - Node.js 18+ in PATH
      - python -m pip install pyinstaller Pillow (done automatically)
      - npm install (done automatically)
#>

param(
    [switch]$SkipIcons,
    [switch]$SkipPyInstaller,
    [switch]$SkipFrontend,
    [switch]$SkipElectron
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = Split-Path $PSScriptRoot -Parent
$BackendDir  = Join-Path $Root 'backend'
$FrontendDir = Join-Path $Root 'frontend'
$ScriptsDir  = Join-Path $Root 'scripts'

function Step([string]$msg) {
    Write-Host ""
    Write-Host "--------------------------------------------------" -ForegroundColor Cyan
    Write-Host "  $msg" -ForegroundColor White
    Write-Host "--------------------------------------------------" -ForegroundColor Cyan
}

function Die([string]$msg) {
    Write-Host "[X] ERROR: $msg" -ForegroundColor Red
    exit 1
}

function Ok([string]$msg) {
    Write-Host "  [OK] $msg" -ForegroundColor Green
}

# -- Ensure Python can locate its own standard library -------------------------
# A stale or wrong PYTHONHOME/PYTHONPATH causes the fatal
# "Could not find platform independent libraries" error at Python startup.
# Clearing them lets Python resolve its prefix from the executable location.
Remove-Item Env:PYTHONHOME  -ErrorAction SilentlyContinue
Remove-Item Env:PYTHONPATH  -ErrorAction SilentlyContinue

# -- 0. Sanity checks ----------------------------------------------------------

Step "Checking prerequisites"

$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) { Die "Python not found in PATH." }
Ok "Python: $(python --version)"

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Die "Node.js not found in PATH." }
Ok "Node.js: $(node --version)"

# -- 1. Icons -----------------------------------------------------------------

if (-not $SkipIcons) {
    Step "Generating icons"
    python -m pip install Pillow --quiet
    python "$ScriptsDir\generate-icon.py"
    if ($LASTEXITCODE -ne 0) { Die "Icon generation failed." }
    Ok "Icons written to frontend/public/"
}

# -- 2. PyInstaller (Python backend -> main.exe) --------------------------------

if (-not $SkipPyInstaller) {
    Step "Installing Python dependencies"
    python -m pip install -r "$BackendDir\requirements.txt" --quiet
    python -m pip install pyinstaller --quiet
    Ok "Python deps installed"

    Step "Compiling Python backend with PyInstaller"
    Set-Location $BackendDir
    pyinstaller backend.spec --clean --noconfirm
    if ($LASTEXITCODE -ne 0) { Die "PyInstaller failed." }
    Ok "Backend compiled -> backend/dist/main/main.exe"
    Set-Location $Root
}

# -- 3. React/Vite frontend ----------------------------------------------------

if (-not $SkipFrontend) {
    Step "Installing npm dependencies"
    Set-Location $FrontendDir
    npm install --silent
    if ($LASTEXITCODE -ne 0) { Die "npm install failed." }
    Ok "npm packages installed"

    Step "Building React frontend"
    npm run build:react
    if ($LASTEXITCODE -ne 0) { Die "Vite build failed." }
    Ok "Frontend built -> frontend/dist/"
    Set-Location $Root
}

# -- 4. Electron Builder (NSIS installer) -------------------------------------

if (-not $SkipElectron) {
    Step "Building Windows installer with electron-builder"
    Set-Location $FrontendDir
    npx electron-builder build --win
    if ($LASTEXITCODE -ne 0) { Die "electron-builder failed." }
    Ok "Installer built -> frontend/dist-electron/"
    Set-Location $Root
}

# -- Done ----------------------------------------------------------------------

Step "Build complete!"
$installer = Get-ChildItem "$FrontendDir\dist-electron\*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($installer) {
    Write-Host ""
    Write-Host "  [EXE] Installer: $($installer.FullName)" -ForegroundColor Yellow
    Write-Host "  [Size] Size:      $([math]::Round($installer.Length / 1MB, 1)) MB" -ForegroundColor Yellow
}
Write-Host ""
