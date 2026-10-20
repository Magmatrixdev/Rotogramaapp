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
    if(typeof updateBottomNav==='function')updateBottomNav('Rotas'); // FIX#2: restaura a barra inferior ao voltar pro mobile
  }else{
    // FIX#3: sem sessao nao da pra aplicar o desktop — nao grava preferencia nem troca rotulo (evita estado inconsistente)
    if(!currentDriver&&!adminMode){
      navReset('screenDriverLogin');
      return;
    }
    localStorage.setItem('rotograma_desktop_on','1');
    if(btn)btn.innerHTML='📱 Versão Mobile';
    document.body.classList.add('desktop-mode');
    _dActivateHomeLayout();
    dUpdateTopbar();dUpdateSidebar();
  }
}

function _dActivateHomeLayout(){
  const overlays=['screenAdmin','screenEditor','screenRoute','screenPostos','screenInformativos','screenDriverLogin','screenDriverReg'];
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
    syncEl.classList.remove('on','err');
    if(cls.includes('on')){syncEl.classList.add('on');syncEl.textContent='Sincronizado';if(dsbFoot){dsbFoot.textContent='Sincronizado';dsbFoot.className='dsb-footer';}}
    else if(cls.includes('err')){syncEl.classList.add('err');syncEl.textContent='Erro de conexão';if(dsbFoot){dsbFoot.textContent='Erro de conexão';dsbFoot.className='dsb-footer err';}}
    else{syncEl.textContent='Sincronizando...';if(dsbFoot){dsbFoot.textContent='Sincronizando...';dsbFoot.className='dsb-footer';}}
  }
  const driverEl=document.getElementById('dtbDriver');
  const logoutBtn=document.getElementById('dtbLogoutBtn');
  const adminBtn=document.getElementById('dtbAdminBtn');
  if(driverEl){
    if(currentDriver){
      const initials=currentDriver.nome.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      driverEl.innerHTML=`<div class="dtb-driver-avatar">${initials}</div><span>${currentDriver.nome.split(' ')[0]}</span>`;
      if(logoutBtn){logoutBtn.style.display='flex';logoutBtn.onclick=promptLogout;}
      if(adminBtn)adminBtn.style.display='flex';
    }else if(adminMode){
      driverEl.innerHTML='<div class="dtb-driver-avatar">AD</div><span>Admin</span>';
      if(logoutBtn){logoutBtn.style.display='flex';logoutBtn.onclick=promptLogoutAdmin;}
      if(adminBtn)adminBtn.style.display='none';
    }else{
      driverEl.innerHTML='';
      if(logoutBtn)logoutBtn.style.display='none';
      if(adminBtn)adminBtn.style.display='flex';
    }
  }
  document.body.classList.toggle('admin-only',!!adminMode&&!currentDriver);
  _dSyncNav();
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
  Object.entries(map).forEach(([reg,sfx])=>{const el=document.getElementById('dsbCount'+sfx);if(!el)return;const n=counts[reg]??0;el.textContent=n;const it=el.closest('.dsb-item');if(it)it.classList.toggle('zero',reg!=='all'&&n===0);});
}

/* ── Navegação da sidebar (Rotas / Postos / Informativos) ── */
function dNavGo(t){
  if(!IS_DESKTOP())return;
  const target={rotas:'screenHome',postos:'screenPostos',informativos:'screenInformativos'}[t];
  if(!target||_navStack[_navStack.length-1]===target){_dSyncNav();return;}
  while(_navStack.length>1)navPop();
  if(t==='postos')showPostos();
  else if(t==='informativos'&&typeof showInformativos==='function')showInformativos();
  _dSyncNav();
}
function _dSyncNav(){
  const top=_navStack[_navStack.length-1];
  const cur=top==='screenPostos'?'postos':top==='screenInformativos'?'informativos':top==='screenHome'?'rotas':'';
  document.querySelectorAll('#dSidebar .dsb-nav').forEach(b=>{
    const on=b.dataset.nav===cur;b.classList.toggle('active',on);
    if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
  });
}

/* ── Filtro da sidebar (região) ── */
function dSidebarFilter(el,region){
  dNavGo('rotas');
  document.querySelectorAll('#dSidebar .dsb-item[data-region]').forEach(i=>i.classList.remove('active'));
  if(el)el.classList.add('active');
  _dActiveRegion=region;
  filterRoutes();
}

