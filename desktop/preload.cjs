const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('exerciseDesktop', {
  read: () => ipcRenderer.invoke('records:read'),
  write: (raw, base) => ipcRenderer.invoke('records:write', raw, base),
  restore: (raw) => ipcRenderer.invoke('records:restore', raw),
  maintenance: () => ipcRenderer.invoke('maintenance'),
  info: () => ipcRenderer.invoke('connection:info'),
  sync: () => ipcRenderer.invoke('connection:sync'),
  disconnect: () => ipcRenderer.invoke('connection:disconnect'),
  backups: () => ipcRenderer.invoke('backups:list'),
  backupRead: (name) => ipcRenderer.invoke('backups:read', name),
  export: (raw, name) => ipcRenderer.invoke('backup:export', raw, name),
  import: () => ipcRenderer.invoke('backup:import'),
});
