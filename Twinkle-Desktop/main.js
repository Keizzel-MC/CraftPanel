const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');

let mainWindow;
let serverLoaded = false;
const appDir = __dirname;
const dataDir = path.join(app.getPath('userData'), 'data');
const legacyDataDir = path.join(app.getPath('appData'), 'CraftPanel', 'data');
if (!fs.existsSync(dataDir) && fs.existsSync(legacyDataDir)) {
  try { fs.cpSync(legacyDataDir, dataDir, { recursive: true }); } catch (e) { console.warn('[Twinkle] No se pudieron migrar los datos de CraftPanel:', e.message); }
}

function copyDefaultFile(name) {
  const destination = path.join(dataDir, name);
  if (!fs.existsSync(destination)) {
    const source = path.join(appDir, name);
    if (fs.existsSync(source)) fs.copyFileSync(source, destination);
  }
}

function portOpen(port, host = '127.0.0.1') {
  return new Promise(resolve => {
    const socket = net.createConnection({ port, host });
    socket.setTimeout(500);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
  });
}

async function waitForServer(port) {
  for (let i = 0; i < 100; i++) {
    if (await portOpen(port)) return true;
    await new Promise(r => setTimeout(r, 200));
  }
  return false;
}

async function createWindow() {
  fs.mkdirSync(dataDir, { recursive: true });
  copyDefaultFile('config.json');
  // No importar usuarios desde el instalador; cada equipo comienza sin cuentas.
  const usersFile = path.join(dataDir, 'users.json');
  if (!fs.existsSync(usersFile)) fs.writeFileSync(usersFile, '{}\n', { flag: 'wx' });
  process.env.TWINKLE_DATA_DIR = dataDir;
  // Keep the existing Twinkle Express API and UI, but host it inside the desktop app.
  if (!serverLoaded) {
    require('./server.js');
    serverLoaded = true;
  }
  const config = JSON.parse(fs.readFileSync(path.join(dataDir, 'config.json'), 'utf8'));
  const port = Number(config.port) || 3000;
  const ready = await waitForServer(port);

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 640,
    title: 'Twinkle',
    autoHideMenuBar: true,
    icon: path.join(appDir, 'icon.ico'),
    backgroundColor: '#0B1020',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (ready) {
    await mainWindow.loadURL(`http://127.0.0.1:${port}`);
  } else {
    await dialog.showMessageBox({
      type: 'error',
      title: 'No se pudo iniciar Twinkle',
      message: `Twinkle no respondió en el puerto ${port}.`,
      detail: 'Comprueba que el puerto no esté ocupado y vuelve a abrir la aplicación.'
    });
    app.quit();
    return;
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://127.0.0.1:') || url.startsWith('http://localhost:')) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
