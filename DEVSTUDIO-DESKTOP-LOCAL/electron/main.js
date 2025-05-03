const { app, BrowserWindow, shell, ipcMain, Menu , dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises; 
const fsc = require('fs');

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



ipcMain.handle('dialog:openDirectory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  if (!canceled && filePaths.length > 0) {
    return filePaths[0]; // Return the selected folder path
  }
  return null; // Return null if canceled or no path selected
});

async function readDirectoryRecursive(dirPath) {
  try {
    const dirents = await fs.readdir(dirPath, { withFileTypes: true });
    const files = await Promise.all(dirents.map(async (dirent) => {
      const resPath = path.join(dirPath, dirent.name);
      if (dirent.isDirectory()) {
        return {
          name: dirent.name,
          path: resPath,
          type: 'directory',
          children: await readDirectoryRecursive(resPath) // Recurse!
        };
      } else {
        return {
          name: dirent.name,
          path: resPath,
          type: 'file',
          children: [] // Files don't have children
        };
      }
    }));
    // Optional: Sort entries (folders first, then alphabetically)
    return files.sort((a, b) => {
        if (a.type === 'directory' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name);
    });
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
    // Decide how to handle errors (e.g., permissions)
    // Returning an empty array might be suitable for the UI
    return [];
  }
}


// Handle request to get the folder structure
ipcMain.handle('fs:getFolderStructure', async (event, folderPath) => {
  if (!folderPath) {
    return null;
  }
  try {
    // Basic check if path exists and is a directory
    const stats = await fs.stat(folderPath);
    if (!stats.isDirectory()) {
        console.error(`Path is not a directory: ${folderPath}`);
        return null;
    }
    // Return the root structure object
     return {
        name: path.basename(folderPath), // Get the folder name itself
        path: folderPath,
        type: 'directory',
        children: await readDirectoryRecursive(folderPath)
     };
  } catch (error) {
    console.error(`Error getting structure for ${folderPath}:`, error);
    return null; // Return null on error
  }
});


ipcMain.handle('fs:createFile', async (event, filePath) => {
  try {
    

    await fs.writeFile(filePath, ''); // Create an empty file
    console.log(`File created: ${filePath}`);
    return { success: true };
  } catch (error) {
    console.error(`Error creating file ${filePath}:`, error);
    return { success: false, error: error.message || 'Failed to create file.' };
  }
});


ipcMain.handle('fs:createDirectory', async (event, dirPath) => {
  try {
    // Check if it already exists
    try {
      const stats = await fs.stat(dirPath);
      if (stats.isDirectory() || stats.isFile()) {
         console.warn(`Path already exists: ${dirPath}`);
         return { success: false, error: 'A file or folder with that name already exists.' };
      }
    } catch (statError) {
       // Doesn't exist or other error, proceed with mkdir
       if (statError.code !== 'ENOENT') {
         throw statError; // Re-throw unexpected errors
       }
    }

    await fs.mkdir(dirPath);
    console.log(`Directory created: ${dirPath}`);
    return { success: true };
  } catch (error) {
    console.error(`Error creating directory ${dirPath}:`, error);
    return { success: false, error: error.message || 'Failed to create directory.' };
  }
});



ipcMain.handle('fs:deleteItem', async (event, itemPath) => {
  console.log(`Attempting to delete: ${itemPath}`);
  try {
    if (!fsc.existsSync(itemPath)) {
      console.warn(`Item not found for deletion: ${itemPath}`);
      return { success: false, error: 'Item not found.' };
    }
    await fs.rm(itemPath, { recursive: true, force: true });
    console.log(`Item deleted successfully: ${itemPath}`);
    return { success: true };
  } catch (error) {
    // **** ENHANCED LOGGING ****
    console.error(`Error deleting item ${itemPath}:`, error); // Log the full error object
    // **** END ENHANCED LOGGING ****

    let errorMessage = 'Failed to delete item.';
    if (error.code === 'EPERM' || error.code === 'EACCES') {
      errorMessage = 'Permission denied. Cannot delete item.';
    } else if (error.code === 'EBUSY') {
      errorMessage = 'Item is currently in use by another process.';
    } else if (error.message) {
       // Use the actual error message if available and specific checks failed
       errorMessage = error.message;
    }
    return { success: false, error: errorMessage };
  }
});

