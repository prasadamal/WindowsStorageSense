/**
 * Electron preload script.
 * Exposes a safe API bridge to the renderer process via contextBridge.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  getApiUrl: () => ipcRenderer.invoke('api-url'),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  showInFolder: (filePath) => ipcRenderer.invoke('show-item', filePath),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  platform: process.platform,
});
