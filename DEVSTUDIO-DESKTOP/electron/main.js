const { app, BrowserWindow, protocol, shell, ipcMain, Menu } = require('electron');
const path = require('path');
const url = require('url'); // Keep url module for protocol parsing if needed

// --- CONFIGURATION ---
const APP_PROTOCOL = 'devstudio';
const WEBSITE_LOGIN_URL = 'http://devstudio-ai.vercel.app/api/auth/github/login';
const INDEX_HTML_PATH = path.join(__dirname, '..', 'out', 'index.html');
const LOCAL_HOST_URL = 'http://localhost:3000'; // Adjust this based on your dev server port

// --- END CONFIGURATION ---
let mainWindow;
// Function to create window and load content
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    icon: path.join(__dirname, '../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const isProd = app.isPackaged;

  // --- Load either localhost (dev) or out (prod) ---
  if (isProd) {
    console.log(`[Main Process] Loading from production: ${INDEX_HTML_PATH}`);
    
    mainWindow.loadFile(INDEX_HTML_PATH)
      .then(() => {
        console.log('[Main Process] Successfully loaded production index.html');
        mainWindow.setMenu(null)

      })
      .catch(err => {
        console.error('[Main Process] Failed to load production index.html:', err);
      });
  } else {
    console.log('[Main Process] Loading from development: localhost');
    mainWindow.loadURL(LOCAL_HOST_URL)
      .then(() => {
        console.log('[Main Process] Successfully loaded localhost');
      })
      .catch(err => {
        console.error('[Main Process] Failed to load localhost:', err);
      });
    
    // Show the menu bar in dev mode
    const menu = Menu.buildFromTemplate([
      {
        label: 'DevStudio',
        submenu: [
          { role: 'reload' },
          { role: 'toggleDevTools' },
          { role: 'quit' }
        ]
      }
    ]);
    Menu.setApplicationMenu(menu);
  }
  // --- End Load ---

  // Handle window closure
  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// Protocol handling setup (remains the same)
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(APP_PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient(APP_PROTOCOL);
}

// Enforce single instance (remains the same)
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    // Ensure the last argument is treated as the URL
    const protocolUrl = commandLine.pop();
    if (protocolUrl && protocolUrl.startsWith(`${APP_PROTOCOL}://`)) {
       handleAuthCallback(protocolUrl);
    } else {
      console.log('[Main Process] Second instance opened without a valid protocol URL.');
    }
  });

  // --- MODIFIED app.whenReady ---
  app.whenReady().then(() => {
    createWindow();
    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  // Handle deep linking on macOS and when app is already running
  app.on('open-url', (event, openedUrl) => {
    event.preventDefault();
    handleAuthCallback(openedUrl);
  });
}

// Handle protocol callback (remains the same)
function handleAuthCallback(protocolUrl) {
  if (!protocolUrl || !protocolUrl.startsWith(`${APP_PROTOCOL}://`)) {
    console.log('[Main Process] Ignoring non-protocol URL:', protocolUrl);
    return;
  }

  console.log(`[Main Process] Received protocol URL: ${protocolUrl}`); // Added logging

  try {
    const parsedUrl = new URL(protocolUrl);

    if (parsedUrl.pathname.includes('callback')) {
      const token = parsedUrl.searchParams.get('token');
      if (token && mainWindow) {
        console.log(`[Main Process] Sending token to renderer: ${token.substring(0, 6)}...`);
        mainWindow.webContents.send('github-token', token);
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      } else if (!token) {
        console.error('[Main Process] Token not found in callback URL:', protocolUrl);
      } else {
         console.error('[Main Process] mainWindow is not available to send token.');
      }
    } else {
      console.log('[Main Process] Ignoring protocol URL with unexpected path:', parsedUrl.pathname);
    }
  } catch (e) {
    console.error('[Main Process] Failed to parse protocol URL:', protocolUrl, e);
  }
}

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// GitHub login trigger (remains the same)
ipcMain.on('login-github', (event) => {
  console.log('[Main Process] Received login-github request. Opening external URL.');
  shell.openExternal(WEBSITE_LOGIN_URL);
});
