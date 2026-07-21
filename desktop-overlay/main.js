const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
if (process.stdout) process.stdout.on('error', () => {});
if (process.stderr) process.stderr.on('error', () => {});

const SIZE = { width: 280, height: 220 };
const HOME_SIZE = { width: 300, height: 190 };
let win, homeWin, tray, behaviorTimer, dragTimer, walkAnimation, currentBehavior = 'idle', lastSpeech = '', movementTarget = null, scheduleVersion = 0;
let state = { x: 40, y: 120, homeX: null, homeY: null, mood: 72, fullness: 76, hydration: 72, bond: 40, foodAmount: 3, paused: false, alwaysOnTop: true, lastNeedsUpdate: Date.now() };

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

function statePath() { return path.join(app.getPath('userData'), 'jinzhuDesktopPetState.json'); }
function diagnosticPath() { return path.join(app.getPath('userData'), 'jinzhu-diagnostics.log'); }
function assetDirectory() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'jinzhu')
    : path.join(app.getAppPath(), '..', 'assets', 'jinzhu');
}
function assetPath(fileName) { return path.join(assetDirectory(), fileName); }
function desktopAnimationDirectory(){return app.isPackaged?path.join(process.resourcesPath,'assets','jinzhu-desktop'):path.join(app.getAppPath(),'..','assets','jinzhu-desktop');}
function propDirectory() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'jinzhu-home')
    : path.join(app.getAppPath(), '..', 'assets', 'jinzhu-home');
}
function propPath(fileName) { return path.join(propDirectory(), fileName); }
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
  try { fs.readdirSync(desktopAnimationDirectory()).filter((name)=>/\.png$/i.test(name)).forEach((name)=>{assetUrls[name]=pathToFileURL(path.join(desktopAnimationDirectory(),name)).href;}); } catch(error){appendDiagnostic('desktop-animation-error',{error:error.message});}
  const propUrls = {};
  ['home-basket.png','food-bowl.png','water-bowl.png'].forEach((name) => { const file=propPath(name); if (fs.existsSync(file)) propUrls[name]=pathToFileURL(file).href; });
  return { packaged: app.isPackaged, resourcesPath: process.resourcesPath, appPath: app.getAppPath(), assetDirectory: directory, idlePath, idleExists: fs.existsSync(idlePath), assetCount: Object.keys(assetUrls).length, assetUrls, propUrls, diagnosticPath: diagnosticPath() };
}
function loadState() {
  try {
    let file=statePath(), legacy=path.join(app.getPath('userData'),'jinzhu-state.json');
    if(!fs.existsSync(file)&&fs.existsSync(legacy)) file=legacy;
    const saved=JSON.parse(fs.readFileSync(file, 'utf8'));
    state = Object.assign(state, saved.jinzhuDesktopPetState||saved);
  } catch (_) {}
  const now=Date.now(), elapsed=Math.max(0,now-(Number(state.lastNeedsUpdate)||now));
  state.fullness=Math.max(0,Number(state.fullness||0)-elapsed/3600000*2);
  state.hydration=Math.max(0,Number(state.hydration||0)-elapsed/3600000*3);
  state.lastNeedsUpdate=now;
}
function saveState() {
  try { fs.mkdirSync(path.dirname(statePath()), { recursive: true }); fs.writeFileSync(statePath(), JSON.stringify({jinzhuDesktopPetState:state}, null, 2)); } catch (_) {}
}
function workAreaFor(x, y) {
  const point = Number.isFinite(Number(x)) && Number.isFinite(Number(y)) ? { x: Number(x), y: Number(y) } : screen.getPrimaryDisplay().workArea;
  const d = screen.getDisplayNearestPoint({ x: point.x, y: point.y });
  return d.workArea;
}
function windowExtent() {
  if (win && !win.isDestroyed()) {
    const bounds = win.getBounds();
    return { width: bounds.width || SIZE.width, height: bounds.height || SIZE.height };
  }
  return { width: SIZE.width, height: SIZE.height };
}
function clamp(x, y) {
  const a = workAreaFor(x, y);
  const extent = windowExtent();
  const requestedX = Number.isFinite(Number(x)) ? Number(x) : a.x;
  const requestedY = Number.isFinite(Number(y)) ? Number(y) : a.y;
  const safeX = Math.max(a.x, Math.min(a.x + a.width - extent.width, requestedX));
  const safeY = Math.max(a.y, Math.min(a.y + a.height - extent.height, requestedY));
  return { x: safeX, y: safeY, clamped: safeX !== requestedX || safeY !== requestedY, workArea: a, extent, requestedX, requestedY };
}
function setPosition(x, y, persist = true) {
  if (!win) return;
  const p = clamp(x, y);
  win.setBounds({ x: Math.round(p.x), y: Math.round(p.y), width: SIZE.width, height: SIZE.height }, false);
  const actual = win.getBounds(); state.x = actual.x; state.y = actual.y; if (persist) saveState();
  if (p.clamped) appendDiagnostic('position-clamped', { requested: { x: p.requestedX, y: p.requestedY }, actual: { x: actual.x, y: actual.y }, windowSize: { width: actual.width, height: actual.height }, workArea: p.workArea });
}
function randomBetween(min,max){ return min+Math.random()*(max-min); }
function sayFrom(pool){ const choices=pool.filter((line)=>line!==lastSpeech); const line=choices[Math.floor(Math.random()*choices.length)]||pool[0]||''; lastSpeech=line; return line; }
function displayForExploration(){
  const displays=screen.getAllDisplays(), primary=screen.getPrimaryDisplay(), current=screen.getDisplayNearestPoint({x:Number(state.x)||0,y:Number(state.y)||0});
  if(displays.length>1&&Math.random()<.08) return displays[Math.floor(Math.random()*displays.length)];
  return Math.random()<.18?primary:current;
}
function explorationTarget(kind){
  const a=displayForExploration().workArea, extent=windowExtent(), maxX=a.x+a.width-extent.width, maxY=a.y+a.height-extent.height, cursor=screen.getCursorScreenPoint();
  const type=kind||['random','corner','edge','taskbar','clock','cursor'][Math.floor(Math.random()*6)];
  if(type==='corner'){ const corners=[[a.x,a.y],[maxX,a.y],[a.x,maxY],[maxX,maxY]]; const p=corners[Math.floor(Math.random()*corners.length)]; return {x:p[0],y:p[1],type}; }
  if(type==='edge'){ const side=Math.floor(Math.random()*4); return {x:side===0?a.x:side===1?maxX:randomBetween(a.x,maxX),y:side===2?a.y:side===3?maxY:randomBetween(a.y,maxY),type}; }
  if(type==='taskbar') return {x:randomBetween(a.x,maxX),y:maxY,type};
  if(type==='clock') return {x:randomBetween(a.x+a.width*.2,Math.max(a.x+a.width*.2,maxX-a.width*.15)),y:randomBetween(a.y,a.y+a.height*.32),type};
  if(type==='cursor') return {x:cursor.x+(Math.random()<.5?-220:80),y:cursor.y-110,type};
  return {x:randomBetween(a.x,maxX),y:randomBetween(a.y,maxY),type:'random'};
}
function sendBehavior(name,duration,speech,extra){
  currentBehavior=name; state.currentBehavior=name; saveState();
  if(win&&!win.isDestroyed()) win.webContents.send('overlay:behavior',Object.assign({name,duration,speech:speech||''},extra||{}));
  if(homeWin&&!homeWin.isDestroyed()) homeWin.webContents.send('home:pet-state',{behavior:name,foodAmount:state.foodAmount,fullness:state.fullness,hydration:state.hydration});
  appendDiagnostic('behavior',{name,duration,speech:speech||''});
}
function clearBehaviorSchedule(){clearTimeout(behaviorTimer);behaviorTimer=null;scheduleVersion++;}
function scheduleTask(fn,delay){clearBehaviorSchedule();if(state.paused)return;const version=scheduleVersion;behaviorTimer=setTimeout(()=>{if(version!==scheduleVersion)return;behaviorTimer=null;fn();},delay);}
function scheduleBehavior(delay){scheduleTask(runNextBehavior,delay==null?randomBetween(5000,30000):delay);}
function moveTo(target,moveState,duration,onArrive){
  clearBehaviorSchedule(); clearInterval(walkAnimation);
  if(!win||state.paused)return;
  clearInterval(dragTimer);
  const from=win.getPosition();
  if(Math.hypot(Number(target.x)-from[0],Number(target.y)-from[1])<24) target=explorationTarget('random');
  const to=clamp(target.x,target.y), ms=Math.max(3000,Math.min(12000,duration||randomBetween(3000,12000)));
  movementTarget={x:Math.round(to.x),y:Math.round(to.y),type:target.type||'target',started:Date.now()};
  sendBehavior(moveState||'walk',ms,'',{direction:to.x<from[0]?'left':'right',targetType:target.type||'target'});
  appendDiagnostic('movement-start',{state:moveState||'walk',direction:to.x<from[0]?'left':'right',current:{x:from[0],y:from[1]},target:movementTarget,workArea:to.workArea});
  const started=Date.now();
  const sample={x:from[0],y:from[1]};
  dragTimer=setInterval(()=>{
    if(!win||state.paused||!movementTarget)return;
    const now=win.getPosition(), displacement=Math.hypot(now[0]-sample.x,now[1]-sample.y), remaining=Math.hypot(to.x-now[0],to.y-now[1]);
    appendDiagnostic('movement-watchdog',{state:currentBehavior,current:{x:now[0],y:now[1]},target:movementTarget,displacement3s:Number(displacement.toFixed(2)),stuckRecovery:displacement<2&&remaining>5});
    if(displacement<2&&remaining>5){
      clearInterval(walkAnimation);clearInterval(dragTimer);movementTarget=null;
      const escapeDistance=randomBetween(80,160), dx=to.x>=now[0]?-escapeDistance:escapeDistance, dy=to.y>=now[1]?-escapeDistance*.35:escapeDistance*.35;
      let escape=clamp(now[0]+dx,now[1]+dy);
      if(Math.hypot(escape.x-now[0],escape.y-now[1])<24) escape=explorationTarget('random');
      appendDiagnostic('stuck-recovery',{from:{x:now[0],y:now[1]},escape:{x:escape.x,y:escape.y},oldTarget:{x:to.x,y:to.y}});
      moveTo({x:escape.x,y:escape.y,type:'stuck-recovery'},'run',3000,()=>{moveTo(explorationTarget('random'),'walk',randomBetween(4000,8000));});
    } else { sample.x=now[0];sample.y=now[1]; }
  },3000);
  walkAnimation=setInterval(()=>{ if(!win||state.paused){clearInterval(walkAnimation);clearInterval(dragTimer);movementTarget=null;return;} const t=Math.min(1,(Date.now()-started)/ms), eased=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2; setPosition(from[0]+(to.x-from[0])*eased,from[1]+(to.y-from[1])*eased,false); if(t>=1){clearInterval(walkAnimation);clearInterval(dragTimer);movementTarget=null;saveState();appendDiagnostic('movement-arrived',{state:moveState||'walk',current:{x:state.x,y:state.y},target:{x:to.x,y:to.y}}); if(onArrive)onArrive(); else{const rest=Math.random();const next=rest<.45?'idle':rest<.7?'look':rest<.88?'groom':rest<.95?'sleep':'idle';sendBehavior(next,randomBetween(5000,18000));scheduleBehavior(randomBetween(5000,30000));}} },50);
}
function homeTarget(type){
  if(!homeWin||homeWin.isDestroyed())return explorationTarget('corner'); const b=homeWin.getBounds();
  if(type==='food')return{x:b.x-8,y:b.y-35,type:'food-bowl'};
  // The water bowl is on the right side of the home scene.  Place the pet
  // window to its left so the muzzle reaches the bowl edge without the body
  // sitting on top of it (the renderer keeps the bowl as a separate layer).
  if(type==='water')return{x:b.x+95,y:b.y-35,type:'water-bowl'};
  return{x:b.x+23,y:b.y-35,type:'food-bowl'};
}
function goToLifePlace(type,userInitiated){
  const target=homeTarget(type), moving=type==='food'?'go-to-food':'go-to-water';
  const speech=type==='food'?sayFrom(['饭饭时间到啦。','多谢你，我开餐啦。']):'饮啖水先。';
  if(win&&!win.isDestroyed()) win.webContents.send('overlay:speech',speech);
  moveTo(target,moving,randomBetween(3500,8000),()=>{
    if(win&&!win.isDestroyed()){win.setAlwaysOnTop(state.alwaysOnTop,'pop-up-menu');win.moveTop();}
    if(type==='disabled-bed'){
      sendBehavior('enter-bed',2600,''); scheduleTask(()=>{sendBehavior('sleep-in-bed',randomBetween(30000,90000),sayFrom(['窝窝好舒服，你都早点休息。','唔好嘈我，我发紧梦呀。']));scheduleBehavior(randomBetween(30000,90000));},2600);
    }else if(type==='food'){
      sendBehavior('eat-at-bowl',11000,sayFrom(['今日份食物好香。','多谢你，我开餐啦。'])); scheduleTask(()=>{state.fullness=Math.min(100,state.fullness+35);state.foodAmount=Math.max(0,(state.foodAmount||0)-1);saveState();sendBehavior('happy',2400,'食饱啦，继续巡逻。');scheduleBehavior(5000);},11000);
    }else{
      sendBehavior('drink-at-bowl',9000,'我饮水，你都要饮。'); scheduleTask(()=>{state.hydration=Math.min(100,state.hydration+40);saveState();sendBehavior('happy',2200,'饮完啦。');scheduleBehavior(5000);},9000);
    }
  });
}
function runNextBehavior(){
  if(state.paused||!win||!win.isVisible())return;
  if(state.fullness<32){goToLifePlace('food');return;} if(state.hydration<30){goToLifePlace('water');return;}
  const hour=new Date().getHours(); if((hour>=23||hour<7)&&Math.random()<.55){sendBehavior('idle',randomBetween(8000,16000),'夜晚啦，安静陪住你。');scheduleBehavior(randomBetween(12000,24000));return;}
  const roll=Math.random()*100;
  if(roll<18){const name=Math.random()<.35?'blink':Math.random()<.55?'look':'idle';sendBehavior(name,randomBetween(3000,9000));scheduleBehavior(randomBetween(5000,14000));return;}
  if(roll<53){const run=Math.random()<.4;moveTo(explorationTarget(),run?'run':'walk',run?randomBetween(3000,6000):randomBetween(4500,10000));return;}
  if(roll<66){sendBehavior(Math.random()<.5?'groom':'look',randomBetween(5000,10000));scheduleBehavior(randomBetween(8000,18000));return;}
  if(roll<75){sendBehavior('groom',randomBetween(6000,15000),Math.random()<.25?'整理下毛先。':'');scheduleBehavior(randomBetween(8000,25000));return;}
  if(roll<85){const name=Math.random()<.55?'roll':'play';sendBehavior(name,randomBetween(5000,10000));scheduleBehavior(randomBetween(8000,22000));return;}
  if(roll<95){moveTo(explorationTarget(Math.random()<.55?'cursor':'corner'),'investigate',randomBetween(3500,8000),()=>{sendBehavior('look',randomBetween(4000,8000),'我过嚟睇下你。');scheduleBehavior(randomBetween(8000,25000));});return;}
  if(Math.random()<.5)goToLifePlace(Math.random()<.5?'food':'water');else{sendBehavior('reminder',5000,sayFrom(['饮水了吗？','休息一下眼睛吧。','金主在这里陪你。']));scheduleBehavior(15000);}
}
function reactToInteraction(action) {
  if (!action || state.paused) return;
  if(action.type==='hover'&&(movementTarget||['eat-at-bowl','drink-at-bowl','held'].indexOf(currentBehavior)>=0))return;
  clearBehaviorSchedule(); clearInterval(walkAnimation);
  if (action.type === 'hover') {
    if (['idle', 'look', 'blink'].indexOf(currentBehavior) >= 0) { sendBehavior(Math.random() < .5 ? 'look' : 'blink', 1400, ''); scheduleBehavior(4000); }
    return;
  }
  if (action.type === 'held') { sendBehavior('held', 999999, '轻轻抱住我。'); return; }
  if (action.type === 'drop') {
    sendBehavior('fall', 900, '');
    scheduleTask(() => { sendBehavior(Math.random() < .5 ? 'happy' : 'surprised', 2200, sayFrom(['放低我啦。', '哼，算你接得稳。'])); scheduleBehavior(4500); }, 900);
    return;
  }
  if (action.type === 'click' && currentBehavior === 'disabled-sleep') {
    if (Math.random() < .45) { sendBehavior('sleep-in-bed', 12000, '唔好嘈我，我发紧梦呀。'); scheduleBehavior(12000); return; }
    sendBehavior('wake', 1800, '再瞓多阵都唔得咩？');
    scheduleTask(() => { sendBehavior('stretch-after-sleep', 2600, ''); scheduleBehavior(4500); }, 1800);
    return;
  }
  state.mood = Math.min(100, Number(state.mood || 0) + 2); state.bond = Math.min(100, Number(state.bond || 0) + 1); saveState();
  const reactions = [
    ['happy', '摸到我啦。'], ['pet', '嗯，舒服。'], ['blink', '再摸一下嘛。'],
    ['look', '你终于发现我啦。'], ['roll', '我而家心情好好。'], ['stretch', '陪我行两步先。'],
    ['groom', '轻轻摸，唔好整乱我啲毛。'], ['yawn', '今日辛苦啦。'],
    ['scratch', '金主批准你继续工作。'], ['surprised', '今日都记得陪我。']
  ];
  if (Math.random() < .2) {
    const cursor = screen.getCursorScreenPoint();
    moveTo({ x: cursor.x + (Math.random() < .5 ? -320 : 160), y: cursor.y - 120, type: 'escape' }, 'run', randomBetween(3000, 5000), () => { sendBehavior('look', 2600, '捉我唔到。'); scheduleBehavior(6000); });
    return;
  }
  const reaction = reactions[Math.floor(Math.random() * reactions.length)];
  sendBehavior(reaction[0], randomBetween(1800, 3500), reaction[1]); scheduleBehavior(randomBetween(5000, 12000));
}
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
  tray.on('click', () => { if(!win)return; const visible=win.isVisible(); visible?win.hide():win.show(); if(homeWin)(visible?homeWin.hide():homeWin.show()); });
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示 / 隐藏金主', click: () => { if(!win)return; const visible=win.isVisible(); visible?win.hide():win.show(); if(homeWin)(visible?homeWin.hide():homeWin.show()); } },
    { label: '暂停走动', type: 'checkbox', checked: state.paused, click: (i) => { state.paused = i.checked; saveState(); clearBehaviorSchedule(); clearInterval(walkAnimation); if (!state.paused) scheduleBehavior(1500); } },
    { label: '置顶显示', type: 'checkbox', checked: state.alwaysOnTop, click: (i) => { state.alwaysOnTop = i.checked; win.setAlwaysOnTop(i.checked, 'pop-up-menu'); if(homeWin)homeWin.setAlwaysOnTop(i.checked,'floating'); saveState(); } },
    { type: 'separator' },
    { label: '打开诊断日志', click: () => shell.openPath(diagnosticPath()) },
    { type: 'separator' }, { label: '退出', click: quitApplication }
  ]));
}
function setHomePosition(x,y,persist=true){
  if(!homeWin)return; const a=screen.getDisplayNearestPoint({x:Number(x)||0,y:Number(y)||0}).workArea;
  const safeX=Math.max(a.x+55,Math.min(a.x+a.width-HOME_SIZE.width-110,Number(x)||a.x+55));
  const safeY=Math.max(a.y+140,Math.min(a.y+a.height-HOME_SIZE.height,Number(y)||a.y+140));
  homeWin.setBounds({x:Math.round(safeX),y:Math.round(safeY),width:HOME_SIZE.width,height:HOME_SIZE.height},false);
  const b=homeWin.getBounds();state.homeX=b.x;state.homeY=b.y;if(persist)saveState();
}
function createHomeWindow(){
  const preloadPath=path.join(__dirname,'home-preload.js'),rendererPath=path.join(__dirname,'home.html');
  homeWin=new BrowserWindow({width:HOME_SIZE.width,height:HOME_SIZE.height,frame:false,transparent:true,resizable:false,maximizable:false,fullscreenable:false,movable:true,hasShadow:false,skipTaskbar:true,alwaysOnTop:state.alwaysOnTop,show:false,backgroundColor:'#00000000',webPreferences:{preload:preloadPath,contextIsolation:true,nodeIntegration:false,sandbox:false}});
  homeWin.setMenuBarVisibility(false);homeWin.loadFile(rendererPath).catch((error)=>appendDiagnostic('home-load-error',{error:error.message}));
  homeWin.setAlwaysOnTop(state.alwaysOnTop,'floating');
  homeWin.once('ready-to-show',()=>{const a=screen.getPrimaryDisplay().workArea;if(state.homeX==null||state.homeY==null){state.homeX=a.x+a.width-HOME_SIZE.width-20;state.homeY=a.y+a.height-HOME_SIZE.height-20;}setHomePosition(state.homeX,state.homeY,false);homeWin.showInactive();appendDiagnostic('home-ready',{bounds:homeWin.getBounds(),props:bootstrapInfo().propUrls});});
  homeWin.on('move',()=>{const b=homeWin.getBounds();state.homeX=b.x;state.homeY=b.y;saveState();});
}
function createWindow() {
  try {
    const preloadPath = path.join(__dirname, 'preload.js');
    const rendererPath = path.join(__dirname, 'renderer.html');
    appendDiagnostic('window-create', { preloadPath, preloadExists: fs.existsSync(preloadPath), rendererPath, rendererExists: fs.existsSync(rendererPath) });
    win = new BrowserWindow({ width: SIZE.width, height: SIZE.height, frame: false, transparent: true, resizable: false, maximizable: false, fullscreenable: false, movable: true, hasShadow: false, skipTaskbar: true, alwaysOnTop: state.alwaysOnTop, show: false, backgroundColor: '#00000000', webPreferences: { preload: preloadPath, contextIsolation: true, nodeIntegration: false, sandbox: false } });
    win.setMenuBarVisibility(false);
    win.setAlwaysOnTop(state.alwaysOnTop,'pop-up-menu');
    win.loadFile(rendererPath).catch((error) => appendDiagnostic('renderer-load-error', { error: error.message, stack: error.stack }));
    win.webContents.on('did-fail-load', (_, code, description, url) => appendDiagnostic('renderer-did-fail-load', { code, description, url }));
    win.webContents.on('render-process-gone', (_, details) => appendDiagnostic('renderer-process-gone', details));
    win.webContents.on('console-message', (_, level, message, line, sourceId) => appendDiagnostic('renderer-console', { level, message, line, sourceId }));
  } catch (error) {
    appendDiagnostic('window-create-error', { error: error.message, stack: error.stack });
    return;
  }
  win.once('ready-to-show', () => {
    win.show(); setPosition(state.x, state.y, false);
    const bounds=win.getBounds(); appendDiagnostic('window-ready', { bounds, workArea: workAreaFor(bounds.x, bounds.y) });
    if (process.argv.includes('--jinzhu-test-boundaries')) {
      const a=screen.getPrimaryDisplay().workArea;
      [[a.x-100,a.y-100],[a.x+a.width+100,a.y-100],[a.x+a.width+100,a.y+a.height+100],[a.x-100,a.y+a.height+100]].forEach((point) => setPosition(point[0],point[1],false));
      appendDiagnostic('boundary-smoke-complete', { bounds: win.getBounds(), workArea: a, windowSize: windowExtent() });
    }
    scheduleBehavior(2500);
  });
  win.on('move', () => { const p = win.getPosition(); state.x = p[0]; state.y = p[1]; saveState(); });
  function resetForDisplayChange(label){clearInterval(walkAnimation);clearInterval(dragTimer);movementTarget=null;appendDiagnostic(label,{current:{x:state.x,y:state.y},state:currentBehavior});setPosition(state.x,state.y);setHomePosition(state.homeX,state.homeY);scheduleBehavior(1200);}
  screen.on('display-metrics-changed', () => resetForDisplayChange('display-metrics-changed'));
  screen.on('display-added', () => resetForDisplayChange('display-added'));
  screen.on('display-removed', () => resetForDisplayChange('display-removed'));
}
app.whenReady().then(() => {
  if (!instanceLock) return;
  const info = bootstrapInfo();
  appendDiagnostic('startup', { packaged: info.packaged, resourcesPath: info.resourcesPath, appPath: info.appPath, idlePath: info.idlePath, idleExists: info.idleExists, assetCount: info.assetCount, hardwareAcceleration: false, singleInstance: true });
  loadState(); createHomeWindow(); createWindow(); makeTray();
  if (process.argv.includes('--jinzhu-test-tray-exit')) setTimeout(quitApplication, 3000);
  if(process.argv.includes('--jinzhu-test-life')){
    setTimeout(()=>goToLifePlace('food',true),3000);
    setTimeout(()=>goToLifePlace('water',true),25000);
    setTimeout(quitApplication,59000);
  }
}).catch((error) => appendDiagnostic('ready-error', { error: error.message, stack: error.stack }));
app.on('second-instance', () => { appendDiagnostic('second-instance-blocked', {}); if (win) { if (!win.isVisible()) win.show(); win.focus(); } });
app.on('child-process-gone', (_, details) => appendDiagnostic('child-process-gone', details));
app.on('window-all-closed', (e) => e.preventDefault());
app.on('before-quit', () => { clearBehaviorSchedule(); clearInterval(dragTimer); clearInterval(walkAnimation); saveState(); });
ipcMain.handle('overlay:get-state', () => state);
ipcMain.handle('overlay:get-bootstrap', () => bootstrapInfo());
ipcMain.on('overlay:image-result', (_, result) => appendDiagnostic('image-' + (result && result.status || 'unknown'), result));
ipcMain.on('overlay:viewport-metrics', (_, metrics) => { const bounds=win && win.getBounds(); appendDiagnostic('viewport-metrics', Object.assign({}, metrics || {}, { windowBounds: bounds, workArea: bounds && workAreaFor(bounds.x, bounds.y), petPosition: { x: state.x, y: state.y } })); });
ipcMain.on('overlay:save-state', (_, next) => { state = Object.assign(state, next || {}); saveState(); });
ipcMain.on('overlay:set-position', (_, p) => setPosition(p && p.x, p && p.y));
ipcMain.on('overlay:drag-delta', (_, delta) => { if (!win || !delta) return; const p = win.getPosition(); setPosition(p[0] + (Number(delta.dx) || 0), p[1] + (Number(delta.dy) || 0)); });
ipcMain.on('overlay:dragging', (_, active) => { if (active) { clearBehaviorSchedule(); clearInterval(dragTimer); clearInterval(walkAnimation); movementTarget=null; } else scheduleBehavior(3500); });
ipcMain.on('overlay:interaction', (_, action) => reactToInteraction(action));
ipcMain.on('overlay:toggle-pause', () => { state.paused = !state.paused; saveState(); clearBehaviorSchedule(); clearInterval(walkAnimation); if (!state.paused) scheduleBehavior(1500); });
ipcMain.on('overlay:toggle-top', () => { state.alwaysOnTop = !state.alwaysOnTop; if (win) win.setAlwaysOnTop(state.alwaysOnTop, 'pop-up-menu'); if(homeWin)homeWin.setAlwaysOnTop(state.alwaysOnTop,'floating'); saveState(); });
ipcMain.on('overlay:hide', () => win && win.hide());
ipcMain.handle('home:get-bootstrap', () => bootstrapInfo());
ipcMain.on('home:action', (_, type) => { if (type === 'food') { state.foodAmount = Math.max(1, Number(state.foodAmount || 0)); goToLifePlace('food', true); } else if (type === 'water') goToLifePlace('water', true); });
ipcMain.on('home:drag-delta', (_, delta) => { if (!homeWin || !delta) return; const p = homeWin.getPosition(); setHomePosition(p[0] + (Number(delta.dx) || 0), p[1] + (Number(delta.dy) || 0)); });
process.on('uncaughtException', (error) => appendDiagnostic('uncaught-exception', { error: error.message, stack: error.stack }));
process.on('unhandledRejection', (error) => appendDiagnostic('unhandled-rejection', { error: String(error), stack: error && error.stack }));
