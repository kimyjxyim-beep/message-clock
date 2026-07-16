(function () {
  'use strict';
  var assetUrls = {};
  var frames = { idle:['idle-1.png','idle-2.png'], walk:['walk-1.png','walk-2.png','walk-3.png','walk-4.png'], happy:['happy-1.png','happy-2.png'], sleep:['sleep-curl-1.png','sleep-curl-2.png','sleep-curl-3.png'], eat:['eat-1.png','eat-2.png','eat-3.png','eat-4.png','eat-5.png'] };
  var cat = document.getElementById('cat'), pet = document.getElementById('pet'), bubble = document.getElementById('bubble');
  var state = { mood:72, fullness:76, bond:40 }, frameTimer, bubbleTimer, dragging = false, firstLoadReported = false, lastPointer = {x:0,y:0};
  function say(text) { bubble.textContent = text; bubble.classList.add('show'); clearTimeout(bubbleTimer); bubbleTimer = setTimeout(function(){ bubble.classList.remove('show'); }, 4200); }
  function frameUrl(name) { return assetUrls[name] || ''; }
  function showFrame(name) { var url=frameUrl(name); if(!url){ console.error('[Jinzhu] Missing packaged asset URL:',name); cat.style.visibility='hidden'; return; } cat.src=url; }
  function play(kind, duration) { var list = frames[kind] || frames.idle, i=0; clearInterval(frameTimer); showFrame(list[0]); frameTimer = setInterval(function(){ i=(i+1)%list.length; showFrame(list[i]); }, kind==='sleep'?1200:260); setTimeout(function(){ clearInterval(frameTimer); showFrame(list[0]); }, duration || 2200); }
  function save() { window.jinzhuOverlay.saveState({mood:state.mood,fullness:state.fullness,bond:state.bond}); }
  function petCat() { state.mood=Math.min(100,state.mood+3); state.bond=Math.min(100,state.bond+1); save(); play('happy',2000); say(state.bond>80?'嗯，继续摸。':'哼，算你识做。'); }
  pet.addEventListener('click', petCat);
  pet.addEventListener('pointerdown', function(e){ dragging=true; lastPointer.x=e.screenX; lastPointer.y=e.screenY; window.jinzhuOverlay.setDragging(true); pet.setPointerCapture(e.pointerId); });
  pet.addEventListener('pointermove', function(e){ if(!dragging)return; window.jinzhuOverlay.dragDelta({dx:e.screenX-lastPointer.x,dy:e.screenY-lastPointer.y}); lastPointer.x=e.screenX; lastPointer.y=e.screenY; });
  pet.addEventListener('pointerup', function(e){ dragging=false; window.jinzhuOverlay.setDragging(false); try{pet.releasePointerCapture(e.pointerId);}catch(_){} });
  cat.addEventListener('load',function(){ cat.style.visibility='visible'; if(!firstLoadReported){ firstLoadReported=true; window.jinzhuOverlay.reportImageResult({status:'load',src:cat.currentSrc||cat.src}); } });
  cat.addEventListener('error',function(){ var failed=cat.currentSrc||cat.src; console.error('[Jinzhu] Image load failed:',failed); window.jinzhuOverlay.reportImageResult({status:'error',src:failed}); cat.removeAttribute('src'); cat.style.visibility='hidden'; say('素材加载失败，请查看诊断日志。'); });
  window.jinzhuOverlay.onWalk(function(data){ if(!data)return; play('walk',data.duration); var dx=data.to.x-data.from.x; cat.style.transform=dx<0?'scaleX(-1)':'scaleX(1)'; });
  Promise.all([window.jinzhuOverlay.getBootstrap(),window.jinzhuOverlay.getState()]).then(function(result){ var info=result[0]||{}, saved=result[1]||{}; assetUrls=info.assetUrls||{}; state=Object.assign(state,saved); console.info('[Jinzhu] startup diagnostics',{packaged:info.packaged,resourcesPath:info.resourcesPath,idlePath:info.idlePath,idleExists:info.idleExists,assetCount:info.assetCount}); play('idle',999999); if(state.fullness<25)say('个饭碗好似空咗喔。'); }).catch(function(error){ console.error('[Jinzhu] Bootstrap failed:',error); cat.style.visibility='hidden'; say('启动失败，请查看诊断日志。'); });
  setInterval(function(){ if(document.hidden)return; var h=new Date().getHours(); if(h>=23||h<7){play('sleep',12000);say('zzZ');} else if(Math.random()<.18){say('金主喺度陪你。');} },60000);
}());
