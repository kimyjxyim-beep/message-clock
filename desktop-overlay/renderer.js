(function () {
  'use strict';
  var assetUrls = {}, cat = document.getElementById('cat'), pet = document.getElementById('pet'), bubble = document.getElementById('bubble');
  var frameTimer = null, bubbleTimer = null, firstLoadReported = false, pointer = null, hoverAt = 0, facing = 'right';
  var frames = {
    idle:['idle-1.png','idle-2.png'], blink:['idle-1.png','idle-3.png','idle-1.png'], look:['look-1.png','look-2.png','look-3.png','look-4.png','look-5.png'],
    walk:['walk-1.png','walk-2.png','walk-3.png','walk-4.png','walk-5.png','walk-6.png','walk-7.png'], run:['walk-1.png','walk-3.png','walk-5.png','walk-7.png'],
    happy:['happy-1.png','happy-2.png','happy-3.png','happy-4.png'], pet:['happy-1.png','happy-2.png','happy-4.png'],
    stretch:['perch-1.png','perch-2.png','look-5.png'], groom:['groom-1.png','groom-2.png','groom-3.png','groom-4.png'], scratch:['groom-2.png','groom-4.png'], yawn:['idle-5.png','look-5.png'],
    sleep:['sleep-curl-1.png','sleep-curl-2.png','sleep-curl-3.png'], wake:['sleep-curl-2.png','idle-4.png','idle-1.png'],
    eat:['eat-1.png','eat-2.png','eat-3.png','eat-4.png','eat-5.png'], drink:['eat-2.png','eat-3.png','eat-4.png'],
    play:['roll-1.png','roll-2.png','roll-3.png','roll-4.png'], roll:['roll-1.png','roll-2.png','roll-3.png','roll-4.png','roll-5.png','roll-6.png'],
    held:['roll-2.png','roll-3.png'], fall:['roll-4.png','roll-5.png','roll-6.png'], surprised:['look-1.png','look-5.png'], rain:['rain-1.png','rain-2.png','rain-3.png','rain-4.png'], reminder:['idle-1.png','look-1.png'],
    investigate:['walk-1.png','walk-2.png','walk-3.png','walk-4.png'], 'go-home':['walk-1.png','walk-2.png','walk-3.png','walk-4.png'],
    'enter-bed':['bed-1.png','bed-2.png','bed-3.png','bed-4.png'], 'sleep-in-bed':['bed-5.png','bed-6.png'],
    'stretch-after-sleep':['bed-6.png','bed-4.png','idle-4.png','perch-2.png'], 'go-to-food':['walk-1.png','walk-2.png','walk-3.png','walk-4.png'],
    'eat-at-bowl':['eat-1.png','eat-2.png','eat-3.png','eat-4.png','eat-5.png'], 'go-to-water':['walk-1.png','walk-2.png','walk-3.png','walk-4.png'],
    'drink-at-bowl':['eat-1.png','eat-2.png','eat-3.png','eat-4.png','eat-5.png']
  };
  function say(text) { if(!text)return; bubble.textContent=text; bubble.classList.add('show'); clearTimeout(bubbleTimer); bubbleTimer=setTimeout(function(){bubble.classList.remove('show');},4200); }
  function showFrame(name) { var url=assetUrls[name]; if(!url){console.error('[Jinzhu] Missing asset:',name);return;} cat.src=url; }
  function applyBehavior(data) {
    if(!data)return; var name=data.name||'idle', list=frames[name]||frames.idle, index=0;
    clearInterval(frameTimer); showFrame(list[0]);
    if(data.direction){facing=data.direction;cat.style.transform=facing==='left'?'scaleX(-1)':'scaleX(1)';}
    var delay=name==='sleep'||name==='sleep-in-bed'?1300:name==='walk'||name==='run'||name.indexOf('go-')===0?180:320;
    frameTimer=setInterval(function(){index=(index+1)%list.length;showFrame(list[index]);},delay);
    if(data.speech)say(data.speech);
  }
  function reportViewport(){window.jinzhuOverlay.reportViewportMetrics({innerWidth:window.innerWidth,innerHeight:window.innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,hasHorizontalScrollbar:document.documentElement.scrollWidth>window.innerWidth,hasVerticalScrollbar:document.documentElement.scrollHeight>window.innerHeight});}
  pet.addEventListener('pointerdown',function(e){pointer={id:e.pointerId,x:e.screenX,y:e.screenY,lastX:e.screenX,lastY:e.screenY,dragged:false};pet.setPointerCapture(e.pointerId);});
  pet.addEventListener('pointermove',function(e){if(!pointer)return;var total=Math.abs(e.screenX-pointer.x)+Math.abs(e.screenY-pointer.y);if(total>5&&!pointer.dragged){pointer.dragged=true;window.jinzhuOverlay.setDragging(true);window.jinzhuOverlay.interaction({type:'held'});}if(pointer.dragged){window.jinzhuOverlay.dragDelta({dx:e.screenX-pointer.lastX,dy:e.screenY-pointer.lastY});pointer.lastX=e.screenX;pointer.lastY=e.screenY;}});
  function finishPointer(e){if(!pointer)return;var dragged=pointer.dragged;try{pet.releasePointerCapture(pointer.id);}catch(_){}pointer=null;if(dragged){window.jinzhuOverlay.setDragging(false);window.jinzhuOverlay.interaction({type:'drop'});}else window.jinzhuOverlay.interaction({type:'click'});}
  pet.addEventListener('pointerup',finishPointer);pet.addEventListener('pointercancel',finishPointer);
  pet.addEventListener('mouseenter',function(){var now=Date.now();if(now-hoverAt>5000){hoverAt=now;window.jinzhuOverlay.interaction({type:'hover'});}});
  cat.addEventListener('load',function(){cat.style.visibility='visible';if(!firstLoadReported){firstLoadReported=true;window.jinzhuOverlay.reportImageResult({status:'load',src:cat.currentSrc||cat.src});}});
  cat.addEventListener('error',function(){var failed=cat.currentSrc||cat.src;console.error('[Jinzhu] Image load failed:',failed);window.jinzhuOverlay.reportImageResult({status:'error',src:failed});cat.removeAttribute('src');cat.style.visibility='hidden';});
  window.jinzhuOverlay.onBehavior(applyBehavior);window.jinzhuOverlay.onSpeech(say);
  window.jinzhuOverlay.getBootstrap().then(function(info){assetUrls=info.assetUrls||{};console.info('[Jinzhu] assets',{packaged:info.packaged,count:info.assetCount,idle:info.idlePath});applyBehavior({name:'idle'});reportViewport();}).catch(function(error){console.error('[Jinzhu] Bootstrap failed:',error);});
  window.addEventListener('resize',reportViewport);
}());
