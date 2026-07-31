const { app, BrowserWindow, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('node:path');

const appUserModelId = 'com.benighter.satmobile.desktop';
const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

function configureAutoUpdates() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('error', (error) => {
    console.warn('Desktop update check failed:', error?.message || error);
  });

  autoUpdater.on('update-downloaded', async (update) => {
    const response = await dialog.showMessageBox({
      type: 'info',
      title: 'SAT Mobile update ready',
      message: `Version ${update.version} has been downloaded.`,
      detail: 'Restart SAT Mobile now to install the update.',
      buttons: ['Restart now', 'Install when I close the app'],
      defaultId: 0,
      cancelId: 1
    });

    if (response.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  const checkForUpdates = () => autoUpdater.checkForUpdates().catch(() => undefined);
  setTimeout(checkForUpdates, 8_000);
  setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL_MS);
}

function isExternalUrl(url) {
  return /^https?:\/\//i.test(url);
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#f8fafc',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalUrl(url)) {
      shell.openExternal(url);
    }

    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const currentUrl = mainWindow.webContents.getURL();
    if (url !== currentUrl && isExternalUrl(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  const devServerUrl = process.env.ELECTRON_START_URL;
  if (!app.isPackaged && devServerUrl) {
    mainWindow.loadURL(devServerUrl);
    return;
  }

  const rendererDirectory = app.isPackaged
    ? path.join(process.resourcesPath, 'dist')
    : path.join(__dirname, '..', 'dist');

  mainWindow.loadFile(path.join(rendererDirectory, 'index.html'));
}

app.setAppUserModelId(appUserModelId);

app.whenReady().then(() => {
  createWindow();
  configureAutoUpdates();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