/* ── Cabeçalho da coluna de rotas ── */
function dRenderListHead(){
  const el=document.getElementById('dListHead');if(!el||!IS_DESKTOP())return;
  const vis=[...document.querySelectorAll('#routeList .rcard')].filter(c=>c.style.display!=='none').length;
  const reg=(_dActiveRegion&&_dActiveRegion!=='all')?_dActiveRegion:'Todas as regiões';
  el.innerHTML=`<div class="dlh-txt"><div class="dlh-crumb">Rotas · ${esc(reg)} · ${vis} ${vis===1?'rota':'rotas'}</div><h1 class="dlh-title">Rotogramas</h1></div>`
    +(adminMode?`<button type="button" class="dlh-new" onclick="editRoute(-1)"><i class="ti ti-plus" aria-hidden="true"></i>Nova rota</button>`:'');
}

/* ── Painel detalhe (layout web modernizado — mockup aprovado 20/10/2026) ── */
function dRenderRouteDetail(r,i){
  const orig=r.paradas.find(p=>p.tipo==='origem'),dest=r.paradas.find(p=>p.tipo==='destino');
  const stops=r.paradas.filter(p=>p.tipo!=='origem'&&p.tipo!=='destino');
  const oc=(orig?orig.nome:'').split('—')[0].trim()||'—',dc=(dest?dest.nome:'').split('—')[0].trim()||'—';
  window._lastShareRaw=_routeShareRaw(r,stops);
  const wa='https://wa.me/?text='+encodeURIComponent(window._lastShareRaw);
  const nP=stops.length;
  const badges=_routeCards(r).map(c=>`<span class="hm-badge ${_HM_BADGE[c][0]}">${_HM_BADGE[c][1]}</span>`).join('');
  const meta=[r.estados,r.regiao].filter(Boolean).map(esc).join(' · ');
  const stat=(l,v)=>`<div class="dd-stat"><span class="dd-stat-l">${l}</span><span class="dd-stat-v">${v}</span></div>`;
  let h=`<div class="dd-wrap"><section class="dd-hero" aria-label="Resumo da rota">`
    +`<div class="dd-hero-top"><div class="dd-id"><div class="dd-num"><span>ROTA</span><b>${esc(String(r.numero||''))}</b></div>`
    +`<div class="dd-id-txt"><h2 class="dd-title">${esc(oc)} <span class="dd-arr">→</span> ${esc(dc)}</h2>${meta?`<div class="dd-sub">${meta}</div>`:''}</div></div>`
    +`<div class="dd-actions"><a class="dd-act dd-act-wa" href="${wa}" target="_blank" rel="noopener"><i class="ti ti-brand-whatsapp" aria-hidden="true"></i>WhatsApp</a>`
    +`<button type="button" class="dd-act" onclick="_copyRouteInfo(null)"><i class="ti ti-copy" aria-hidden="true"></i>Copiar</button>`
    +(adminMode?`<button type="button" class="dd-act" onclick="editRoute(${i})"><i class="ti ti-pencil" aria-hidden="true"></i>Editar rota</button>`:'')
    +`</div></div><div class="dd-stats">`
    +stat('Distância',esc(r.distancia||'—'))+stat('Tempo estimado',esc(r.tempo||'—'))+stat('Postos',nP+(nP===1?' posto':' postos'))
    +`<div class="dd-stat"><span class="dd-stat-l">Pagamento</span>${badges?`<span class="hm-badges">${badges}</span>`:'<span class="dd-stat-v">—</span>'}</div>`
    +`</div></section><div class="dd-grid">`
    +`<section class="dd-roteiro" aria-label="Roteiro"><div class="dd-sec-head"><h3>Roteiro</h3><span>${nP+2} paradas</span></div>${_routeTimeline(r)}</section>`
    +`<aside class="dd-side">`;
  if(r.linkRota)h+=`<div class="dd-panel dd-map"><span class="dd-map-ic"><i class="ti ti-map-2" aria-hidden="true"></i></span><div><div class="dd-panel-t">Rota completa</div><div class="dd-panel-s">Trajeto com todas as paradas no Google Maps</div></div><a class="dd-map-btn" href="${r.linkRota}" target="_blank" rel="noopener"><i class="ti ti-external-link" aria-hidden="true"></i>Abrir no Maps</a></div>`;
  if(r.observacao)h+=`<div class="dd-alert"><i class="ti ti-alert-triangle" aria-hidden="true"></i><div><strong>Aviso desta rota:</strong> ${r.observacao}</div></div>`;
  if(r.retorno)h+=`<div class="dd-alert dd-ret"><i class="ti ti-refresh" aria-hidden="true"></i><div>${r.retorno}</div></div>`;
  h+=`<section class="hm-support" aria-label="Suporte de abastecimento"><div><div class="hm-sup-tit">PRECISA DE AJUDA?</div><div class="hm-sup-sub">Suporte de abastecimento no WhatsApp</div></div><div class="hm-sup-btns"><a class="hm-sup-btn primary" href="https://wa.me/5562998780792" target="_blank" rel="noopener">${_HM_SVG.chat}<span><span class="hm-sup-name">Pedro</span><span class="hm-sup-when">Seg a Sex</span></span></a><a class="hm-sup-btn" href="https://wa.me/556299220160" target="_blank" rel="noopener">${_HM_SVG.chat}<span><span class="hm-sup-name">Ismael</span><span class="hm-sup-when">Sáb e Dom</span></span></a></div></section>`;
  return h+`</aside></div></div>`;
}

