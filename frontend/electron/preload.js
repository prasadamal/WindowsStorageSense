/**
 * Electron preload script — v3.0
 *
 * Exposes a typed API bridge to the renderer via contextBridge.
 * Nothing from Node/Electron leaks into the renderer directly.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  /** Base URL of the local FastAPI backend */
  getApiUrl: ()           => ipcRenderer.invoke('api-url'),

  /** Open a file path with the OS default application */
  openFile: (filePath)    => ipcRenderer.invoke('open-file', filePath),

  /** Reveal a file in Windows Explorer */
  showInFolder: (filePath) => ipcRenderer.invoke('show-item', filePath),

  /** Open a URL in the system browser */
  openExternal: (url)     => ipcRenderer.invoke('open-external', url),

  /** Download the HTML storage report and open it in the browser */
  openReport: ()          => ipcRenderer.invoke('open-report'),

  /** Application version string from package.json */
  getVersion: ()          => ipcRenderer.invoke('app-version'),

  /** Current OS platform */
  platform: process.platform,
});
