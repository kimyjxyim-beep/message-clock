const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

const SIZE = { width: 220, height: 190 };
let win, tray, moveTimer, dragTimer, walkAnimation;
let state = { x: 40, y: 120, mood: 72, fullness: 76, bond: 40, paused: false, alwaysOnTop: true };

function statePath() { return path.join(app.getPath('userData'), 'jinzhu-state.json'); }
function loadState() {
  try { state = Object.assign(state, JSON.parse(fs.readFileSync(statePath(), 'utf8'))); } catch (_) {}
}
function saveState() {
  try { fs.mkdirSync(path.dirname(statePath()), { recursive: true }); fs.writeFileSync(statePath(), JSON.stringify(state, null, 2)); } catch (_) {}
}
function workAreaFor(x, y) {
  const d = screen.getDisplayNearestPoint({ x: Number(x) || 0, y: Number(y) || 0 });
  return d.workArea;
}
function clamp(x, y) {
  const a = workAreaFor(x, y);
  return { x: Math.max(a.x, Math.min(a.x + a.width - SIZE.width, Number(x) || a.x)), y: Math.max(a.y, Math.min(a.y + a.height - SIZE.height, Number(y) || a.y)) };
}
function setPosition(x, y, persist = true) {
  if (!win) return;
  const p = clamp(x, y); win.setPosition(Math.round(p.x), Math.round(p.y), false);
  state.x = p.x; state.y = p.y; if (persist) saveState();
}
function randomDestination() {
  const a = workAreaFor(state.x, state.y);
  return { x: a.x + Math.random() * Math.max(1, a.width - SIZE.width), y: a.y + Math.random() * Math.max(1, a.height - SIZE.height) };
}
function walkOnce() {
  if (!win || state.paused || !win.isVisible()) return;
  const from = win.getPosition(); const destination = randomDestination(); const to = clamp(destination.x, destination.y);
  const duration = 3500 + Math.random() * 2500;
  win.webContents.send('overlay:walk', { from: { x: from[0], y: from[1] }, to, duration });
  clearInterval(walkAnimation); const started = Date.now();
  walkAnimation = setInterval(() => {
    if (!win || state.paused) { clearInterval(walkAnimation); return; }
    const t = Math.min(1, (Date.now() - started) / duration);
    const eased = t * (2 - t); setPosition(from[0] + (to.x - from[0]) * eased, from[1] + (to.y - from[1]) * eased, false);
    if (t >= 1) { clearInterval(walkAnimation); saveState(); }
  }, 50);
}
function scheduleWalk() { clearTimeout(moveTimer); moveTimer = setTimeout(() => { walkOnce(); scheduleWalk(); }, 45000 + Math.random() * 135000); }
function makeTray() {
  const icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='); tray = new Tray(icon); tray.setToolTip('金主桌面宠物');
  tray.on('click', () => win && (win.isVisible() ? win.hide() : win.show()));
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示 / 隐藏金主', click: () => win && (win.isVisible() ? win.hide() : win.show()) },
    { label: '暂停走动', type: 'checkbox', checked: state.paused, click: (i) => { state.paused = i.checked; saveState(); if (!state.paused) scheduleWalk(); } },
    { label: '置顶显示', type: 'checkbox', checked: state.alwaysOnTop, click: (i) => { state.alwaysOnTop = i.checked; win.setAlwaysOnTop(i.checked, 'floating'); saveState(); } },
    { type: 'separator' }, { label: '退出', click: () => app.quit() }
  ]));
}
function createWindow() {
  win = new BrowserWindow({ width: SIZE.width, height: SIZE.height, frame: false, transparent: true, resizable: false, movable: true, hasShadow: false, skipTaskbar: true, alwaysOnTop: state.alwaysOnTop, show: false, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false } });
  win.setMenuBarVisibility(false); win.loadFile(path.join(__dirname, 'renderer.html'));
  win.once('ready-to-show', () => { setPosition(state.x, state.y, false); win.show(); scheduleWalk(); });
  win.on('move', () => { const p = win.getPosition(); state.x = p[0]; state.y = p[1]; saveState(); });
  screen.on('display-metrics-changed', () => setPosition(state.x, state.y));
}
app.whenReady().then(() => { loadState(); createWindow(); makeTray(); });
app.on('window-all-closed', (e) => e.preventDefault());
app.on('before-quit', () => { clearTimeout(moveTimer); clearTimeout(dragTimer); clearInterval(walkAnimation); saveState(); });
ipcMain.handle('overlay:get-state', () => state);
ipcMain.on('overlay:save-state', (_, next) => { state = Object.assign(state, next || {}); saveState(); });
ipcMain.on('overlay:set-position', (_, p) => setPosition(p && p.x, p && p.y));
ipcMain.on('overlay:drag-delta', (_, delta) => { if (!win || !delta) return; const p = win.getPosition(); setPosition(p[0] + (Number(delta.dx) || 0), p[1] + (Number(delta.dy) || 0)); });
ipcMain.on('overlay:dragging', (_, active) => { if (active) clearTimeout(moveTimer); else scheduleWalk(); });
ipcMain.on('overlay:toggle-pause', () => { state.paused = !state.paused; saveState(); if (!state.paused) scheduleWalk(); });
ipcMain.on('overlay:toggle-top', () => { state.alwaysOnTop = !state.alwaysOnTop; if (win) win.setAlwaysOnTop(state.alwaysOnTop, 'floating'); saveState(); });
ipcMain.on('overlay:hide', () => win && win.hide());
