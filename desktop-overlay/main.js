const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
if (process.stdout) process.stdout.on('error', () => {});
if (process.stderr) process.stderr.on('error', () => {});

const SIZE = { width: 220, height: 190 };
const WALLPAPER_URL = 'https://kimyjxyim-beep.github.io/message-clock/?wallpaper=1';
let win, tray, moveTimer, dragTimer, walkAnimation;
let state = { x: 40, y: 120, mood: 72, fullness: 76, bond: 40, paused: false, alwaysOnTop: true };

/* Electron's GPU subprocess crashes on some older/incomplete Windows graphics
   runtimes. The pet is a tiny transparent sprite window and does not need GPU
   acceleration, so disable it before app readiness. */
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
let userDataSetupError = null;
try {
  const localAppData = process.env.LOCALAPPDATA || app.getPath('appData');
  const userDataDirectory = path.join(localAppData, 'JinzhuDesktopPet');
  fs.mkdirSync(userDataDirectory, { recursive: true });
  app.setPath('userData', userDataDirectory);
} catch (error) {
  userDataSetupError = { error: error.message, stack: error.stack };
}
const instanceLock = app.requestSingleInstanceLock();
appendDiagnostic('instance-lock', { acquired: instanceLock, pid: process.pid, userData: app.getPath('userData'), userDataSetupError });
if (!instanceLock) app.quit();

