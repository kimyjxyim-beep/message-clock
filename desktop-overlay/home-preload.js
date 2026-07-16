const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('jinzhuHome', {
  getBootstrap: () => ipcRenderer.invoke('home:get-bootstrap'),
  action: (type) => ipcRenderer.send('home:action', type),
  dragDelta: (delta) => ipcRenderer.send('home:drag-delta', delta)
});
