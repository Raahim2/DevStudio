const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  loginGithub: () => ipcRenderer.send('login-github'),
  onGithubToken: (callback) => {
    // Keep a reference to remove the listener later if needed, but basic setup:
    const subscription = (_event, value) => callback(value);
    ipcRenderer.on('github-token', subscription);
    // Return a function to unsubscribe if the component unmounts in a framework
    return () => ipcRenderer.removeListener('github-token', subscription);
  }
});