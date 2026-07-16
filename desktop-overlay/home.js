(function(){
  'use strict';
  var bed=document.getElementById('bed'),food=document.getElementById('food'),water=document.getElementById('water'),bubble=document.getElementById('home-bubble'),status=document.getElementById('food-status');
  var pointer=null,timer=null;
  function say(text){bubble.textContent=text;bubble.classList.add('show');clearTimeout(timer);timer=setTimeout(function(){bubble.classList.remove('show');},3000);}
  function setImage(button,url){var img=button.querySelector('img');if(url){img.src=url;img.addEventListener('error',function(){img.style.visibility='hidden';console.error('[Jinzhu home] image failed',url);});}}
  function action(type){window.jinzhuHome.action(type);if(type==='bed')say('想返窝窝休息？');else if(type==='food')say('多谢主人，我开餐啦。');else say('饮水时间到啦。');}
  bed.addEventListener('pointerdown',function(e){pointer={id:e.pointerId,x:e.screenX,y:e.screenY,lastX:e.screenX,lastY:e.screenY,dragged:false};bed.setPointerCapture(e.pointerId);});
  bed.addEventListener('pointermove',function(e){if(!pointer)return;if(Math.abs(e.screenX-pointer.x)+Math.abs(e.screenY-pointer.y)>5)pointer.dragged=true;if(pointer.dragged){window.jinzhuHome.dragDelta({dx:e.screenX-pointer.lastX,dy:e.screenY-pointer.lastY});pointer.lastX=e.screenX;pointer.lastY=e.screenY;}});
  function finish(e){if(!pointer)return;var dragged=pointer.dragged;try{bed.releasePointerCapture(pointer.id);}catch(_){}pointer=null;if(!dragged)action('bed');}
  bed.addEventListener('pointerup',finish);bed.addEventListener('pointercancel',finish);
  food.addEventListener('click',function(){action('food');});water.addEventListener('click',function(){action('water');});
  window.jinzhuHome.onPetState(function(state){
    var behavior=state&&state.behavior||'';
    food.classList.toggle('in-use',behavior==='eat-at-bowl');
    water.classList.toggle('in-use',behavior==='drink-at-bowl');
    if(state&&state.foodAmount!=null)status.textContent=String(state.foodAmount);
  });
  window.jinzhuHome.getBootstrap().then(function(info){var props=info.propUrls||{};setImage(bed,props['home-basket.png']);setImage(food,props['food-bowl.png']);setImage(water,props['water-bowl.png']);status.textContent='3';console.info('[Jinzhu home] props',props);}).catch(function(error){console.error('[Jinzhu home] bootstrap failed',error);});
}());
