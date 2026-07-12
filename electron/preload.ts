import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  loadData: () => ipcRenderer.invoke('db:load'),
  saveData: (data: any) => ipcRenderer.invoke('db:save', data),
})

contextBridge.exposeInMainWorld('titlebarAPI', {
  minimize: () => ipcRenderer.send('titlebar:minimize'),
  maximizeToggle: () => ipcRenderer.send('titlebar:maximize-toggle'),
  close: () => ipcRenderer.send('titlebar:close'),
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => {
    const handler = (_event: any, isMaximized: boolean) => callback(isMaximized);
    ipcRenderer.on('titlebar:maximized-state', handler);
    return () => {
      ipcRenderer.off('titlebar:maximized-state', handler);
    };
  },
  getMaximizedState: () => ipcRenderer.invoke('titlebar:get-maximized-state'),
})