function dShowRouteDetail(i){
  const r=routes[i];if(!r)return;
  const same=currentRouteIdx===i;currentRouteIdx=i;
  const pane=document.getElementById('ddpContent');
  const empty=document.getElementById('ddpEmpty');
  const content=document.getElementById('ddpRouteContent');
  if(!pane||!content)return;
  const st=same?content.scrollTop:0;
  content.innerHTML=dRenderRouteDetail(r,i);
  content.scrollTop=st;
  if(empty)empty.style.display='none';
  pane.style.display='flex';
  document.querySelectorAll('#routeList .rcard').forEach(c=>c.classList.toggle('d-selected',+c.dataset.routeIdx===i));
}

/* Após cada renderHome no desktop: mantém a rota aberta (re-render com dados novos) ou abre a primeira visível */
function dRestoreSelection(){
  if(!IS_DESKTOP())return;
  const pane=document.getElementById('ddpContent');
  if(currentRouteIdx>=0&&routes[currentRouteIdx]&&pane&&pane.style.display!=='none'){dShowRouteDetail(currentRouteIdx);return;}
  const first=[...document.querySelectorAll('#routeList .rcard')].find(c=>c.style.display!=='none');
  if(first)dShowRouteDetail(+first.dataset.routeIdx);
}

/* ── Restaura preferência desktop ao carregar ── */
var _desktopRestored=false;
(function _desktopInit(){
  var btn=document.getElementById('btnToggleDesktop');
  var desktopSalvo=localStorage.getItem('rotograma_desktop_on')==='1';
  if(btn)btn.innerHTML=desktopSalvo?'📱 Versão Mobile':'🖥️ Versão Web';
  // NÃO adiciona desktop-mode aqui — sem _dActivateHomeLayout() o layout quebra
  // A restauração completa ocorre em _restoreDesktopIfNeeded() após auth + rotas carregarem
})();

// Chamada após rotas carregarem do Firebase — ativa o layout desktop completo
function _restoreDesktopIfNeeded(){
  if(_desktopRestored)return;       // já restaurou, ignora chamadas subsequentes
  if(localStorage.getItem('rotograma_desktop_on')!=='1')return; // desktop mode não está salvo
  if(adminMode)return;              // admin tem seu próprio fluxo de restauração
  if(!currentDriver)return;         // motorista não autenticado ainda
  if(window.innerWidth<1024)return; // FIX#1: nao restaura desktop em tela estreita (evita layout preso); o resize reaplica ao alargar
  _desktopRestored=true;
  document.body.classList.add('desktop-mode');
  var btn=document.getElementById('btnToggleDesktop');
  if(btn)btn.innerHTML='📱 Versão Mobile';
  _dActivateHomeLayout();
  dUpdateTopbar();
  dUpdateSidebar();
}


/* ── FIX#1: reconcilia desktop-mode com a largura da tela ──
   Abaixo de 1024px cai pro mobile (preservando a preferencia salva) para nao
   prender o usuario num layout desktop sem o botao de toggle; ao voltar a
   >=1024px, reaplica o desktop se a preferencia estiver ligada e houver sessao. */
function _reconcileDesktopWidth(){
  var wide=window.innerWidth>=1024;
  var on=IS_DESKTOP();
  var btn=document.getElementById('btnToggleDesktop');
  if(on&&!wide){
    document.body.classList.remove('desktop-mode');
    if(btn)btn.innerHTML='🖥️ Versão Web';
    navReset('screenHome',function(){renderHome();});
    if(typeof updateBottomNav==='function')updateBottomNav('Rotas');
  }else if(!on&&wide&&localStorage.getItem('rotograma_desktop_on')==='1'&&(currentDriver||adminMode)){
    document.body.classList.add('desktop-mode');
    if(btn)btn.innerHTML='📱 Versão Mobile';
    _dActivateHomeLayout();
    dUpdateTopbar();dUpdateSidebar();
  }
}
var _desktopResizeTimer=null;
window.addEventListener('resize',function(){
  clearTimeout(_desktopResizeTimer);
  _desktopResizeTimer=setTimeout(_reconcileDesktopWidth,180);
});