function statePath() { return path.join(app.getPath('userData'), 'jinzhu-state.json'); }
function diagnosticPath() { return path.join(app.getPath('userData'), 'jinzhu-diagnostics.log'); }
function assetDirectory() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'jinzhu')
    : path.join(app.getAppPath(), '..', 'assets', 'jinzhu');
}
function assetPath(fileName) { return path.join(assetDirectory(), fileName); }
function appendDiagnostic(label, details) {
  const line = '[' + new Date().toISOString() + '] ' + label + ' ' + JSON.stringify(details || {}) + '\n';
  try {
    fs.mkdirSync(path.dirname(diagnosticPath()), { recursive: true });
    if (fs.existsSync(diagnosticPath()) && fs.statSync(diagnosticPath()).size > 2 * 1024 * 1024) fs.writeFileSync(diagnosticPath(), '', 'utf8');
    fs.appendFileSync(diagnosticPath(), line, 'utf8');
  } catch (_) {}
  try { console.log('[Jinzhu]', label, details || {}); } catch (_) {}
}
function bootstrapInfo() {
  const directory = assetDirectory();
  const idlePath = assetPath('idle-1.png');
  let files = [];
  try { files = fs.readdirSync(directory).filter((name) => /\.png$/i.test(name)); } catch (error) { appendDiagnostic('asset-directory-error', { directory, error: error.message }); }
  const assetUrls = {};
  files.forEach((name) => { assetUrls[name] = pathToFileURL(path.join(directory, name)).href; });
  return { packaged: app.isPackaged, resourcesPath: process.resourcesPath, appPath: app.getAppPath(), assetDirectory: directory, idlePath, idleExists: fs.existsSync(idlePath), assetCount: files.length, assetUrls, diagnosticPath: diagnosticPath(), wallpaperUrl: WALLPAPER_URL };
}
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
function quitApplication() { appendDiagnostic('tray-exit', {}); app.quit(); }
function makeTray() {
  const iconPath = assetPath('idle-1.png');
  try {
    if (!fs.existsSync(iconPath)) { appendDiagnostic('tray-skipped', { reason: 'icon-not-found', iconPath }); return; }
    const sourceIcon = nativeImage.createFromPath(iconPath);
    if (sourceIcon.isEmpty()) { appendDiagnostic('tray-skipped', { reason: 'icon-invalid', iconPath }); return; }
    const icon = sourceIcon.resize({ width: 16, height: 16 });
    if (icon.isEmpty()) { appendDiagnostic('tray-skipped', { reason: 'resized-icon-invalid', iconPath }); return; }
    tray = new Tray(icon); tray.setToolTip('金主桌面宠物');
    appendDiagnostic('tray-created', { iconPath, iconExists: true });
  } catch (error) {
    appendDiagnostic('tray-error', { iconPath, error: error.message, stack: error.stack });
    return;
  }
  tray.on('click', () => win && (win.isVisible() ? win.hide() : win.show()));
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示 / 隐藏金主', click: () => win && (win.isVisible() ? win.hide() : win.show()) },
    { label: '暂停走动', type: 'checkbox', checked: state.paused, click: (i) => { state.paused = i.checked; saveState(); if (!state.paused) scheduleWalk(); } },
    { label: '置顶显示', type: 'checkbox', checked: state.alwaysOnTop, click: (i) => { state.alwaysOnTop = i.checked; win.setAlwaysOnTop(i.checked, 'floating'); saveState(); } },
    { type: 'separator' },
    { label: '打开桌面时钟网页', click: () => shell.openExternal(WALLPAPER_URL) },
    { label: '打开诊断日志', click: () => shell.openPath(diagnosticPath()) },
    { type: 'separator' }, { label: '退出', click: quitApplication }
  ]));
}
function createWindow() {
  try {
    const preloadPath = path.join(__dirname, 'preload.js');
    const rendererPath = path.join(__dirname, 'renderer.html');
    appendDiagnostic('window-create', { preloadPath, preloadExists: fs.existsSync(preloadPath), rendererPath, rendererExists: fs.existsSync(rendererPath) });
    win = new BrowserWindow({ width: SIZE.width, height: SIZE.height, frame: false, transparent: true, resizable: false, movable: true, hasShadow: false, skipTaskbar: true, alwaysOnTop: state.alwaysOnTop, show: false, backgroundColor: '#00000000', webPreferences: { preload: preloadPath, contextIsolation: true, nodeIntegration: false, sandbox: false } });
    win.setMenuBarVisibility(false);
    win.loadFile(rendererPath).catch((error) => appendDiagnostic('renderer-load-error', { error: error.message, stack: error.stack }));
    win.webContents.on('did-fail-load', (_, code, description, url) => appendDiagnostic('renderer-did-fail-load', { code, description, url }));
    win.webContents.on('render-process-gone', (_, details) => appendDiagnostic('renderer-process-gone', details));
    win.webContents.on('console-message', (_, level, message, line, sourceId) => appendDiagnostic('renderer-console', { level, message, line, sourceId }));
  } catch (error) {
    appendDiagnostic('window-create-error', { error: error.message, stack: error.stack });
    return;
  }
  win.once('ready-to-show', () => { setPosition(state.x, state.y, false); win.show(); scheduleWalk(); });
  win.on('move', () => { const p = win.getPosition(); state.x = p[0]; state.y = p[1]; saveState(); });
  screen.on('display-metrics-changed', () => setPosition(state.x, state.y));
}
app.whenReady().then(() => {
  if (!instanceLock) return;
  const info = bootstrapInfo();
  appendDiagnostic('startup', { packaged: info.packaged, resourcesPath: info.resourcesPath, appPath: info.appPath, idlePath: info.idlePath, idleExists: info.idleExists, assetCount: info.assetCount, hardwareAcceleration: false, singleInstance: true });
  loadState(); createWindow(); makeTray();
  if (process.argv.includes('--jinzhu-test-tray-exit')) setTimeout(quitApplication, 3000);
}).catch((error) => appendDiagnostic('ready-error', { error: error.message, stack: error.stack }));
app.on('second-instance', () => { appendDiagnostic('second-instance-blocked', {}); if (win) { if (!win.isVisible()) win.show(); win.focus(); } });
app.on('child-process-gone', (_, details) => appendDiagnostic('child-process-gone', details));
app.on('window-all-closed', (e) => e.preventDefault());
app.on('before-quit', () => { clearTimeout(moveTimer); clearTimeout(dragTimer); clearInterval(walkAnimation); saveState(); });
ipcMain.handle('overlay:get-state', () => state);
ipcMain.handle('overlay:get-bootstrap', () => bootstrapInfo());
ipcMain.on('overlay:image-result', (_, result) => appendDiagnostic('image-' + (result && result.status || 'unknown'), result));
ipcMain.on('overlay:save-state', (_, next) => { state = Object.assign(state, next || {}); saveState(); });
ipcMain.on('overlay:set-position', (_, p) => setPosition(p && p.x, p && p.y));
ipcMain.on('overlay:drag-delta', (_, delta) => { if (!win || !delta) return; const p = win.getPosition(); setPosition(p[0] + (Number(delta.dx) || 0), p[1] + (Number(delta.dy) || 0)); });
ipcMain.on('overlay:dragging', (_, active) => { if (active) clearTimeout(moveTimer); else scheduleWalk(); });
ipcMain.on('overlay:toggle-pause', () => { state.paused = !state.paused; saveState(); if (!state.paused) scheduleWalk(); });
ipcMain.on('overlay:toggle-top', () => { state.alwaysOnTop = !state.alwaysOnTop; if (win) win.setAlwaysOnTop(state.alwaysOnTop, 'floating'); saveState(); });
ipcMain.on('overlay:hide', () => win && win.hide());
process.on('uncaughtException', (error) => appendDiagnostic('uncaught-exception', { error: error.message, stack: error.stack }));
process.on('unhandledRejection', (error) => appendDiagnostic('unhandled-rejection', { error: String(error), stack: error && error.stack }));