// --- Modified fs:moveItem ---
ipcMain.handle('fs:moveItem', async (event, sourcePath, targetFolderPath) => {
  const itemName = path.basename(sourcePath);
  const destinationPath = path.join(targetFolderPath, itemName);
  console.log(`Attempting to move: ${sourcePath} -> ${destinationPath}`);

  try {
    if (sourcePath === targetFolderPath || destinationPath.startsWith(sourcePath + path.sep)) {
      return { success: false, error: 'Cannot move a folder into itself.' };
    }
    if (fsc.existsSync(destinationPath)) {
      return { success: false, error: `An item named "${itemName}" already exists in the target folder.` };
    }
    await fs.rename(sourcePath, destinationPath);
    console.log(`Item moved successfully: ${sourcePath} -> ${destinationPath}`);
    return { success: true };
  } catch (error) {
    // **** ENHANCED LOGGING ****
    console.error(`Error moving item ${sourcePath} to ${destinationPath}:`, error); // Log the full error object
    // **** END ENHANCED LOGGING ****

    let errorMessage = 'Failed to move item.';
    if (error.code === 'EPERM' || error.code === 'EACCES') {
      errorMessage = 'Permission denied. Cannot move item.';
    } else if (error.code === 'ENOENT') {
      errorMessage = 'Source item not found or target directory does not exist.';
    } else if (error.code === 'EXDEV') {
      errorMessage = 'Cannot move item across different disk partitions.';
    } else if (error.message) {
        // Use the actual error message if available and specific checks failed
       errorMessage = error.message;
    }
    return { success: false, error: errorMessage };
  }
});

ipcMain.handle('read-file-content', async (event, filePath) => {
  console.log('[IPC] Received read-file-content for:', filePath);
  if (!filePath) {
      console.error('[IPC] read-file-content: No file path provided.');
      throw new Error('No file path provided.'); // Throw error back to renderer
  }
  try {
      // Read file as UTF-8. Handle potential errors.
      const content = await fs.readFile(filePath, { encoding: 'utf-8' });
      console.log(`[IPC] read-file-content: Successfully read ${filePath}, length: ${content.length}`);
      return content;
  } catch (error) {
      console.error(`[IPC] read-file-content: Error reading file ${filePath}:`, error);
      // Provide a more specific error message if possible
      if (error.code === 'ENOENT') {
           throw new Error(`File not found: ${path.basename(filePath)}`);
      } else if (error.code === 'EACCES') {
           throw new Error(`Permission denied reading: ${path.basename(filePath)}`);
      } else if (error.code === 'EISDIR') {
           throw new Error(`Cannot read content of a directory: ${path.basename(filePath)}`);
      }
       
      throw new Error(`Failed to read file: ${error.message || 'Unknown error'}`);
  }
});

ipcMain.handle('save-file-content', async (event, filePath, content) => {
  console.log('[IPC] Received save-file-content for:', filePath);
  if (!filePath) {
      console.error('[IPC] save-file-content: No file path provided.');
      throw new Error('No file path provided.');
  }
  if (content === null || content === undefined) {
       console.error('[IPC] save-file-content: No content provided.');
      throw new Error('No content provided to save.');
  }

  try {
      await fs.writeFile(filePath, content, { encoding: 'utf-8' });
      console.log(`[IPC] save-file-content: Successfully saved ${filePath}`);
      return { success: true }; // Indicate success back to renderer
  } catch (error) {
      console.error(`[IPC] save-file-content: Error saving file ${filePath}:`, error);
      if (error.code === 'ENOENT') {
           throw new Error(`Cannot save, path no longer exists: ${path.basename(filePath)}`);
      } else if (error.code === 'EACCES') {
           throw new Error(`Permission denied saving: ${path.basename(filePath)}`);
      } else if (error.code === 'EISDIR') {
           throw new Error(`Cannot save, path is a directory: ${path.basename(filePath)}`);
      }
      throw new Error(`Failed to save file: ${error.message || 'Unknown error'}`);
  }
});


ipcMain.handle('path:join', async (event, ...args) => {
  try {
    return path.join(...args);
  } catch (error) {
    console.error('Error in path:join handler:', error);
    return null; // Or throw an error appropriate for invoke
  }
});

ipcMain.handle('path:dirname', async (event, p) => {
  try {
    return path.dirname(p);
  } catch (error) {
    console.error('Error in path:dirname handler:', error);
    return null;
  }
});

ipcMain.handle('path:basename', async (event, p) => {
  try {
    return path.basename(p);
  } catch (error) {
    console.error('Error in path:basename handler:', error);
    return null;
  }
});

ipcMain.handle('path:sep', async (event) => {
  try {
    return path.sep;
  } catch (error) {
    console.error('Error in path:sep handler:', error);
    return null;
  }
});
