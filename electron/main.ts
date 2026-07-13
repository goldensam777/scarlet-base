import { app, BrowserWindow, ipcMain, Menu, dialog } from 'electron'
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
    const iconPath = path.join(__dirname, '../build/icon.png');
    const execPath = process.execPath;
    const mainJsPath = path.join(__dirname, 'main.js');

    const content = `[Desktop Entry]
Name=Scarlet Base
Exec="${execPath}" "${mainJsPath}" %U
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
  const bakPath = dbPath + '.bak';
  try {
    if (fs.existsSync(dbPath)) {
      const content = fs.readFileSync(dbPath, 'utf-8');
      try {
        return JSON.parse(content);
      } catch (parseError) {
        console.error('Failed to parse db.json, attempting backup recovery...', parseError);
        if (fs.existsSync(bakPath)) {
          try {
            const bakContent = fs.readFileSync(bakPath, 'utf-8');
            const parsedBak = JSON.parse(bakContent);
            // Restore db.json from backup
            fs.writeFileSync(dbPath, bakContent, 'utf-8');
            console.log('Successfully recovered database from backup file.');
            return parsedBak;
          } catch (bakError) {
            console.error('Backup db.bak is also invalid!', bakError);
            handleDbCorruption(parseError);
          }
        } else {
          handleDbCorruption(parseError);
        }
      }
    } else if (fs.existsSync(bakPath)) {
      try {
        const bakContent = fs.readFileSync(bakPath, 'utf-8');
        const parsedBak = JSON.parse(bakContent);
        fs.writeFileSync(dbPath, bakContent, 'utf-8');
        console.log('Successfully restored db.json from backup.');
        return parsedBak;
      } catch (bakError) {
        console.error('Backup db.bak is invalid!', bakError);
        handleDbCorruption(bakError);
      }
    }
  } catch (e) {
    console.error('Failed to load database file', e);
  }
  return null;
});

function handleDbCorruption(error: any) {
  console.error('Database corruption detected:', error);
  try {
    const timestamp = Date.now();
    const corruptDbPath = dbPath + `.${timestamp}.corrupt`;
    const corruptBakPath = dbPath + `.bak.${timestamp}.corrupt`;

    if (fs.existsSync(dbPath)) {
      fs.renameSync(dbPath, corruptDbPath);
    }
    const bakPath = dbPath + '.bak';
    if (fs.existsSync(bakPath)) {
      fs.renameSync(bakPath, corruptBakPath);
    }

    dialog.showErrorBox(
      "Base de données corrompue",
      "Les fichiers de données (db.json et sa sauvegarde) de Scarlet Base semblent corrompus et n'ont pas pu être lus.\n\n" +
      "Une nouvelle base de données vide a été initialisée. Les fichiers corrompus ont été sauvegardés sous l'extension '.corrupt' dans votre dossier de profil (~/.scarletbase) pour une récupération manuelle possible."
    );
  } catch (err) {
    console.error('Failed during corruption handling:', err);
  }
}

ipcMain.handle('db:save', async (_, data: any) => {
  const tmpPath = dbPath + '.tmp';
  const bakPath = dbPath + '.bak';
  try {
    let existingData = {};
    if (fs.existsSync(dbPath)) {
      try {
        const content = fs.readFileSync(dbPath, 'utf-8');
        existingData = JSON.parse(content);
      } catch (err) {
        console.warn('Existing db.json invalid, attempting to read backup...', err);
        if (fs.existsSync(bakPath)) {
          try {
            const bakContent = fs.readFileSync(bakPath, 'utf-8');
            existingData = JSON.parse(bakContent);
          } catch (bakErr) {
            console.error('Backup db.bak is also invalid!', bakErr);
          }
        }
      }
    }

    const mergedData = { ...existingData, ...data };
    const jsonString = JSON.stringify(mergedData, null, 2);

    // Create backup of current db.json before writing if it exists and is valid
    if (fs.existsSync(dbPath)) {
      try {
        fs.copyFileSync(dbPath, bakPath);
      } catch (copyErr) {
        console.error('Failed to create backup:', copyErr);
      }
    }

    // Write atomically via temp file
    fs.writeFileSync(tmpPath, jsonString, 'utf-8');
    fs.renameSync(tmpPath, dbPath);

    return true;
  } catch (e) {
    console.error('Failed to save database file', e);
    if (fs.existsSync(tmpPath)) {
      try {
        fs.unlinkSync(tmpPath);
      } catch {}
    }
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
