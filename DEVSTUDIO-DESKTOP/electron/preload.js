const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    minimize: () => ipcRenderer.send('window-minimize'),
    toggleMaximize: () => ipcRenderer.send('window-toggle-maximize'),
    isMaximized: () => ipcRenderer.invoke('window-is-maximized'), // Use invoke for handlers that return a Promise
    close: () => ipcRenderer.send('window-close'),
    // Listen for status changes from main
    onMaximizedStatusChanged: (callback) => {
        const handler = (_event, isMaximized) => callback(isMaximized);
        ipcRenderer.on('window-maximized-status', handler);
        // Optional: Return a cleanup function to remove the listener
        return () => {
            ipcRenderer.removeListener('window-maximized-status', handler);
        };
    },
    
    loginGithub: () => ipcRenderer.send('login-github'),
    onGithubToken: (callback) => {
        const subscription = (_event, value) => callback(value);
        ipcRenderer.on('github-token', subscription);
        return () => ipcRenderer.removeListener('github-token', subscription);
    },
    openExternalLink: (url) => {
        ipcRenderer.send('open-external-link', url);
    },

    selectFolder: () => ipcRenderer.invoke('dialog:openDirectory'),
    getFolderStructure: (folderPath) => ipcRenderer.invoke('fs:getFolderStructure', folderPath),
    createFile: (filePath) => ipcRenderer.invoke('fs:createFile', filePath),
    createDirectory: (dirPath) => ipcRenderer.invoke('fs:createDirectory', dirPath),
    deleteItem: (itemPath) => ipcRenderer.invoke('fs:deleteItem', itemPath),
    // Corrected moveItem to accept newName, or pass it explicitly from FileBar.js
    // If your fileSystemHandlers's moveItem expects (sourcePath, targetFolderPath, newName)
    moveItem: (sourcePath, targetFolderPath, newName) => ipcRenderer.invoke('fs:moveItem', sourcePath, targetFolderPath, newName),
    readFileContent: (filePath) => ipcRenderer.invoke('read-file-content', filePath),
    saveFileContent: (filePath, content) => ipcRenderer.invoke('save-file-content', filePath, content),

    // Git operations
    gitIsRepo: (folderPath) => ipcRenderer.invoke('gitIsRepo', folderPath),
    gitGetStatus: (folderPath) => ipcRenderer.invoke('gitGetStatus', folderPath),
    gitGetDiff: (folderPath, filePath, isStaged) => ipcRenderer.invoke('gitGetDiff', folderPath, filePath, isStaged),
    gitAdd: (folderPath, filePathsArray) => ipcRenderer.invoke('gitAdd', folderPath, filePathsArray),
    gitUnstage: (folderPath, filePathsArray) => ipcRenderer.invoke('gitUnstage', folderPath, filePathsArray),
    gitCommit: (folderPath, message) => ipcRenderer.invoke('gitCommit', folderPath, message),
    gitPush: (folderPath, remoteName, branchName, token) => ipcRenderer.invoke('gitPush', folderPath, remoteName, branchName, token),
    gitFetch: (folderPath, remoteName, token) => ipcRenderer.invoke('gitFetch', folderPath, remoteName, token),
    gitPull: (folderPath, remoteName, branchName, token) => ipcRenderer.invoke('gitPull', folderPath, remoteName, branchName, token),
    gitInit: (folderPath) => ipcRenderer.invoke('gitInit', folderPath),
    gitAddRemote: (folderPath, remoteName, remoteUrl) => ipcRenderer.invoke('gitAddRemote', folderPath, remoteName, remoteUrl),

    // GitHub operations
    githubListUserRepos: (token) => ipcRenderer.invoke('githubListUserRepos', token),
    githubCreateRepo: (token, repoName, isPrivate) => ipcRenderer.invoke('githubCreateRepo', token, repoName, isPrivate),
    gitSetUpstream: async (folderPath, localBranch, remoteName, remoteBranch) =>
        ipcRenderer.invoke('gitSetUpstream', folderPath, localBranch, remoteName, remoteBranch),

    pathJoin: (...args) => ipcRenderer.invoke('path:join', ...args),
    pathDirname: (p) => ipcRenderer.invoke('path:dirname', p),
    pathBasename: (p) => ipcRenderer.invoke('path:basename', p),
    pathSep: () => ipcRenderer.invoke('path:sep'),

    executeCommand: (data) => ipcRenderer.send('terminal:execute', data),
    killProcess: () => ipcRenderer.send('terminal:kill'),

    // --- Main -> Renderer ---
    onOutput: (callback) => {
        const handler = (_event, data) => callback(data);
        ipcRenderer.on('terminal:output', handler);
        return () => ipcRenderer.removeListener('terminal:output', handler);
    },
    onFinish: (callback) => {
        const handler = (_event, exitCode) => callback(exitCode);
        ipcRenderer.on('terminal:finish', handler);
        return () => ipcRenderer.removeListener('terminal:finish', handler);
    },
    onCwdChanged: (callback) => {
        const handler = (_event, newCwd) => callback(newCwd);
        ipcRenderer.on('terminal:cwd-changed', handler);
        return () => ipcRenderer.removeListener('terminal:cwd-changed', handler);
    },
    onClear: (callback) => {
        const handler = (_event) => callback();
        ipcRenderer.on('terminal:clear', handler);
        return () => ipcRenderer.removeListener('terminal:clear', handler);
    },

    readPdfFileDataUrl: (filePath) => ipcRenderer.invoke('pdf:read-file-as-data-url', filePath),

    showSaveDialog: (options) => ipcRenderer.invoke('dialog:showSaveDialog', options),
    readImageAsBase64: (filePath) => ipcRenderer.invoke('image:read-base64', filePath),
    saveImageBase64: (filePath, base64Data) => ipcRenderer.invoke('image:save-base64', filePath, base64Data),
    onOpenImageEditor: (callback) => {
        const handler = (_event, filePath) => callback(filePath);
        ipcRenderer.on('open-image-editor', handler);
        // It's good practice to return a cleanup function here too if this listener might be set up multiple times
        return () => ipcRenderer.removeListener('open-image-editor', handler);
    },
    // removeOpenImageEditorListener is okay, but returning cleanup from onOpenImageEditor is more standard React hook pattern friendly
    removeOpenImageEditorListener: () => ipcRenderer.removeAllListeners('open-image-editor'),


    // --- New APIs for File Watching (Renderer -> Main) ---
    startWatchingFolder: (folderPath) => ipcRenderer.send('app:watch-folder', folderPath),
    stopWatchingFolder: () => ipcRenderer.send('app:stop-watching-folder'),
    // --- New API for File Watching (Main -> Renderer) ---
    onFileSystemChange: (callback) => {
        const handler = (event, ...args) => callback(...args);
        ipcRenderer.on('app:file-system-changed', handler);
        return () => ipcRenderer.removeListener('app:file-system-changed', handler); // Return a cleanup function
    },
});