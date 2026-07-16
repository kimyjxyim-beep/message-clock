const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('jinzhuOverlay', {
  getBootstrap: () => ipcRenderer.invoke('overlay:get-bootstrap'),
  getState: () => ipcRenderer.invoke('overlay:get-state'),
  reportImageResult: (result) => ipcRenderer.send('overlay:image-result', result),
  reportViewportMetrics: (metrics) => ipcRenderer.send('overlay:viewport-metrics', metrics),
  saveState: (state) => ipcRenderer.send('overlay:save-state', state),
  setPosition: (p) => ipcRenderer.send('overlay:set-position', p),
  dragDelta: (delta) => ipcRenderer.send('overlay:drag-delta', delta),
  setDragging: (active) => ipcRenderer.send('overlay:dragging', active),
  interaction: (action) => ipcRenderer.send('overlay:interaction', action),
  togglePause: () => ipcRenderer.send('overlay:toggle-pause'),
  toggleTop: () => ipcRenderer.send('overlay:toggle-top'),
  hide: () => ipcRenderer.send('overlay:hide'),
  onBehavior: (fn) => ipcRenderer.on('overlay:behavior', (_, data) => fn(data)),
  onSpeech: (fn) => ipcRenderer.on('overlay:speech', (_, text) => fn(text))
});
