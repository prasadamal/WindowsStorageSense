/**
 * Electron main process — WindowsStorageSense v3.0
 *
 * Startup sequence:
 *   1. Show splash window immediately (zero perceived wait)
 *   2. Spawn the PyInstaller-compiled backend (or python in dev)
 *   3. Poll /health until the backend is ready (max ~30 s)
 *   4. Create the main BrowserWindow, show it, close splash
 *   5. Create system-tray icon
 */

const {
  app, BrowserWindow, Tray, Menu, shell, ipcMain,
  nativeImage, dialog,
} = require('electron');
const path    = require('path');
const { spawn } = require('child_process');
const http    = require('http');
const fs      = require('fs');

const isDev     = process.env.NODE_ENV === 'development';
const API_PORT  = 8765;
const API_URL   = `http://127.0.0.1:${API_PORT}`;

let mainWindow   = null;
let splashWindow = null;
let tray         = null;
let pythonProcess = null;

// ---------------------------------------------------------------------------
// Resolve paths that differ between dev and packaged exe
// ---------------------------------------------------------------------------

/**
 * In production the electron-builder `extraResources` rule copies the
 * PyInstaller one-directory bundle  (backend/dist/main/)  into the app's
 * resources folder.  The resulting layout on-disk is:
 *
 *   resources/
 *     backend/          ← `from: ../backend/dist/main`  `to: backend`
 *       main.exe        ← PyInstaller entry-point
 *       *.dll / *.pyd   ← bundled C extensions
 *       …
 */
function resolvePythonExe() {
  if (isDev) {
    return process.platform === 'win32' ? 'python' : 'python3';
  }
  return path.join(process.resourcesPath, 'backend', 'main.exe');
}

function resolvePythonArgs() {
  if (isDev) {
    const script = path.join(__dirname, '..', '..', 'backend', 'main.py');
    return [script, '--host', '127.0.0.1', '--port', String(API_PORT)];
  }
  return ['--host', '127.0.0.1', '--port', String(API_PORT)];
}

// ---------------------------------------------------------------------------
// Splash window
// ---------------------------------------------------------------------------

function createSplash() {
  splashWindow = new BrowserWindow({
    width:  380,
    height: 320,
    frame:      false,
    transparent: false,
    resizable:  false,
    alwaysOnTop: true,
    center:     true,
    backgroundColor: '#080f1e',
    skipTaskbar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
}

function setSplashProgress(pct, msg) {
  if (!splashWindow || splashWindow.isDestroyed()) return;
  splashWindow.webContents.executeJavaScript(
    `window.postMessage(${JSON.stringify({ pct, msg })}, '*')`,
  ).catch(() => {});
}

function closeSplash() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
}

// ---------------------------------------------------------------------------
// Python backend
// ---------------------------------------------------------------------------

function startPythonBackend() {
  const exe  = resolvePythonExe();
  const args = resolvePythonArgs();

  if (!isDev && !fs.existsSync(exe)) {
    dialog.showErrorBox(
      'Backend not found',
      `The compiled backend executable was not found.\n\nExpected:\n${exe}\n\n` +
      'Please reinstall the application.',
    );
    app.exit(1);
    return;
  }

  try {
    pythonProcess = spawn(exe, args, {
      stdio: 'pipe',
      windowsHide: true,
      detached: false,
    });

    pythonProcess.stdout.on('data', (d) => console.log('[backend]', d.toString().trim()));
    pythonProcess.stderr.on('data', (d) => console.error('[backend]', d.toString().trim()));
    pythonProcess.on('exit', (code, signal) => {
      console.log(`[backend] exited — code ${code}, signal ${signal}`);
      pythonProcess = null;
    });
    pythonProcess.on('error', (err) => {
      console.error('[backend] spawn error:', err);
      dialog.showErrorBox('Backend error', `Failed to start backend:\n${err.message}`);
    });
  } catch (err) {
    console.error('Failed to spawn backend:', err);
  }
}

function stopPythonBackend() {
  if (pythonProcess) {
    try { pythonProcess.kill(); } catch {}
    pythonProcess = null;
  }
}

// ---------------------------------------------------------------------------
// Wait for backend to respond on /health
// ---------------------------------------------------------------------------

function waitForBackend(retries = 40, interval = 750) {
  return new Promise((resolve, reject) => {
    let attempt = 0;
    const try_ = () => {
      attempt++;
      const pct = Math.min(85, 10 + attempt * 2);
      setSplashProgress(pct, `Starting backend… (${attempt})`);

      http.get(`${API_URL}/health`, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else if (attempt < retries) {
          setTimeout(try_, interval);
        } else {
          reject(new Error(`Backend returned ${res.statusCode}`));
        }
      }).on('error', () => {
        if (attempt < retries) {
          setTimeout(try_, interval);
        } else {
          reject(new Error('Backend did not start in time'));
        }
      });
    };
    try_();
  });
}

