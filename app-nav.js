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
    newEl.style.opacity='';newEl.style.zIndex='';newEl.style.pointerEvents=''; // limpa resto do fade de volta à Home
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
  if(id==='screenAdmin'){try{localStorage.setItem('last_screen','screenAdmin');}catch(e){}}
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
      newEl.style.opacity='';newEl.style.zIndex='';newEl.style.pointerEvents=''; // limpa resto do fade de volta à Home
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
    const overlays=['screenAdmin','screenEditor','screenRoute','screenPostos','screenInformativos','screenDriverLogin','screenDriverReg'];
    overlays.forEach(sid=>{
      const el=document.getElementById(sid);
      if(el){el.style.cssText='';el.style.visibility='hidden';el.style.transform='translateX(100%)';el.classList.remove('active','behind');}
    });
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

// Volta para a Home (aba Rotas) com o mesmo slide do "voltar": a tela de cima
// (Postos, Informativos...) desliza para a direita e a Home volta de -22% para o lugar.
// Telas intermediárias da pilha são escondidas na hora (ficam por baixo).
function _homeTransitionBack(homeEl,extra){
  // _homeInstant: troca Postos↔Informativos passa pela Home sem animar (evita telas se cruzando)
  const reduce=window._homeInstant||(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const topId=extra.length?extra[extra.length-1]:null;
  const topEl=topId?document.getElementById(topId):null;
  const ease='cubic-bezier(.4,0,.2,1)';
  extra.forEach(id=>{
    if(id===topId&&!reduce)return;
    const el=document.getElementById(id);
    if(el){el.classList.remove('active','behind');el.style.cssText='';el.style.visibility='hidden';}
  });
  if(topEl&&!reduce){
    // mesmo slide do "voltar" (navPop): a tela de cima sai deslizando para a direita
    topEl.classList.remove('active','behind');
    topEl.style.zIndex='20';
    topEl.style.visibility='visible';
    topEl.style.pointerEvents='none';
    topEl.style.transition='none';
    topEl.style.transform='translateX(0)';
    void topEl.offsetWidth; // fixa o ponto de partida antes de animar
    topEl.style.transition=`transform ${NAV_DUR}ms ${ease}`;
    topEl.style.transform='translateX(100%)';
    setTimeout(()=>{
      if(topEl.classList.contains('active'))return; // usuário já voltou para essa aba
      topEl.style.cssText='';topEl.style.visibility='hidden';topEl.scrollTop=0;
    },NAV_DUR+40);
  }
  if(homeEl){
    if(!reduce&&!IS_DESKTOP()&&homeEl.classList.contains('behind')){
      homeEl.style.transition=`transform ${NAV_DUR}ms ${ease}`;
      setTimeout(()=>{if(homeEl.classList.contains('active'))homeEl.style.transition='';},NAV_DUR+40);
    }
    homeEl.style.visibility='visible';
    homeEl.classList.add('active');homeEl.classList.remove('behind');
    homeEl.style.transform=IS_DESKTOP()?'none':'translateX(0)';
  }
}

function showHome(){
  if(!currentDriver&&!adminMode){showDriverLogin();return;}
  try{localStorage.setItem('last_screen','screenHome');}catch(e){}
  isEditing=false;if(window._draftInterval)clearInterval(window._draftInterval);
  requestNotifPermission();
  if(localStorage.getItem('rotograma_desktop_on')==='1'&&!IS_DESKTOP()&&window.innerWidth>=1024){
    document.body.classList.add('desktop-mode');
    var btn=document.getElementById('btnToggleDesktop');
    if(btn)btn.innerHTML='📱 Versão Mobile';
  }
  dUpdateTopbar();
  const homeIdx=_navStack.indexOf('screenHome');
  if(homeIdx>=0){
    const extra=_navStack.splice(homeIdx+1);
    const homeEl=document.getElementById('screenHome');
    _homeTransitionBack(homeEl,extra);
  }else{
    navReset('screenHome');
  }
  renderHome();
  if(typeof updateBottomNav==='function')updateBottomNav('Rotas');
}

// ═══ ROTA (tela mobile) ═══
function showRoute(i){
  if(IS_DESKTOP()&&(_navStack.length<=1||_navStack[_navStack.length-1]==='screenHome')){
    dShowRouteDetail(i);return;
  }
  const r=routes[i];currentRouteIdx=i;
  _navPushOrig('screenRoute',()=>{
    document.getElementById('routeContent').innerHTML=renderRoute(r);
  });
}

function showAdmin(){
  isEditing=false;if(window._draftInterval)clearInterval(window._draftInterval);
  try{localStorage.setItem('last_screen','screenAdmin');}catch(e){}
  renderAdmin();
  navPush('screenAdmin');
}

// ═══ DEEP LINK: #rota=ID ═══
function checkDeepLink(){return false;} // deep links desativados com nova navegação

function _handleDeepLink(){
  const hash=location.hash||'';
  if(hash==='#informativos'){
    history.replaceState(null,'',location.pathname);
    if(typeof _openInformativos==='function')_openInformativos();
    return true;
  }
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

