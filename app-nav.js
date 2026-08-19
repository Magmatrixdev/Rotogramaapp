// ═══ NAVIGATION ENGINE ═══
let _navStack=[];
const NAV_DUR=260; // ms

function _blur(){if(document.activeElement?.blur)document.activeElement.blur();}

function _navPushOrig(id,setupFn){
  _blur();
  const prevId=_navStack.length>0?_navStack[_navStack.length-1]:null;
  _navStack.push(id);
  const newEl=document.getElementById(id);
  const prevEl=prevId?document.getElementById(prevId):null;
  if(newEl){newEl.scrollTop=0;}
  if(setupFn)setupFn();
  if(prevEl){
    prevEl.style.transition=`transform ${NAV_DUR}ms cubic-bezier(.4,0,.2,1)`;
    prevEl.classList.add('behind');
    prevEl.classList.remove('active');
    setTimeout(()=>{if(!prevEl.classList.contains('active'))prevEl.style.transition='';},NAV_DUR+20);
  }
  if(newEl){
    newEl.style.transition='none';
    newEl.style.transform='translateX(100%)';
    newEl.style.visibility='visible';
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      newEl.style.transition=`transform ${NAV_DUR}ms cubic-bezier(.4,0,.2,1)`;
      newEl.style.transform='translateX(0)';
      newEl.classList.add('active');
      setTimeout(()=>{newEl.style.transition='';newEl.style.transform='';},NAV_DUR+20);
    }));
  }
}

function _navPopOrig(setupFn){
  _blur();
  if(_navStack.length<=1)return;
  const oldId=_navStack.pop();
  const newId=_navStack[_navStack.length-1];
  const oldEl=document.getElementById(oldId);
  const newEl=document.getElementById(newId);
  if(setupFn)setupFn();
  if(oldEl){
    oldEl.style.transition=`transform ${NAV_DUR}ms cubic-bezier(.4,0,.2,1)`;
    oldEl.style.transform='translateX(100%)';
    oldEl.classList.remove('active');
    setTimeout(()=>{
      oldEl.style.transition='';oldEl.style.transform='';
      oldEl.style.visibility='hidden';oldEl.scrollTop=0;
    },NAV_DUR+20);
  }
  if(newEl){
    newEl.style.transition=`transform ${NAV_DUR}ms cubic-bezier(.4,0,.2,1)`;
    newEl.classList.add('active');
    newEl.classList.remove('behind');
    newEl.style.transform='translateX(0)';
    setTimeout(()=>{newEl.style.transition='';newEl.style.transform='';},NAV_DUR+20);
  }
}

function _navResetOrig(id,setupFn){
  _blur();
  document.querySelectorAll('.screen').forEach(s=>{
    s.classList.remove('active','behind');
    s.style.cssText='';
    s.style.visibility='hidden';
    s.scrollTop=0;
  });
  const dme=document.getElementById('driverMapEl');
  if(dme)dme.style.cssText='position:absolute;inset:0;z-index:1;background:#e8f0e8';
  _navStack=[id];
  const el=document.getElementById(id);
  if(el){
    el.scrollTop=0;
    el.style.visibility='visible';
    el.classList.add('active');
    el.style.transform='translateX(0)';
  }
  if(setupFn)setupFn();
}

// ─── Wrappers desktop-aware (únicos navPush/navPop/navReset do app) ───
function navPush(id,setupFn){
  if(IS_DESKTOP()){
    const prevId=_navStack.length>0?_navStack[_navStack.length-1]:null;
    _navStack.push(id);
    const newEl=document.getElementById(id);
    const prevEl=prevId?document.getElementById(prevId):null;
    if(newEl)newEl.scrollTop=0;
    if(setupFn)setupFn();
    if(prevEl&&prevId!=='screenHome'){
      prevEl.style.transition=`transform ${NAV_DUR}ms cubic-bezier(.4,0,.2,1)`;
      prevEl.classList.add('behind');prevEl.classList.remove('active');
      setTimeout(()=>{if(!prevEl.classList.contains('active'))prevEl.style.transition='';},NAV_DUR+20);
    }
    if(newEl){
      newEl.style.transition='none';
      newEl.style.transform='translateX(100%)';
      newEl.style.visibility='visible';
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        newEl.style.transition=`transform ${NAV_DUR}ms cubic-bezier(.4,0,.2,1)`;
        newEl.style.transform='translateX(0)';
        newEl.classList.add('active');
        setTimeout(()=>{newEl.style.transition='';newEl.style.transform='';},NAV_DUR+20);
      }));
    }
    dUpdateTopbar();
    return;
  }
  _navPushOrig(id,setupFn);
}

function navPop(setupFn){
  if(IS_DESKTOP()){
    if(_navStack.length<=1)return;
    const oldId=_navStack.pop();
    const newId=_navStack[_navStack.length-1];
    const oldEl=document.getElementById(oldId);
    const newEl=document.getElementById(newId);
    if(setupFn)setupFn();
    if(oldEl){
      oldEl.style.transition=`transform ${NAV_DUR}ms cubic-bezier(.4,0,.2,1)`;
      oldEl.style.transform='translateX(100%)';
      oldEl.classList.remove('active');
      setTimeout(()=>{oldEl.style.transition='';oldEl.style.transform='';oldEl.style.visibility='hidden';oldEl.scrollTop=0;},NAV_DUR+20);
    }
    if(newEl){
      if(newId==='screenHome'){
        newEl.style.visibility='visible';newEl.style.transform='none';
        newEl.classList.add('active');newEl.classList.remove('behind');
      }else{
        newEl.style.transition=`transform ${NAV_DUR}ms cubic-bezier(.4,0,.2,1)`;
        newEl.classList.add('active');newEl.classList.remove('behind');
        newEl.style.transform='translateX(0)';
        setTimeout(()=>{newEl.style.transition='';newEl.style.transform='';},NAV_DUR+20);
      }
    }
    dUpdateTopbar();
    return;
  }
  _navPopOrig(setupFn);
}

