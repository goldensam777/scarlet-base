import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'

// Force the French locale to display date and time pickers in DD/MM/YYYY format
app.commandLine.appendSwitch('lang', 'fr');

const oldStorageDir = path.join(os.homedir(), '.taskflow');
const oldDbPath = path.join(oldStorageDir, 'db.json');
const storageDir = path.join(os.homedir(), '.scarletbase');
const dbPath = path.join(storageDir, 'db.json');

// Ensure directory exists and perform automatic migration if needed
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

if (fs.existsSync(oldDbPath) && !fs.existsSync(dbPath)) {
  try {
    fs.copyFileSync(oldDbPath, dbPath);
    console.log('Migrated database from .taskflow to .scarletbase successfully.');
  } catch (e) {
    console.error('Failed to migrate database from .taskflow:', e);
  }
}

// Génération automatique du fichier .desktop sous Linux (Wayland / GNOME)
// Cela permet au Dock (Pop!_OS/GNOME) d'associer le processus "scarlet-base"
// avec l'icône personnalisée dans build/icon.png en mode dev.
function createLinuxDesktopFile() {
  if (process.platform !== 'linux') return;
  try {
    const homeDir = os.homedir();
    const desktopFilePath = path.join(homeDir, '.local/share/applications/scarlet-base.desktop');
    const iconPath = '/home/leumas-nedlog/dev/side_projects/scarletbase/build/icon.png';
    const execPath = process.execPath;

    const content = `[Desktop Entry]
Name=Scarlet Base
Exec="${execPath}" /home/leumas-nedlog/dev/side_projects/scarletbase/dist-electron/main.js %U
Icon=${iconPath}
Type=Application
Terminal=false
Categories=Utility;
StartupWMClass=scarlet-base
`;

    const dir = path.dirname(desktopFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(desktopFilePath, content, 'utf-8');
    console.log('Wayland desktop file generated at:', desktopFilePath);
  } catch (e) {
    console.error('Failed to write .desktop file:', e);
  }
}

createLinuxDesktopFile();


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
    width: 1150,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    icon: path.join(__dirname, '../build/icon.png'),
    frame: false,
    transparent: true,          // laisse voir le bureau autour des coins arrondis
    backgroundColor: '#00000000', // fond totalement transparent (format hex8)
    hasShadow: true,             // ombre portée native
    resizable: true,
    roundedCorners: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  const broadcastMaximizedState = () => {
    win.webContents.send('titlebar:maximized-state', win.isMaximized());
  };
  win.on('maximize', broadcastMaximizedState);
  win.on('unmaximize', broadcastMaximizedState);

  return win;
}

ipcMain.on('titlebar:minimize', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});

ipcMain.on('titlebar:maximize-toggle', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  win.isMaximized() ? win.unmaximize() : win.maximize();
});

ipcMain.on('titlebar:close', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});

ipcMain.handle('titlebar:get-maximized-state', (event) => {
  return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false;
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
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
