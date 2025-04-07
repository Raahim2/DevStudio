const { app, BrowserWindow, protocol, shell, ipcMain } = require('electron');
const path = require('path');
const url = require('url');

// --- CONFIGURATION ---
// This MUST match the NEXT_PUBLIC_APP_PROTOCOL in your Next.js .env.local
const APP_PROTOCOL = 'devstudio';
// This MUST point to the login API route on your Next.js website
const WEBSITE_LOGIN_URL = 'http://devstudio-ai.vercel.app/api/auth/github/login';
// --- Development Server URL ---
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
      nodeIntegration: false, // Keep false for security with remote content
    },
  });

  // Load the URL of the Next.js development server
  mainWindow.loadURL(DEV_SERVER_URL);

  // Optionally, open DevTools automatically in development
  mainWindow.webContents.openDevTools();


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
     // Process the URL from second instance launch (protocol link)
     const protocolUrl = commandLine.pop(); // Usually the last argument
     handleAuthCallback(protocolUrl);
  });

  // Create window when ready
  app.whenReady().then(() => {
    // No need to register file protocol when loading URL
    createWindow();
  });

   // Handle protocol URL when app is already open (macOS)
   app.on('open-url', (event, openedUrl) => {
     event.preventDefault();
     handleAuthCallback(openedUrl);
   });
}

// Function to process the custom protocol URL
function handleAuthCallback(protocolUrl) {
   if (!protocolUrl || !protocolUrl.startsWith(`${APP_PROTOCOL}://`)) {
        console.log('Ignoring non-protocol URL:', protocolUrl);
        return;
    }

   try {
        const parsedUrl = new URL(protocolUrl);
        // Check if the path matches what your Next.js app sends back
        // e.g., devstudio://auth/callback?token=...
        if(parsedUrl.pathname.includes('callback')) {
           const token = parsedUrl.searchParams.get('token');
            if (token && mainWindow) {
                // Send token securely to the renderer process (the Next.js app)
                console.log(`[Main Process] Sending token to renderer: ${token.substring(0,6)}...`);
                mainWindow.webContents.send('github-token', token);
                // Bring window to front
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
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC listener to trigger the login flow
ipcMain.on('login-github', (event) => {
    console.log('[Main Process] Received login-github request. Opening external URL.');
    // Open the Next.js login URL in the user's default browser
    shell.openExternal(WEBSITE_LOGIN_URL);
});