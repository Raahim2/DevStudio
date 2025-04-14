const { app, BrowserWindow, protocol, shell, ipcMain } = require('electron');
const path = require('path');
const url = require('url');

// --- CONFIGURATION ---
const APP_PROTOCOL = 'devstudio';
const WEBSITE_LOGIN_URL = 'http://devstudio-ai.vercel.app/api/auth/github/login';
// const DEV_SERVER_URL = 'https://devstudio-gamma.vercel.app/';
const DEV_SERVER_URL = 'http://localhost:3000'; 
// --- END CONFIGURATION ---

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(DEV_SERVER_URL);

  // Block Ctrl+Shift+I / Cmd+Opt+I to prevent DevTools opening
  // mainWindow.webContents.on('before-input-event', (event, input) => {
  //   const isDevToolsShortcut =
  //     (input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i';

  //   if (isDevToolsShortcut) {
  //     event.preventDefault();
  //     console.log('[Main Process] Blocked DevTools shortcut');
  //   }
  // });

  mainWindow.webContents.openDevTools(); // Remove or comment out in production

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// Protocol handling setup
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(APP_PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient(APP_PROTOCOL);
}

// Enforce single instance
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    const protocolUrl = commandLine.pop();
    handleAuthCallback(protocolUrl);
  });

  app.whenReady().then(() => {
    createWindow();
  });

  app.on('open-url', (event, openedUrl) => {
    event.preventDefault();
    handleAuthCallback(openedUrl);
  });
}

// Handle protocol callback
function handleAuthCallback(protocolUrl) {
  if (!protocolUrl || !protocolUrl.startsWith(`${APP_PROTOCOL}://`)) {
    console.log('Ignoring non-protocol URL:', protocolUrl);
    return;
  }

  try {
    const parsedUrl = new URL(protocolUrl);

    if (parsedUrl.pathname.includes('callback')) {
      const token = parsedUrl.searchParams.get('token');
      if (token && mainWindow) {
        console.log(`[Main Process] Sending token to renderer: ${token.substring(0, 6)}...`);
        mainWindow.webContents.send('github-token', token);
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      } else {
        console.error('[Main Process] Token not found in callback URL or mainWindow is not available.');
      }
    } else {
      console.log('[Main Process] Ignoring protocol URL with unexpected path:', parsedUrl.pathname);
    }
  } catch (e) {
    console.error('[Main Process] Failed to parse protocol URL:', protocolUrl, e);
  }
}

// Standard window management
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// GitHub login trigger
ipcMain.on('login-github', (event) => {
  console.log('[Main Process] Received login-github request. Opening external URL.');
  shell.openExternal(WEBSITE_LOGIN_URL);
});