// ---------------------------------------------------------------------------
// Main window
// ---------------------------------------------------------------------------

function createMainWindow() {
  mainWindow = new BrowserWindow({
    // Default window dimensions: 1366×820 matches common laptop screens (1366×768+).
    // minWidth/minHeight: smallest usable size where all sidebar items remain visible.
    width:     1366,
    height:    820,
    minWidth:  1024,
    minHeight: 680,
    title: 'WindowsStorageSense',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Allow local file: loads and the local API
      webSecurity: !isDev,
    },
    show: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color:       '#080f1e',
      symbolColor: '#94a3b8',
      height:      32,
    },
    icon: resolveIcon(),
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    setSplashProgress(100, 'Ready!');
    setTimeout(() => {
      closeSplash();
      mainWindow.show();
      mainWindow.focus();
    }, 300);
  });

  mainWindow.on('close', (e) => {
    // Minimize to tray instead of quitting
    if (!app.isQuiting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Open any external links in the system browser
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });
}

// ---------------------------------------------------------------------------
// Tray icon
// ---------------------------------------------------------------------------

function resolveIcon() {
  const candidates = [
    path.join(__dirname, '..', 'public', 'icon.ico'),
    path.join(__dirname, '..', 'public', 'icon.png'),
    path.join(process.resourcesPath || '', 'icon.ico'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

function createTray() {
  const trayIconPath = (() => {
    const candidates = [
      path.join(__dirname, '..', 'public', 'tray-icon.png'),
      path.join(process.resourcesPath || '', 'tray-icon.png'),
    ];
    for (const p of candidates) if (fs.existsSync(p)) return p;
    return null;
  })();

  const icon = trayIconPath
    ? nativeImage.createFromPath(trayIconPath).resize({ width: 16, height: 16 })
    : nativeImage.createEmpty();

  tray = new Tray(icon);
  tray.setToolTip('WindowsStorageSense — Storage Intelligence');

  const menu = Menu.buildFromTemplate([
    {
      label: 'Open WindowsStorageSense',
      click: () => { mainWindow.show(); mainWindow.focus(); },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuiting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(menu);
  tray.on('double-click', () => { mainWindow.show(); mainWindow.focus(); });
}

// ---------------------------------------------------------------------------
// IPC handlers
// ---------------------------------------------------------------------------

ipcMain.handle('api-url',        ()         => API_URL);
ipcMain.handle('open-file',      (_, p)     => shell.openPath(p));
ipcMain.handle('show-item',      (_, p)     => shell.showItemInFolder(p));
ipcMain.handle('open-external',  (_, url)   => shell.openExternal(url));
ipcMain.handle('app-version',    ()         => app.getVersion());

// ── Download report HTML to a temp file and open in browser ────────────────
ipcMain.handle('open-report', async () => {
  const os   = require('os');
  const http_ = require('http');
  const dest  = path.join(os.tmpdir(), 'storage-sense-report.html');

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    http_.get(`${API_URL}/report/export`, (res) => {
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        shell.openExternal('file://' + dest);
        resolve(dest);
      });
    }).on('error', reject);
  });
});

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(async () => {
  // Show splash immediately so users see feedback right away
  createSplash();
  setSplashProgress(5, 'Initialising…');

  // Start backend
  setSplashProgress(10, 'Starting backend…');
  startPythonBackend();

  // Wait until healthy
  try {
    await waitForBackend();
  } catch (err) {
    closeSplash();
    const choice = dialog.showMessageBoxSync({
      type:    'error',
      title:   'StorageSense — Startup Error',
      message: 'The backend failed to start.',
      detail:  `${err.message}\n\nPlease restart the application. If the problem persists, reinstall StorageSense.`,
      buttons: ['Restart', 'Quit'],
    });
    if (choice === 0) {
      app.relaunch();
    }
    app.exit(1);
    return;
  }

  setSplashProgress(90, 'Loading interface…');
  createMainWindow();
  createTray();
});

app.on('before-quit', () => {
  app.isQuiting = true;
  stopPythonBackend();
});

app.on('window-all-closed', () => {
  // On Windows/Linux keep running in tray; on macOS, quit
  if (process.platform === 'darwin') app.quit();
});

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}
