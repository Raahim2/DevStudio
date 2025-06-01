const { app, BrowserWindow, shell, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const chokidar = require('chokidar'); // Import chokidar
const fs = require('fs'); // For fs.existsSync and fs.statSync in watcher setup

const CONSTANTS = require('./constants');

const { setupFileSystemHandlers } = require('./ipcs/fileSystemHandlers');
const { setupTerminalHandlers, cleanupTerminalProcess } = require('./ipcs/terminalHandlers');
const { setupGitHandlers } = require('./ipcs/gitHandlers');
const { setupGitHubApiHandlers } = require('./ipcs/githubApiHandlers');

let mainWindow;
let fsWatcher = null; // Variable to hold the chokidar instance

function getMainWindow() {
    return mainWindow;
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: CONSTANTS.ICON_PATH,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: false, // Be cautious with this setting
        },
    });

    const isProd = app.isPackaged;

    if (isProd) {
        mainWindow.loadFile(CONSTANTS.INDEX_HTML_PATH).catch(err => console.error('[Main Process] Failed to load prod index.html:', err));
        mainWindow.setMenu(null);
    } else {
        mainWindow.loadURL(CONSTANTS.LOCAL_HOST_URL).catch(err => console.error('[Main Process] Failed to load localhost:', err));
        const menu = Menu.buildFromTemplate([
            {
                label: 'DevStudio',
                submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { role: 'quit' }]
            }
        ]);
        Menu.setApplicationMenu(menu);
        // mainWindow.setMenu(null);

        // mainWindow.webContents.openDevTools(); // Optional: Open dev tools on start
    }

    mainWindow.on('closed', function () {
        mainWindow = null;
        if (fsWatcher) {
            fsWatcher.close().catch(err => console.error('[Main Watcher] Error closing watcher on window close:', err));
            fsWatcher = null;
        }
    });
    return mainWindow; // Return the window instance
}

if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient(CONSTANTS.APP_PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
    }
} else {
    app.setAsDefaultProtocolClient(CONSTANTS.APP_PROTOCOL);
}

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
        if (protocolUrl && protocolUrl.startsWith(`${CONSTANTS.APP_PROTOCOL}://`)) {
            handleAuthCallback(protocolUrl);
        }
    });

    app.whenReady().then(() => {
        setupFileSystemHandlers(ipcMain, dialog, getMainWindow);
        setupTerminalHandlers(ipcMain);
        setupGitHandlers(ipcMain);
        setupGitHubApiHandlers(ipcMain);

        ipcMain.on('login-github', () => {
            shell.openExternal(CONSTANTS.WEBSITE_LOGIN_URL);
        });

        // --- File System Watching IPC Handlers ---
        ipcMain.on('app:watch-folder', (event, folderPath) => {
            if (fsWatcher) {
                console.log('[Main Watcher] Closing previous watcher.');
                fsWatcher.close().catch(err => console.error('[Main Watcher] Error closing previous watcher:', err));
                fsWatcher = null;
            }

            if (!folderPath || !fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
                console.log(`[Main Watcher] Invalid or non-existent folder path provided: ${folderPath}`);
                return;
            }

            console.log(`[Main Watcher] Starting to watch: ${folderPath}`);
            try {
                fsWatcher = chokidar.watch(folderPath, {
                    ignored: /(^|[\/\\])\..*$/, // Ignore dotfiles/folders (e.g., .git, .DS_Store)
                    persistent: true,
                    ignoreInitial: true,
                    depth: undefined,
                    awaitWriteFinish: {
                        stabilityThreshold: 1000,
                        pollInterval: 100
                    }
                });

                const notifyRenderer = (eventType, changedPath) => {
                    const currentWindow = getMainWindow();
                    if (currentWindow && currentWindow.webContents && !currentWindow.webContents.isDestroyed()) {
                        console.log(`[Main Watcher] Event: ${eventType}, Path: ${changedPath}. Notifying renderer.`);
                        currentWindow.webContents.send('app:file-system-changed', {
                            eventType,
                            path: changedPath,
                            watchedFolderPath: folderPath
                        });
                    }
                };

                fsWatcher
                    .on('add', filePath => notifyRenderer('add', filePath))
                    .on('addDir', dirPath => notifyRenderer('addDir', dirPath))
                    .on('unlink', filePath => notifyRenderer('unlink', filePath))
                    .on('unlinkDir', dirPath => notifyRenderer('unlinkDir', dirPath))
                    .on('error', error => console.error(`[Main Watcher] Error: ${error}`))
                    .on('ready', () => console.log('[Main Watcher] Initial scan complete. Ready for changes.'));

            } catch (error) {
                console.error(`[Main Watcher] Failed to initialize chokidar for ${folderPath}:`, error);
            }
        });

        ipcMain.on('app:stop-watching-folder', () => {
            if (fsWatcher) {
                console.log('[Main Watcher] Stopping watcher.');
                fsWatcher.close().catch(err => console.error('[Main Watcher] Error closing watcher:', err));
                fsWatcher = null;
            }
        });
        // --- End File System Watching IPC Handlers ---


        createWindow();

        app.on('activate', function () {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });
    });

    app.on('open-url', (event, openedUrl) => {
        event.preventDefault();
        handleAuthCallback(openedUrl);
    });
}

function handleAuthCallback(protocolUrl) {
    if (!protocolUrl || !protocolUrl.startsWith(`${CONSTANTS.APP_PROTOCOL}://`)) {
        return;
    }
    try {
        const parsedUrl = new URL(protocolUrl);
        if (parsedUrl.pathname.includes('callback')) {
            const token = parsedUrl.searchParams.get('token');
            if (token && mainWindow && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
                mainWindow.webContents.send('github-token', token);
                if (mainWindow.isMinimized()) mainWindow.restore();
                mainWindow.focus();
            }
        }
    } catch (e) {
        console.error('[Main Process] Failed to parse protocol URL:', protocolUrl, e);
    }
}

app.on('window-all-closed', function () {
    cleanupTerminalProcess();
    if (fsWatcher) { // Ensure watcher is closed here too
        fsWatcher.close().catch(err => console.error('[Main Watcher] Error closing watcher on all windows closed:', err));
        fsWatcher = null;
    }
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('will-quit', () => {
    cleanupTerminalProcess();
    if (fsWatcher) { // And here, for good measure
        fsWatcher.close().catch(err => console.error('[Main Watcher] Error closing watcher on will-quit:', err));
        fsWatcher = null;
    }
});