function navReset(id,setupFn){
  if(IS_DESKTOP()&&id==='screenHome'){
    _blur();
    const overlays=['screenAdmin','screenEditor','screenRoute','screenMapLive','screenDriverLogin','screenDriverReg'];
    overlays.forEach(sid=>{
      const el=document.getElementById(sid);
      if(el){el.style.cssText='';el.style.visibility='hidden';el.style.transform='translateX(100%)';el.classList.remove('active','behind');}
    });
    const dme=document.getElementById('driverMapEl');
    if(dme)dme.style.cssText='position:absolute;inset:0;z-index:1;background:#e8f0e8';
    _navStack=['screenHome'];
    const home=document.getElementById('screenHome');
    if(home){home.style.visibility='visible';home.style.transform='none';home.classList.add('active');home.classList.remove('behind');}
    if(setupFn)setupFn();
    return;
  }
  _navResetOrig(id,setupFn);
}

// Legacy aliases
function showScreen(id){navReset(id);}
function showDriverLogin(){navReset('screenDriverLogin');}

function showHome(){
  if(!currentDriver&&!adminMode){showDriverLogin();return;}
  isEditing=false;if(window._draftInterval)clearInterval(window._draftInterval);
  requestNotifPermission();
  if(localStorage.getItem('rotograma_desktop_on')==='1'&&!IS_DESKTOP()){
    document.body.classList.add('desktop-mode');
    var btn=document.getElementById('btnToggleDesktop');
    if(btn)btn.innerHTML='📱 Versão Mobile';
  }
  dUpdateTopbar();
  const homeIdx=_navStack.indexOf('screenHome');
  if(homeIdx>=0){
    const extra=_navStack.splice(homeIdx+1);
    extra.forEach(id=>{const el=document.getElementById(id);if(el){el.classList.remove('active','behind');el.style.cssText='';el.style.visibility='hidden';}});
    const homeEl=document.getElementById('screenHome');
    if(homeEl){homeEl.classList.add('active');homeEl.classList.remove('behind');homeEl.style.transform='translateX(0)';}
  }else{
    navReset('screenHome');
  }
  renderHome();
}

function showMapLive(){
  if(!currentTrip){showToast('Nenhuma viagem ativa — inicie uma viagem primeiro');return;}
  const route=currentRouteIdx>=0?routes[currentRouteIdx]:null;
  if(_navStack.includes('screenMapLive')){
    const mapEl=document.getElementById('screenMapLive');
    if(mapEl){mapEl.classList.add('active');mapEl.classList.remove('behind');}
    return;
  }
  navPush('screenMapLive',()=>{
    const nameEl=document.getElementById('mapLiveRouteName');
    const statesEl=document.getElementById('mapLiveStates');
    if(nameEl&&route)nameEl.textContent=route.nome;
    if(statesEl&&route)statesEl.textContent=route.estados||'';
    const ep=document.getElementById('tsPerc');if(ep)ep.textContent='—';
    const er=document.getElementById('tsRest');if(er)er.textContent=route?route.distancia||'—':'—';
    const et=document.getElementById('tsElapsed');if(et)et.textContent=route?route.tempo||'—':'—';
    updateNextStopUI();
    setTimeout(async()=>{
      try{ await loadMapboxGL(); }
      catch(e){
        const el=document.getElementById('driverMapEl');
        if(el)el.innerHTML='<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#fe2627;font-family:Barlow,sans-serif;font-size:13px;text-align:center;padding:20px"><span style="font-size:28px">❌</span><span>Falha ao carregar o mapa.<br>Verifique sua conexão com a internet.</span></div>';
        startTracking();if(!tripTimerInterval&&tripStartTs)startTripTimer();return;
      }
      await initDriverMap();
      setTimeout(()=>{if(_mbMap)_mbMap.resize();},350);
      startTracking();
      if(!tripTimerInterval&&tripStartTs)startTripTimer();
    },400);
  });
}

function showAdmin(){
  isEditing=false;if(window._draftInterval)clearInterval(window._draftInterval);
  renderAdmin();
  navPush('screenAdmin');
}

// ═══ DEEP LINK: #rota=ID ═══
function checkDeepLink(){return false;} // deep links desativados com nova navegação

function _handleDeepLink(){
  const hash=location.hash||'';
  if(!hash.startsWith('#rota='))return false;
  const rotaId=decodeURIComponent(hash.replace('#rota=',''));
  if(!rotaId)return false;
  const idx=routes.findIndex(r=>r.id===rotaId);
  if(idx<0){
    const idx2=routes.findIndex(r=>r.nome.toLowerCase().includes(rotaId.toLowerCase()));
    if(idx2<0){showToast('❌ Rota não encontrada: '+rotaId,'#fe2627');return false;}
    currentRouteIdx=idx2;
  }else{currentRouteIdx=idx;}
  const el=document.getElementById('routeContent');
  if(el)el.innerHTML=renderRoute(routes[currentRouteIdx]);
  navPush('screenRoute');
  history.replaceState(null,'',location.pathname);
  return true;
}

window.addEventListener('hashchange',()=>_handleDeepLink());
