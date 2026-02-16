const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception (Electron main):', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection (Electron main):', reason);
});

let mainWindow;
let backend;

async function startBackend() {
  // En producción, el backend se copia como recurso externo (extraResources)
  // para que pueda resolver sus dependencias (backend/node_modules) fuera del asar.
  const serverPath = app.isPackaged
    ? path.join(process.resourcesPath, 'backend', 'server.js')
    : path.join(__dirname, '..', 'backend', 'server.js');
  const mod = await import(pathToFileURL(serverPath).href);

  if (!mod?.startServer) {
    throw new Error('backend/server.js no exporta startServer');
  }

  // Puerto 0 => sistema elige uno libre (evita conflictos con 5000)
  backend = await mod.startServer({ port: 0, host: '127.0.0.1' });
  return backend;
}

function createWindow(apiUrl) {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#051026',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Asegura que cualquier `window.open('https://...')` se abra en el navegador del sistema
  // (y no en una nueva ventana dentro de Electron).
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
        shell.openExternal(url);
      }
    } catch (e) {
      console.error('No se pudo abrir URL externa:', e);
    }
    return { action: 'deny' };
  });

  // Quita la barra/menú superior (File/Edit/View...) en Windows
  Menu.setApplicationMenu(null);
  mainWindow.removeMenu();
  mainWindow.setMenuBarVisibility(false);

  const isDev = !app.isPackaged && process.env.FORCE_PROD !== '1';

  if (isDev) {
    const devUrl = process.env.ELECTRON_START_URL || 'http://localhost:5173';
    const url = `${devUrl}/?api=${encodeURIComponent(apiUrl)}`;
    mainWindow.loadURL(url);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexPath = path.join(__dirname, '..', 'LInguistika-Studio', 'dist', 'index.html');
    mainWindow.loadFile(indexPath, { query: { api: apiUrl } });
    if (process.env.ELECTRON_DEBUG === '1') {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  }
}

app.whenReady().then(async () => {
  try {
    const { host, port } = await startBackend();
    const apiUrl = `http://${host}:${port}/api`;
    createWindow(apiUrl);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow(apiUrl);
    });
  } catch (err) {
    console.error('No se pudo iniciar Linguistika Desktop:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
