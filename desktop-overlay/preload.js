const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const assetDir = process.resourcesPath ? path.join(process.resourcesPath, 'assets', 'jinzhu') : path.join(__dirname, '..', 'assets', 'jinzhu');
contextBridge.exposeInMainWorld('jinzhuOverlay', {
  assetRoot: pathToFileURL(assetDir + path.sep).href,
  getState: () => ipcRenderer.invoke('overlay:get-state'),
  saveState: (state) => ipcRenderer.send('overlay:save-state', state),
  setPosition: (p) => ipcRenderer.send('overlay:set-position', p),
  dragDelta: (delta) => ipcRenderer.send('overlay:drag-delta', delta),
  setDragging: (active) => ipcRenderer.send('overlay:dragging', active),
  togglePause: () => ipcRenderer.send('overlay:toggle-pause'),
  toggleTop: () => ipcRenderer.send('overlay:toggle-top'),
  hide: () => ipcRenderer.send('overlay:hide'),
  onWalk: (fn) => ipcRenderer.on('overlay:walk', (_, data) => fn(data))
});
