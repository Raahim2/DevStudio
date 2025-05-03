const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  loginGithub: () => ipcRenderer.send('login-github'),
  onGithubToken: (callback) => {
    const subscription = (_event, value) => callback(value);
    ipcRenderer.on('github-token', subscription);
    return () => ipcRenderer.removeListener('github-token', subscription);
  },

  selectFolder: () => ipcRenderer.invoke('dialog:openDirectory'),
  getFolderStructure: (folderPath) => ipcRenderer.invoke('fs:getFolderStructure', folderPath),
  createFile: (filePath) => ipcRenderer.invoke('fs:createFile', filePath),
  createDirectory: (dirPath) => ipcRenderer.invoke('fs:createDirectory', dirPath),
  deleteItem: (itemPath) => ipcRenderer.invoke('fs:deleteItem', itemPath),
  moveItem: (sourcePath, targetFolderPath) => ipcRenderer.invoke('fs:moveItem', sourcePath, targetFolderPath),
  readFileContent: (filePath) => ipcRenderer.invoke('read-file-content', filePath),
  saveFileContent: (filePath, content) => ipcRenderer.invoke('save-file-content', filePath, content),

  pathJoin: (...args) => {
    console.log('[Preload] Invoking path:join with:', args);
    return ipcRenderer.invoke('path:join', ...args); // Use invoke
  },
  pathDirname: (p) => {
    console.log('[Preload] Invoking path:dirname with:', p);
    return ipcRenderer.invoke('path:dirname', p); // Use invoke
  },
  pathBasename: (p) => {
    console.log('[Preload] Invoking path:basename with:', p);
    return ipcRenderer.invoke('path:basename', p); // Use invoke
  },
  pathSep: () => {
     console.log('[Preload] Invoking path:sep');
     return ipcRenderer.invoke('path:sep'); // Use invoke
  },
});