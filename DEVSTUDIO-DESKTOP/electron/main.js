const { app, BrowserWindow, shell, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const chokidar = require('chokidar');
const fs = require('fs');

const CONSTANTS = require('./constants');

const { setupFileSystemHandlers } = require('./ipcs/fileSystemHandlers');
const { setupTerminalHandlers, cleanupTerminalProcess } = require('./ipcs/terminalHandlers');
const { setupGitHandlers } = require('./ipcs/gitHandlers');
const { setupGitHubApiHandlers } = require('./ipcs/githubApiHandlers');

let mainWindow;
let fsWatcher = null;
let filePathToOpenOnReady = null;

if (app.isPackaged) {
    if (process.argv.length >= 2) {
        const openArg = process.argv[1];
        if (openArg && !openArg.startsWith('--') && fs.existsSync(openArg)) {
            filePathToOpenOnReady = openArg;
        }
    }
} else {
    if (process.argv.length >= 3) {
        const openArg = process.argv[2];
        if (openArg && !openArg.startsWith('--') && fs.existsSync(openArg)) {
            filePathToOpenOnReady = openArg;
        }
    }
}

function getMainWindow() {
    return mainWindow;
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: CONSTANTS.ICON_PATH,
        frame: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: false,
        },
    });

    const isProd = app.isPackaged;

    if (isProd) {
        mainWindow.loadFile(CONSTANTS.INDEX_HTML_PATH).catch(err => console.error(err));
        mainWindow.setMenu(null);
    } else {
        mainWindow.loadURL(CONSTANTS.LOCAL_HOST_URL).catch(err => console.error(err));
        const menu = Menu.buildFromTemplate([
            {
                label: 'DevStudio',
                submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { role: 'quit' }]
            }
        ]);
        Menu.setApplicationMenu(menu);
    }

    mainWindow.webContents.on('did-finish-load', () => {
        if (filePathToOpenOnReady) {
            mainWindow.webContents.send('app:open-file-or-folder', filePathToOpenOnReady);
            filePathToOpenOnReady = null;
        }
    });

    mainWindow.on('closed', function () {
        mainWindow = null;
        if (fsWatcher) {
            fsWatcher.close().catch(err => console.error(err));
            fsWatcher = null;
        }
    });
    return mainWindow;
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
        let pathToOpenFromSecondInstance = null;
        const argIndex = app.isPackaged ? 1 : 2;

        if (commandLine.length > argIndex) {
            const potentialPath = commandLine[argIndex];
            if (potentialPath && !potentialPath.startsWith('--') && !potentialPath.startsWith(`${CONSTANTS.APP_PROTOCOL}://`) && fs.existsSync(potentialPath)) {
                pathToOpenFromSecondInstance = potentialPath;
            }
        }

        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
            if (pathToOpenFromSecondInstance) {
                 mainWindow.webContents.send('app:open-file-or-folder', pathToOpenFromSecondInstance);
            }
        }

        const protocolUrl = commandLine.find(arg => arg.startsWith(`${CONSTANTS.APP_PROTOCOL}://`));
        if (protocolUrl) {
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

        ipcMain.on('app:watch-folder', (event, folderPath) => {
            if (fsWatcher) {
                fsWatcher.close().catch(err => console.error(err));
                fsWatcher = null;
            }

            if (!folderPath || !fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
                return;
            }

            try {
                fsWatcher = chokidar.watch(folderPath, {
                    ignored: /(^|[\/\\])\..*$/,
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
                    .on('error', error => console.error(error))
                    .on('ready', () => {});

            } catch (error) {
                console.error(error);
            }
        });

        ipcMain.on('app:stop-watching-folder', () => {
            if (fsWatcher) {
                fsWatcher.close().catch(err => console.error(err));
                fsWatcher = null;
            }
        });

        ipcMain.on('window-minimize', () => {
            const win = getMainWindow();
            if (win) win.minimize();
        });

        ipcMain.on('window-toggle-maximize', () => {
            const win = getMainWindow();
            if (win) {
                if (win.isMaximized()) {
                    win.unmaximize();
                } else {
                    win.maximize();
                }
            }
        });

        ipcMain.handle('window-is-maximized', () => {
            const win = getMainWindow();
            return win ? win.isMaximized() : false;
        });

        ipcMain.on('window-close', () => {
            const win = getMainWindow();
            if (win) win.close();
        });

        createWindow();
        if (mainWindow) {
            mainWindow.on('maximize', () => {
                if (mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
                    mainWindow.webContents.send('window-maximized-status', true);
                }
            });
            mainWindow.on('unmaximize', () => {
                if (mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
                    mainWindow.webContents.send('window-maximized-status', false);
                }
            });
        }

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
        console.error(e);
    }
}

app.on('window-all-closed', function () {
    cleanupTerminalProcess();
    if (fsWatcher) {
        fsWatcher.close().catch(err => console.error(err));
        fsWatcher = null;
    }
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('will-quit', () => {
    cleanupTerminalProcess();
    if (fsWatcher) {
        fsWatcher.close().catch(err => console.error(err));
        fsWatcher = null;
    }
});