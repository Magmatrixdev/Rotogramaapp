// ═══ DESKTOP INTERFACE ═══
// IS_DESKTOP já definido em app-config.js
let _dActiveRegion='all';

/* ── Toggle entre versão mobile e desktop ── */
function toggleDesktopMode(){
  const isOn=IS_DESKTOP();
  const btn=document.getElementById('btnToggleDesktop');
  if(isOn){
    document.body.classList.remove('desktop-mode');
    localStorage.setItem('rotograma_desktop_on','0');
    if(btn)btn.innerHTML='🖥️ Versão Web';
    navReset('screenHome',()=>renderHome());
  }else{
    localStorage.setItem('rotograma_desktop_on','1');
    if(btn)btn.innerHTML='📱 Versão Mobile';
    if(!currentDriver&&!adminMode){
      navReset('screenDriverLogin');
      return;
    }
    document.body.classList.add('desktop-mode');
    _dActivateHomeLayout();
    dUpdateTopbar();dUpdateSidebar();
  }
}

function _dActivateHomeLayout(){
  const overlays=['screenAdmin','screenEditor','screenRoute','screenMapLive','screenDriverLogin','screenDriverReg'];
  overlays.forEach(id=>{
    const el=document.getElementById(id);
    if(el){el.style.visibility='hidden';el.style.transform='translateX(100%)';el.classList.remove('active','behind');}
  });
  const home=document.getElementById('screenHome');
  if(home){home.style.visibility='visible';home.style.transform='none';home.classList.add('active');home.classList.remove('behind');}
  _navStack=['screenHome'];
  renderHome();
}

/* ── Topbar desktop ── */
function dUpdateTopbar(){
  if(!IS_DESKTOP())return;
  const syncBar=document.getElementById('syncBar');
  const syncEl=document.getElementById('dtbSync');
  const dsbFoot=document.getElementById('dsbFooter');
  if(syncEl&&syncBar){
    const cls=syncBar.className;
    if(cls.includes('on')){syncEl.textContent='Sincronizado';if(dsbFoot){dsbFoot.textContent='Sincronizado';dsbFoot.className='dsb-footer';}}
    else if(cls.includes('err')){syncEl.textContent='Erro de conexão';if(dsbFoot){dsbFoot.textContent='Erro de conexão';dsbFoot.className='dsb-footer err';}}
    else{syncEl.textContent='Sincronizando...';if(dsbFoot){dsbFoot.textContent='Sincronizando...';dsbFoot.className='dsb-footer';}}
  }
  const driverEl=document.getElementById('dtbDriver');
  const logoutBtn=document.getElementById('dtbLogoutBtn');
  const adminBtn=document.getElementById('dtbAdminBtn');
  if(driverEl){
    if(currentDriver){
      const initials=currentDriver.nome.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      driverEl.innerHTML=`<div class="dtb-driver-avatar">${initials}</div><span>${currentDriver.nome.split(' ')[0]}</span>`;
      if(logoutBtn)logoutBtn.style.display='flex';
      if(adminBtn)adminBtn.style.display='flex';
    }else if(adminMode){
      driverEl.innerHTML='<span style="color:rgba(255,255,255,.6);font-size:12px">Admin</span>';
      if(logoutBtn)logoutBtn.style.display='flex';
      if(adminBtn)adminBtn.style.display='none';
    }else{
      driverEl.innerHTML='';
      if(logoutBtn)logoutBtn.style.display='none';
      if(adminBtn)adminBtn.style.display='flex';
    }
  }
  const sub=document.getElementById('dtbSubtitle');
  if(sub){
    if(adminMode)sub.textContent='Painel Administrativo';
    else if(currentDriver)sub.textContent='Olá, '+currentDriver.nome.split(' ')[0]+'!';
    else sub.textContent='Confiança Transportes';
  }
}

/* ── Sidebar contagens ── */
function dUpdateSidebar(){
  if(!IS_DESKTOP())return;
  const counts={all:0};
  routes.forEach(r=>{const reg=r.regiao||'Outras';counts.all++;counts[reg]=(counts[reg]||0)+1;});
  const map={'all':'All','Centro-Oeste':'CO','Nordeste':'NE','Sudeste':'SE','Sul':'SU','Norte':'NO','Centro-Norte':'CN'};
  Object.entries(map).forEach(([reg,sfx])=>{const el=document.getElementById('dsbCount'+sfx);if(el)el.textContent=counts[reg]??0;});
}

/* ── Filtro da sidebar ── */
function dSidebarFilter(el,region){
  document.querySelectorAll('.dsb-item').forEach(i=>i.classList.remove('active'));
  el.classList.add('active');_dActiveRegion=region;
  document.querySelectorAll('#routeList .rcard').forEach(c=>{
    c.style.display=(region==='all'||c.dataset.region===region)?'':'none';
  });
  document.querySelectorAll('#routeList .region').forEach(r=>{
    r.style.display=[...r.querySelectorAll('.rcard')].some(c=>c.style.display!=='none')?'':'none';
  });
}

/* ── Painel detalhe (two-panel home) ── */
function dShowRouteDetail(i){
  const r=routes[i];currentRouteIdx=i;
  const pane=document.getElementById('ddpContent');
  const empty=document.getElementById('ddpEmpty');
  const content=document.getElementById('ddpRouteContent');
  if(!pane||!content)return;
  content.innerHTML=renderRoute(r);
  if(empty)empty.style.display='none';
  pane.style.display='flex';
  const tripBar=document.getElementById('ddpTripBar');
  const tripBtn=document.getElementById('ddpStartTrip');
  if(tripBar&&tripBtn&&currentDriver){
    tripBar.classList.add('show');
    if(currentTrip&&currentTrip.rotaId===r.id){tripBtn.textContent='🗺️ Ver Mapa ao Vivo';tripBtn.style.background='#1a6fb5';tripBtn.onclick=showMapLive;tripBtn.disabled=false;}
    else if(currentTrip){tripBtn.textContent='🚛 Em outra viagem';tripBtn.style.background='#9a9894';tripBtn.disabled=true;}
    else{tripBtn.textContent='🚛 Iniciar Viagem';tripBtn.style.background='#1a7a3c';tripBtn.onclick=startTrip;tripBtn.disabled=false;}
  }else if(tripBar){tripBar.classList.remove('show');}
  document.querySelectorAll('#routeList .rcard').forEach((c,idx)=>c.classList.toggle('d-selected',idx===i));
}

/* ── Restaura preferência desktop ao carregar ── */
(function _desktopInit(){
  var btn=document.getElementById('btnToggleDesktop');
  var desktopSalvo=localStorage.getItem('rotograma_desktop_on')==='1';
  if(btn)btn.innerHTML=desktopSalvo?'📱 Versão Mobile':'🖥️ Versão Web';
})();
