const path = require('path');
const fs = require('fs').promises;
const fsc = require('fs');

function setupFileSystemHandlers(ipcMain, dialog, getMainWindow) {
    ipcMain.handle('dialog:openDirectory', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog({
            properties: ['openDirectory']
        });
        if (!canceled && filePaths.length > 0) {
            return filePaths[0];
        }
        return null;
    });

    async function readDirectoryRecursive(dirPath) {
        try {
            const dirents = await fs.readdir(dirPath, { withFileTypes: true });
            const files = await Promise.all(dirents.map(async (dirent) => {
                const resPath = path.join(dirPath, dirent.name);
                if (dirent.isDirectory()) {
                    return { name: dirent.name, path: resPath, type: 'directory', children: await readDirectoryRecursive(resPath) };
                } else {
                    return { name: dirent.name, path: resPath, type: 'file', children: [] };
                }
            }));
            return files.sort((a, b) => {
                if (a.type === 'directory' && b.type === 'file') return -1;
                if (a.type === 'file' && b.type === 'directory') return 1;
                return a.name.localeCompare(b.name);
            });
        } catch (error) {
            return [];
        }
    }

    ipcMain.handle('fs:getFolderStructure', async (event, folderPath) => {
        if (!folderPath) return null;
        try {
            const stats = await fs.stat(folderPath);
            if (!stats.isDirectory()) return null;
            return { name: path.basename(folderPath), path: folderPath, type: 'directory', children: await readDirectoryRecursive(folderPath) };
        } catch (error) {
            return null;
        }
    });

    ipcMain.handle('dialog:showSaveDialog', async (event, options) => {
        const mainWindow = getMainWindow();
        if (!mainWindow) return null;
        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, options);
        if (canceled || !filePath) {
            return null;
        }
        return filePath;
    });

    ipcMain.handle('image:read-base64', async (event, filePath) => {
        if (!filePath) throw new Error('No file path provided for image reading.');
        try {
            const data = await fs.readFile(filePath);
            const extension = path.extname(filePath).substring(1).toLowerCase();
            let mimeType = 'image/jpeg';
            if (extension === 'png') mimeType = 'image/png';
            else if (extension === 'gif') mimeType = 'image/gif';
            else if (extension === 'webp') mimeType = 'image/webp';
            else if (extension === 'svg') mimeType = 'image/svg+xml';
            return `data:${mimeType};base64,${data.toString('base64')}`;
        } catch (error) {
            console.error(`[Main Process] Failed to read image ${filePath}:`, error);
            throw new Error(`Failed to read image: ${error.message}`);
        }
    });

    ipcMain.handle('image:save-base64', async (event, filePath, base64Data) => {
        if (!filePath) throw new Error('No file path provided for saving image.');
        if (!base64Data) throw new Error('No image data provided to save.');
        try {
            const parts = base64Data.match(/^data:(.+);base64,(.+)$/);
            if (!parts || parts.length !== 3) {
                throw new Error('Invalid base64 image data format.');
            }
            const imageData = parts[2];
            await fs.writeFile(filePath, imageData, { encoding: 'base64' });
            return { success: true };
        } catch (error) {
            console.error(`[Main Process] Failed to save image to ${filePath}:`, error);
            let userMessage = `Failed to save image: ${error.message || 'Unknown error'}`;
            if (error.code === 'EACCES') userMessage = `Permission denied saving image to: ${path.basename(filePath)}`;
            throw new Error(userMessage);
        }
    });

    ipcMain.on('trigger-open-image', async () => {
        const mainWindow = getMainWindow();
        if (!mainWindow) return;
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [
                { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'] }
            ]
        });
        if (!canceled && filePaths.length > 0) {
            if (mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
                mainWindow.webContents.send('open-image-editor', filePaths[0]);
            }
        }
    });

    ipcMain.handle('fs:createFile', async (event, filePath) => {
        try {
            await fs.writeFile(filePath, '');
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message || 'Failed to create file.' };
        }
    });

    ipcMain.handle('fs:createDirectory', async (event, dirPath) => {
        try {
            try {
                const stats = await fs.stat(dirPath);
                if (stats.isDirectory() || stats.isFile()) {
                    return { success: false, error: 'A file or folder with that name already exists.' };
                }
            } catch (statError) {
                if (statError.code !== 'ENOENT') throw statError;
            }
            await fs.mkdir(dirPath);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message || 'Failed to create directory.' };
        }
    });

    ipcMain.handle('fs:deleteItem', async (event, itemPath) => {
        try {
            if (!fsc.existsSync(itemPath)) {
                return { success: false, error: 'Item not found.' };
            }
            await fs.rm(itemPath, { recursive: true, force: true });
            return { success: true };
        } catch (error) {
            let errorMessage = 'Failed to delete item.';
            if (error.code === 'EPERM' || error.code === 'EACCES') errorMessage = 'Permission denied. Cannot delete item.';
            else if (error.code === 'EBUSY') errorMessage = 'Item is currently in use by another process.';
            else if (error.message) errorMessage = error.message;
            return { success: false, error: errorMessage };
        }
    });

    ipcMain.handle('fs:moveItem', async (event, sourcePath, targetFolderPath, newName) => {
        const effectiveItemName = newName || path.basename(sourcePath);
        const destinationPath = path.join(targetFolderPath, effectiveItemName);

        try {
            if (sourcePath === destinationPath) {
                return { success: true, message: "Source and destination are the same." };
            }

            if (fsc.existsSync(sourcePath) && fsc.statSync(sourcePath).isDirectory()) {
                if (destinationPath.startsWith(sourcePath + path.sep)) {
                    return { success: false, error: 'Cannot move a folder into itself or a subfolder.' };
                }
            }
            
            if (fsc.existsSync(destinationPath)) {
                if (sourcePath.toLowerCase() !== destinationPath.toLowerCase()) {
                    return { success: false, error: `An item named "${effectiveItemName}" already exists in the target location.` };
                }
            }

            await fs.rename(sourcePath, destinationPath);
            return { success: true, newPath: destinationPath }; // Return newPath for potential UI updates
        } catch (error) {
            console.error(`[fs:moveItem] Error moving ${sourcePath} to ${destinationPath}:`, error);
            let errorMessage = `Failed to move/rename item "${path.basename(sourcePath)}".`;
            if (error.code === 'EPERM' || error.code === 'EACCES') errorMessage = `Permission denied. Cannot move/rename item.`;
            else if (error.code === 'ENOENT') errorMessage = `Source item not found or target directory does not exist.`;
            else if (error.code === 'EXDEV') errorMessage = `Cannot move/rename item across different disk partitions.`;
            else if (error.message) errorMessage = error.message;
            return { success: false, error: errorMessage };
        }
    });

    ipcMain.handle('read-file-content', async (event, filePath) => {
        if (!filePath) throw new Error('No file path provided.');
        try {
            const content = await fs.readFile(filePath, { encoding: 'utf-8' });
            return content;
        } catch (error) {
            if (error.code === 'ENOENT') throw new Error(`File not found: ${path.basename(filePath)}`);
            if (error.code === 'EACCES') throw new Error(`Permission denied reading: ${path.basename(filePath)}`);
            if (error.code === 'EISDIR') throw new Error(`Cannot read content of a directory: ${path.basename(filePath)}`);
            throw new Error(`Failed to read file: ${error.message || 'Unknown error'}`);
        }
    });

    ipcMain.handle('save-file-content', async (event, filePath, content) => {
        if (!filePath) throw new Error('No file path provided.');
        if (content === null || content === undefined) throw new Error('No content provided to save.');
        try {
            await fs.writeFile(filePath, content, { encoding: 'utf-8' });
            return { success: true };
        } catch (error) {
            if (error.code === 'ENOENT') throw new Error(`Cannot save, path no longer exists: ${path.basename(filePath)}`);
            if (error.code === 'EACCES') throw new Error(`Permission denied saving: ${path.basename(filePath)}`);
            if (error.code === 'EISDIR') throw new Error(`Cannot save, path is a directory: ${path.basename(filePath)}`);
            throw new Error(`Failed to save file: ${error.message || 'Unknown error'}`);
        }
    });

    ipcMain.handle('path:join', async (event, ...args) => path.join(...args));
    ipcMain.handle('path:dirname', async (event, p) => path.dirname(p));
    ipcMain.handle('path:basename', async (event, p) => path.basename(p));
    ipcMain.handle('path:sep', async () => path.sep);
}

module.exports = { setupFileSystemHandlers };