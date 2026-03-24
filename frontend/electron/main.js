/**
 * Electron main process.
 * Spawns the Python FastAPI backend, loads the React app, and manages the tray icon.
 */

const { app, BrowserWindow, Tray, Menu, shell, ipcMain, nativeImage } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

const isDev = process.env.NODE_ENV === 'development';
const API_PORT = 8765;
const API_URL = `http://127.0.0.1:${API_PORT}`;

let mainWindow = null;
let tray = null;
let pythonProcess = null;

// ---------------------------------------------------------------------------
// Python backend
// ---------------------------------------------------------------------------

function startPythonBackend() {
  const pythonExe = isDev
    ? (process.platform === 'win32' ? 'python' : 'python3')
    : path.join(process.resourcesPath, 'backend', 'dist', 'main', 'main.exe');

  const scriptPath = isDev
    ? path.join(__dirname, '..', '..', 'backend', 'main.py')
    : null;

  const args = isDev
    ? [scriptPath, '--host', '127.0.0.1', '--port', String(API_PORT)]
    : ['--host', '127.0.0.1', '--port', String(API_PORT)];

  const cmd = isDev ? pythonExe : pythonExe;

  try {
    pythonProcess = spawn(cmd, args, {
      stdio: 'pipe',
      windowsHide: true,
    });

    pythonProcess.stdout.on('data', (d) => console.log('[backend]', d.toString().trim()));
    pythonProcess.stderr.on('data', (d) => console.error('[backend]', d.toString().trim()));
    pythonProcess.on('exit', (code) => {
      console.log(`[backend] exited with code ${code}`);
      pythonProcess = null;
    });
  } catch (err) {
    console.error('Failed to start Python backend:', err);
  }
}

function stopPythonBackend() {
  if (pythonProcess) {
    pythonProcess.kill();
    pythonProcess = null;
  }
}

// ---------------------------------------------------------------------------
// Wait for backend to be ready
// ---------------------------------------------------------------------------

function waitForBackend(retries = 30, interval = 1000) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      http.get(`${API_URL}/health`, (res) => {
        if (res.statusCode === 200) resolve();
        else if (n > 0) setTimeout(() => attempt(n - 1), interval);
        else reject(new Error('Backend did not start'));
      }).on('error', () => {
        if (n > 0) setTimeout(() => attempt(n - 1), interval);
        else reject(new Error('Backend unreachable'));
      });
    };
    attempt(retries);
  });
}

// ---------------------------------------------------------------------------
// Browser window
// ---------------------------------------------------------------------------

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1366,
    minHeight: 768,
    title: 'WindowsStorageSense',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0f172a',
      symbolColor: '#94a3b8',
      height: 32,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.on('close', (e) => {
    // Minimize to tray instead of closing
    e.preventDefault();
    mainWindow.hide();
  });
}

// ---------------------------------------------------------------------------
// Tray icon
// ---------------------------------------------------------------------------

function createTray() {
  const iconPath = path.join(__dirname, '..', 'public', 'tray-icon.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });

  tray = new Tray(icon);
  tray.setToolTip('WindowsStorageSense');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open WindowsStorageSense', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.exit(0); } },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => { mainWindow.show(); mainWindow.focus(); });
}

// ---------------------------------------------------------------------------
// IPC handlers
// ---------------------------------------------------------------------------

ipcMain.handle('api-url', () => API_URL);

ipcMain.handle('open-file', async (_, filePath) => {
  return shell.openPath(filePath);
});

ipcMain.handle('show-item', async (_, filePath) => {
  shell.showItemInFolder(filePath);
});

ipcMain.handle('open-external', async (_, url) => {
  shell.openExternal(url);
});

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(async () => {
  startPythonBackend();

  try {
    await waitForBackend();
  } catch (err) {
    console.error('Backend startup timeout:', err.message);
  }

  createWindow();
  createTray();
});

app.on('before-quit', () => {
  stopPythonBackend();
  if (mainWindow) {
    mainWindow.removeAllListeners('close');
    mainWindow.close();
  }
});

app.on('window-all-closed', () => {
  // Keep running in tray on Windows
  if (process.platform !== 'darwin') return;
  app.quit();
});
