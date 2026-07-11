import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  loadData: () => ipcRenderer.invoke('db:load'),
  saveData: (data: any) => ipcRenderer.invoke('db:save', data),
})
