import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'

// Force the French locale to display date and time pickers in DD/MM/YYYY format
app.commandLine.appendSwitch('lang', 'fr');

const storageDir = path.join(os.homedir(), '.taskflow');
const dbPath = path.join(storageDir, 'db.json');

// Ensure directory exists
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

// IPC Handlers
ipcMain.handle('db:load', async () => {
  try {
    if (fs.existsSync(dbPath)) {
      const content = fs.readFileSync(dbPath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.error('Failed to load database file', e);
  }
  return null;
});

ipcMain.handle('db:save', async (_, data: any) => {
  try {
    let existingData = {};
    if (fs.existsSync(dbPath)) {
      try {
        const content = fs.readFileSync(dbPath, 'utf-8');
        existingData = JSON.parse(content);
      } catch (err) {
        // ignore parsing errors
      }
    }
    const mergedData = { ...existingData, ...data };
    fs.writeFileSync(dbPath, JSON.stringify(mergedData, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('Failed to save database file', e);
    return false;
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 700,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
