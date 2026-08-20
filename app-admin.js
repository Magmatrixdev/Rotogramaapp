// ═══ RENDER ADMIN — ROTAS ═══
let _adminRouteFilter='';

function renderAdmin(){
  const el=document.getElementById('adminList');if(!el)return;
  let h=`<div class="admin-search"><span class="admin-search-icon">🔍</span><input id="adminRouteSearch" type="text" placeholder="Pesquisar rota..." value="${esc(_adminRouteFilter)}" oninput="_adminRouteFilter=this.value;renderAdminRoutes()"><button class="admin-search-clear ${_adminRouteFilter?'visible':''}" onclick="_adminRouteFilter='';document.getElementById('adminRouteSearch').value='';renderAdminRoutes()">✕</button></div>`;
  h+=`<button class="admin-add" onclick="editRoute(-1)">＋ NOVA ROTA</button>`;
  h+=`<div id="adminRouteCards"></div>`;
  el.innerHTML=h;
  renderAdminRoutes();
}

function renderAdminRoutes(){
  const container=document.getElementById('adminRouteCards');if(!container)return;
  const q=_adminRouteFilter.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const clearBtn=document.querySelector('.admin-search-clear');
  if(clearBtn)clearBtn.className='admin-search-clear'+(q?' visible':'');
  let h='';let count=0;
  routes.forEach((r,i)=>{
    const searchText=(r.nome+' '+r.numero+' '+(r.regiao||'')+' '+(r.estados||'')+' '+(r.distancia||'')).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    if(q&&!searchText.includes(q))return;
    count++;const stops=r.paradas.filter(p=>p.tipo!=='origem'&&p.tipo!=='destino').length;
    h+=`<div class="admin-rcard"><div class="admin-rcard-head"><div class="admin-rcard-num">${r.numero}</div><div class="admin-rcard-info"><div class="admin-rcard-name">${r.nome}</div><div class="admin-rcard-sub">${r.regiao} · ${stops} postos · ${r.distancia}</div></div></div><div class="admin-rcard-actions"><button class="admin-btn admin-btn-edit" onclick="editRoute(${i})">✏️ Editar</button><button class="admin-btn admin-btn-del" onclick="deleteRoute(${i})">🗑️ Excluir</button></div></div>`});
  if(q&&count===0)h=`<div class="admin-no-results"><span>🔍</span>Nenhuma rota encontrada para "<strong>${esc(_adminRouteFilter)}</strong>"</div>`;
  container.innerHTML=h;
}

function deleteRoute(i){const r=routes[i];const ov=document.createElement('div');ov.className='confirm-overlay';ov.innerHTML=`<div class="confirm-box"><h3>Excluir rota?</h3><p>${r.nome}</p><div class="btns"><button style="background:#eae8e3;color:#1c1c1c" onclick="this.closest('.confirm-overlay').remove()">Cancelar</button><button style="background:#fe2627;color:#fff" onclick="confirmDeleteRoute(${i});this.closest('.confirm-overlay').remove()">Excluir</button></div></div>`;document.body.appendChild(ov)}

function confirmDeleteRoute(i){routes.splice(i,1);saveToFirebase();renderAdmin()}

// ═══ RENDER DRIVER MANAGER ═══
function showAddDriverModal(){
  document.querySelector('.driver-modal-overlay')?.remove();
  const ov=document.createElement('div');ov.className='driver-modal-overlay confirm-overlay';
  ov.innerHTML=`<div class="confirm-box" style="max-width:380px;text-align:left">
    <h3 style="margin-bottom:16px">Cadastrar Motorista</h3>
    <div class="login-field"><label>Nome completo</label><input type="text" id="adNome" placeholder="João da Silva" style="width:100%;padding:12px;border:1.5px solid #e4e2dd;border-radius:10px;font-family:'Barlow',sans-serif;font-size:14px;outline:none"></div>
    <div class="login-field" style="margin-top:10px"><label>CPF</label><input type="text" id="adCPF" placeholder="000.000.000-00" maxlength="14" oninput="fmtCPF(this)" style="width:100%;padding:12px;border:1.5px solid #e4e2dd;border-radius:10px;font-family:'Barlow',sans-serif;font-size:14px;outline:none"></div>
    <div class="login-field" style="margin-top:10px"><label>PIN inicial (4 dígitos)</label><input type="password" id="adPIN" placeholder="••••" maxlength="4" inputmode="numeric" style="width:100%;padding:12px;border:1.5px solid #e4e2dd;border-radius:10px;font-family:'Barlow',sans-serif;font-size:14px;outline:none"></div>
    <div class="login-error" id="adError" style="display:none;margin-top:8px">Preencha todos os campos</div>
    <div class="btns" style="margin-top:16px">
      <button style="background:#eae8e3;color:#1c1c1c;flex:1;padding:12px;border-radius:10px;border:none;font-weight:700;cursor:pointer" onclick="this.closest('.driver-modal-overlay').remove()">Cancelar</button>
      <button id="adSaveBtn" style="background:#fe2627;color:#fff;flex:1;padding:12px;border-radius:10px;border:none;font-weight:700;cursor:pointer" onclick="doAddDriverAdmin()">Cadastrar</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  setTimeout(()=>document.getElementById('adNome')?.focus(),100);
}

async function doAddDriverAdmin(){
  const nome=(document.getElementById('adNome')?.value||'').trim();
  const cpfRaw=cleanCPF(document.getElementById('adCPF')?.value||'');
  const pin=(document.getElementById('adPIN')?.value||'').trim();
  const errEl=document.getElementById('adError');
  const btn=document.getElementById('adSaveBtn');
  function showErr(msg){errEl.textContent=msg;errEl.style.display='block';setTimeout(()=>errEl.style.display='none',4000);}
  if(!nome){showErr('Informe o nome completo');return;}
  if(cpfRaw.length!==11){showErr('CPF inválido');return;}
  if(pin.length!==4||!/^\d{4}$/.test(pin)){showErr('PIN deve ter 4 dígitos numéricos');return;}
  if(btn){btn.disabled=true;btn.textContent='Salvando...';}
  try{
    const hashFn=(!window.crypto||!window.crypto.subtle)?sha256Fallback:sha256;
    const cpfHash=await hashFn(cpfRaw);
    const dup=Object.values(drivers).find(d=>d.cpfHash===cpfHash);
    if(dup){showErr('CPF já cadastrado');return;}
    const pinHash=await hashFn(pin);
    let cpfEnc=btoa(cpfRaw);
    if(window.crypto&&window.crypto.subtle)cpfEnc=await encryptCPF(cpfRaw);
    const id='drv_'+Date.now();
    const driver={id,nome,cpfHash,cpfEnc,pinHash,bloqueado:false,criadoEm:Date.now(),ultimoAcesso:0,cadastradoPorAdmin:true};
    drivers[id]=driver;
    if(db)await db.ref('motoristas/'+id).set(driver);
    document.querySelector('.driver-modal-overlay')?.remove();
    renderDriverManager();
  }catch(err){showErr('Erro: '+(err.message||'tente novamente'));}
  finally{if(btn){btn.disabled=false;btn.textContent='Cadastrar';}}
}

async function renderDriverManager(){
  const el=document.getElementById('adminDriversList');if(!el)return;
  const driverList=Object.values(drivers);
  if(driverList.length===0){el.innerHTML=`<div style="padding:0 0 16px"><button class="admin-add" onclick="showAddDriverModal()">＋ CADASTRAR MOTORISTA</button></div><div style="text-align:center;padding:30px 20px;color:#9a9894;font-family:'Barlow',sans-serif"><span style="font-size:40px">👤</span><p style="margin-top:8px">Nenhum motorista cadastrado ainda</p></div>`;return;}
  let h='<button class="admin-add" onclick="showAddDriverModal()">＋ CADASTRAR MOTORISTA</button>';
  for(const d of driverList.sort((a,b)=>a.nome.localeCompare(b.nome))){
    const initials=d.nome.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase();
    const isOnTrip=Object.values(viagens).some(v=>v.motoristaId===d.id&&v.status==='em_viagem');
    const lastAccess=d.ultimoAcesso?new Date(d.ultimoAcesso).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'Nunca';
    let statusClass='status-active',statusTxt='Ativo';
    if(d.bloqueado){statusClass='status-blocked';statusTxt='Bloqueado';}
    else if(isOnTrip){statusClass='status-traveling';statusTxt='🚛 Em viagem';}
    let cpfMask='***.***.***-**';
    try{const cpf=await decryptCPF(d.cpfEnc);if(cpf&&cpf.length===11)cpfMask=cpf.slice(0,3)+'.'+cpf.slice(3,6)+'.'+cpf.slice(6,9)+'-'+cpf.slice(9);}catch(e){}
    h+=`<div class="driver-card ${d.bloqueado?'blocked':''}">
      <div class="driver-card-head">
        <div class="driver-card-avatar">${initials}</div>
        <div class="driver-card-info">
          <div class="driver-card-name">${d.nome}</div>
          <div class="driver-card-cpf">CPF: ${cpfMask}</div>
        </div>
        <span class="driver-card-status ${statusClass}">${statusTxt}</span>
      </div>
      <div class="driver-card-meta">Último acesso: ${lastAccess}</div>
      <div class="driver-card-actions">
        <button class="driver-btn ${d.bloqueado?'driver-btn-unblock':'driver-btn-block'}" onclick="toggleBlockDriver('${d.id}',${d.bloqueado})">${d.bloqueado?'🔓 Desbloquear':'🔒 Bloquear'}</button>
        <button class="driver-btn driver-btn-del" onclick="deleteDriver('${d.id}')">🗑️ Excluir</button>
      </div>
    </div>`;
  }
  el.innerHTML=h;
}

async function toggleBlockDriver(id,blocked){
  if(db)await db.ref('motoristas/'+id+'/bloqueado').set(!blocked);
}

async function deleteDriver(id){
  const ov=document.createElement('div');ov.className='confirm-overlay';
  ov.innerHTML=`<div class="confirm-box"><h3>Excluir motorista?</h3><p>Esta ação não pode ser desfeita.</p><div class="btns"><button style="background:#eae8e3;color:#1c1c1c" onclick="this.closest('.confirm-overlay').remove()">Cancelar</button><button style="background:#fe2627;color:#fff" onclick="confirmDeleteDriver('${id}');this.closest('.confirm-overlay').remove()">Excluir</button></div></div>`;
  document.body.appendChild(ov);
}

async function confirmDeleteDriver(id){if(db)await db.ref('motoristas/'+id).remove();}

// ═══ RENDER MONITORING ═══
function renderMonitoring(){
  const activeTrips=Object.values(viagens).filter(v=>v.status==='em_viagem');
  const totalDrivers=Object.values(drivers).length;
  const onlineNow=Object.values(posicoes).filter(p=>(Date.now()-p.timestamp)<5*60*1000).length;
  const statsEl=document.getElementById('monitorStats');
  if(statsEl)statsEl.innerHTML=`
    <div class="monitor-stat"><div class="monitor-stat-val green">${activeTrips.length}</div><div class="monitor-stat-lbl">Em viagem</div></div>
    <div class="monitor-stat"><div class="monitor-stat-val blue">${onlineNow}</div><div class="monitor-stat-lbl">Online agora</div></div>
    <div class="monitor-stat"><div class="monitor-stat-val">${totalDrivers}</div><div class="monitor-stat-lbl">Motoristas</div></div>`;
  const cardsEl=document.getElementById('monitorCardsView');
  if(!cardsEl)return;
  if(activeTrips.length===0){cardsEl.innerHTML=`<div class="monitor-no-trips"><span style="font-size:36px">🛑</span><p style="margin-top:8px;font-weight:700">Nenhuma viagem ativa</p></div>`;return;}
  let h='';
  activeTrips.forEach(v=>{
    const pos=posicoes[v.motoristaId];
    const lastSeen=pos?new Date(pos.timestamp).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'—';
    const online=pos&&(Date.now()-pos.timestamp)<5*60*1000;
    const elapsed=Math.floor((Date.now()-v.iniciadaEm)/1000/60);
    const hh=Math.floor(elapsed/60),mm=elapsed%60;
    const timeStr=hh>0?hh+'h'+String(mm).padStart(2,'0')+'m':mm+'min';
    const confirmed=(v.postosConfirmados||[]).length;
    const route=routes.find(r=>r.id===v.rotaId);
    const totalStops=route?route.paradas.filter(p=>p.tipo!=='origem'&&p.tipo!=='destino').length:0;
    h+=`<div class="monitor-driver-card">
      <div class="monitor-driver-dot ${online?'':'offline'}"></div>
      <div class="monitor-driver-info">
        <div class="monitor-driver-name">${v.motoristaNome}</div>
        <div class="monitor-driver-route">${v.rotaNome}</div>
        <div class="monitor-driver-time">⏱ ${timeStr} em viagem · ⛽ ${confirmed}/${totalStops} postos · 📡 ${online?'Online':'Último: '+lastSeen}</div>
      </div>
    </div>`;
  });
  cardsEl.innerHTML=h;
}

function switchMonitorView(view,el){
  document.querySelectorAll('.monitor-toggle-btn').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  const cardsView=document.getElementById('monitorCardsView');
  const mapView=document.getElementById('monitorMapView');
  if(view==='cards'){cardsView.style.display='';mapView.classList.remove('active');}
  else{cardsView.style.display='none';mapView.classList.add('active');setTimeout(()=>{initMonitorMap();if(monitorMap)monitorMap.invalidateSize();},100);}
}

// ═══ RENDER BI ═══
function renderBI(){
  const el=document.getElementById('biContent');if(!el)return;
  const allDrivers=Object.values(drivers);
  const allTrips=Object.values(viagens);
  const activeTrips=allTrips.filter(v=>v.status==='em_viagem');
  const completedTrips=allTrips.filter(v=>v.status==='finalizada');
  const blockedDrivers=allDrivers.filter(d=>d.bloqueado);
  const now=Date.now();
  const recentActive=allDrivers.filter(d=>d.ultimoAcesso&&(now-d.ultimoAcesso)<24*60*60*1000);
  const incompleteTrips=completedTrips.filter(v=>{
    const route=routes.find(r=>r.id===v.rotaId);if(!route)return false;
    const stops=route.paradas.filter(p=>p.tipo!=='origem'&&p.tipo!=='destino').length;
    return stops>(v.postosConfirmados?.length||0);
  });
  let h=`<div class="bi-grid">
    <div class="bi-card"><div class="bi-val">${allDrivers.length}</div><div class="bi-lbl">Motoristas cadastrados</div></div>
    <div class="bi-card"><div class="bi-val green">${activeTrips.length}</div><div class="bi-lbl">Em viagem agora</div></div>
    <div class="bi-card"><div class="bi-val blue">${allTrips.length}</div><div class="bi-lbl">Total de viagens</div></div>
    <div class="bi-card"><div class="bi-val red">${blockedDrivers.length}</div><div class="bi-lbl">Bloqueados</div></div>
  </div>
  <div class="bi-section">
    <div class="bi-section-title"><span class="bar"></span>Atividade recente (24h)</div>`;
  if(recentActive.length===0){h+=`<div class="bi-empty">Nenhum acesso nas últimas 24h</div>`;}
  else{recentActive.forEach(d=>{const isOnTrip=activeTrips.some(v=>v.motoristaId===d.id);h+=`<div class="bi-row"><div class="bi-row-name">${d.nome} ${isOnTrip?'🚛':''}</div><div class="bi-row-detail">Último acesso: ${new Date(d.ultimoAcesso).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</div></div>`;});}
  h+=`</div><div class="bi-section">
    <div class="bi-section-title"><span class="bar"></span>Postos não confirmados</div>`;
  if(incompleteTrips.length===0){h+=`<div class="bi-empty">✅ Todos os postos foram confirmados nas viagens concluídas</div>`;}
  else{incompleteTrips.slice(0,10).forEach(v=>{const route=routes.find(r=>r.id===v.rotaId);const total=route?route.paradas.filter(p=>p.tipo!=='origem'&&p.tipo!=='destino').length:0;const confirmed=(v.postosConfirmados?.length||0);h+=`<div class="bi-row"><div class="bi-row-name">${v.motoristaNome}</div><div class="bi-row-detail">${v.rotaNome} · ${confirmed}/${total} postos confirmados · ${new Date(v.iniciadaEm).toLocaleDateString('pt-BR')}</div></div>`;});}
  h+=`</div><div class="bi-section" style="padding-bottom:24px">
    <div class="bi-section-title"><span class="bar"></span>Viagens concluídas</div>`;
  if(completedTrips.length===0){h+=`<div class="bi-empty">Nenhuma viagem concluída ainda</div>`;}
  else{completedTrips.slice(-5).reverse().forEach(v=>{const dur=v.finalizadaEm?Math.floor((v.finalizadaEm-v.iniciadaEm)/1000/60):null;const durStr=dur?Math.floor(dur/60)+'h'+String(dur%60).padStart(2,'0')+'m':'—';h+=`<div class="bi-row"><div class="bi-row-name">${v.motoristaNome}</div><div class="bi-row-detail">${v.rotaNome} · ${durStr} · ${new Date(v.iniciadaEm).toLocaleDateString('pt-BR')}</div></div>`;});}
  h+=`</div>`;
  el.innerHTML=h;
}

// ═══ ADMIN TAB SWITCH ═══
function switchAdminTab(tab,el){
  document.querySelectorAll('.admin-tab-btn').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('.admin-tab-pane').forEach(p=>p.classList.remove('active'));
  const paneMap={routes:'adminTabRoutes',drivers:'adminTabDrivers',monitor:'adminTabMonitor',bi:'adminTabBI',postos:'adminTabPostos'};
  const pane=document.getElementById(paneMap[tab]);if(pane)pane.classList.add('active');
  if(tab==='routes')renderAdmin();
  else if(tab==='drivers')renderDriverManager();
  else if(tab==='monitor'){renderMonitoring();}
  else if(tab==='bi')renderBI();
  else if(tab==='postos'){if(!_postosListenerInit){initPostosListener();_postosListenerInit=true;}renderAdminPostos();}
}

// ═══ ADMIN POSTOS ═══
let _adminPostoFilter='';

function _adminPostoCard(p,actionsHtml,mapsHtml){
  const cls=getCartaoClass(p.cartao);const lbl=getCartaoLabel(p.cartao);
  return `<div class="admin-rcard">
    <div class="admin-rcard-head">
      <div class="admin-rcard-num" style="background:#2d5a27;font-size:14px">⛽</div>
      <div class="admin-rcard-info">
        <div class="admin-rcard-name">${esc(p.nome||'—')}</div>
        <div class="admin-rcard-sub">${esc(p.cidade||'')} · <span class="postos-tag ${cls}" style="font-size:11px;padding:2px 6px;border-radius:4px;display:inline-block">${lbl}</span></div>
        ${p._routeName?`<div class="admin-rcard-sub" style="font-size:11px;color:#9a9894;margin-top:1px">Rota ${esc(p._routeNum)} · ${esc(p._routeName)}</div>`:''}
      </div>
      <div style="margin-left:auto;padding-right:4px">${mapsHtml}</div>
    </div>
    <div class="admin-rcard-actions">${actionsHtml}</div>
  </div>`;
}

function renderAdminPostos(){
  const el=document.getElementById('adminPostosList');if(!el)return;
  let h=`<div class="admin-search"><span class="admin-search-icon">🔍</span><input id="adminPostoSearch" type="text" placeholder="Pesquisar posto..." value="${esc(_adminPostoFilter)}" oninput="_adminPostoFilter=this.value;renderAdminPostoCards()"><button class="admin-search-clear ${_adminPostoFilter?'visible':''}" onclick="_adminPostoFilter='';document.getElementById('adminPostoSearch').value='';renderAdminPostoCards()">✕</button></div>`;
  h+=`<button class="admin-add" onclick="showAddPostoForm()">＋ NOVO POSTO AVULSO</button>`;
  h+=`<div id="adminPostoCards"></div>`;
  el.innerHTML=h;
  renderAdminPostoCards();
}

function renderAdminPostoCards(){
  const container=document.getElementById('adminPostoCards');if(!container)return;
  // --- Filtro ---
  const q=_adminPostoFilter.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const clearBtn=document.querySelector('#adminPostoSearch')?.parentElement?.querySelector('.admin-search-clear');
  if(clearBtn)clearBtn.className='admin-search-clear'+(q?' visible':'');
  // --- Postos em rotas ---
  const routeStops=[];
  routes.forEach((r,ri)=>{
    (r.paradas||[]).forEach((p,pi)=>{
      if(p.tipo==='origem'||p.tipo==='destino')return;
      routeStops.push({...p,_routeIdx:ri,_paraIdx:pi,_routeName:r.nome,_routeNum:r.numero});
    });
  });
  const filteredRoute=q?routeStops.filter(p=>{
    const t=((p.nome||'')+' '+(p.cidade||'')+' '+(p._routeName||'')+' '+(p._routeNum||'')).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    return t.includes(q);
  }):routeStops;
  // --- Postos avulsos ---
  const avulsoList=Object.values(postosAvulsos||{}).sort((a,b)=>(a.nome||'').localeCompare(b.nome||''));
  const filteredAvulso=q?avulsoList.filter(p=>{
    const t=((p.nome||'')+' '+(p.cidade||'')).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    return t.includes(q);
  }):avulsoList;

  let h='';
  // Seção rotas
  h+=`<div style="font-family:'Barlow',sans-serif;font-weight:700;font-size:13px;color:#5a5854;text-transform:uppercase;letter-spacing:.5px;padding:16px 0 8px">⛽ Postos em Rotas <span style="font-weight:400;color:#9a9894">(${filteredRoute.length})</span></div>`;
  if(filteredRoute.length===0){
    h+=`<div style="text-align:center;padding:24px 20px;color:#9a9894;font-family:'Barlow',sans-serif;font-size:13px">${q?'Nenhum posto encontrado':'Nenhum posto cadastrado em rotas'}</div>`;
  }else{
    filteredRoute.forEach(p=>{
      const maps=p.link?`<a href="${p.link}" target="_blank" style="color:#1a6fb5;font-size:12px;text-decoration:none">🗺️ Maps</a>`:'';
      const acts=`<button class="admin-btn admin-btn-edit" onclick="showEditPostoRota(${p._routeIdx},${p._paraIdx})">✏️ Editar</button>`;
      h+=_adminPostoCard(p,acts,maps);
    });
  }
  // Seção avulsos
  h+=`<div style="font-family:'Barlow',sans-serif;font-weight:700;font-size:13px;color:#5a5854;text-transform:uppercase;letter-spacing:.5px;padding:20px 0 8px">📋 Postos Avulsos <span style="font-weight:400;color:#9a9894">(${filteredAvulso.length})</span></div>`;
  if(filteredAvulso.length===0){
    h+=`<div style="text-align:center;padding:24px 20px;color:#9a9894;font-family:'Barlow',sans-serif;font-size:13px">${q?'Nenhum posto encontrado':'Nenhum posto avulso cadastrado'}</div>`;
  }else{
    filteredAvulso.forEach(p=>{
      const maps=p.link?`<a href="${p.link}" target="_blank" style="color:#1a6fb5;font-size:12px;text-decoration:none">🗺️ Maps</a>`:'';
      const acts=`<button class="admin-btn admin-btn-edit" onclick="showEditPostoAvulso('${p.id}')">✏️ Editar</button><button class="admin-btn admin-btn-del" onclick="deletePostoAvulso('${p.id}')">🗑️ Excluir</button>`;
      h+=_adminPostoCard(p,acts,maps);
    });
  }
  container.innerHTML=h;
}

function _postoRotaFormHTML(p,ri,pi,title,saveFn){
  return `<div class="postos-form-box">
    <div class="postos-form-title">${title}</div>
    <div class="postos-form-field"><label>Nome do posto</label><input id="prNome" value="${esc(p.nome||'')}"></div>
    <div class="postos-form-field"><label>Cidade — UF</label><input id="prCidade" value="${esc(p.cidade||'')}"></div>
    <div class="postos-form-field"><label>Tipo de pagamento</label>
      <select id="prCartao">
        <option value="truckpag"${p.cartao==='truckpag'?' selected':''}>TruckPag</option>
        <option value="shell"${p.cartao==='shell'?' selected':''}>Shell</option>
        <option value="shell_expers"${p.cartao==='shell_expers'?' selected':''}>Shell Expers</option>
        <option value="redefrota"${p.cartao==='redefrota'?' selected':''}>Rede Frota</option>
        <option value="compra_antecipada"${p.cartao==='compra_antecipada'?' selected':''}>Compra Antecipada</option>
      </select>
    </div>
    <div class="postos-form-field"><label>Link Google Maps</label><input id="prLink" value="${esc(p.link||'')}"></div>
    <div class="postos-form-err" id="prError" style="display:none"></div>
    <div class="postos-form-btns">
      <button class="postos-form-cancel" onclick="this.closest('.postos-form-ov').remove()">Cancelar</button>
      <button class="postos-form-save" onclick="${saveFn}">Salvar</button>
    </div>
  </div>`;
}

function showEditPostoRota(ri,pi){
  const r=routes[ri];if(!r)return;
  const p=r.paradas[pi];if(!p)return;
  document.querySelector('.postos-form-ov')?.remove();
  const ov=document.createElement('div');ov.className='postos-form-ov';
  ov.innerHTML=_postoRotaFormHTML(p,ri,pi,`Editar posto · Rota ${esc(r.numero)}`,'saveEditPostoRota('+ri+','+pi+')');
  document.body.appendChild(ov);
  setTimeout(()=>document.getElementById('prNome')?.focus(),100);
}

async function saveEditPostoRota(ri,pi){
  const nome=(document.getElementById('prNome')?.value||'').trim();
  const cidade=(document.getElementById('prCidade')?.value||'').trim();
  const cartao=document.getElementById('prCartao')?.value||'truckpag';
  const link=(document.getElementById('prLink')?.value||'').trim();
  const errEl=document.getElementById('prError');
  if(!nome||!cidade){errEl.textContent='Nome e cidade são obrigatórios';errEl.style.display='block';return;}
  const r=routes[ri];if(!r)return;
  r.paradas[pi]={...r.paradas[pi],nome,cidade,cartao,link};
  try{
    await saveToFirebase();
    document.querySelector('.postos-form-ov')?.remove();
    renderAdminPostos();
  }catch(e){errEl.textContent='Erro ao salvar.';errEl.style.display='block';}
}

function showEditPostoAvulso(id){
  const p=postosAvulsos[id];if(!p)return;
  document.querySelector('.postos-form-ov')?.remove();
  const ov=document.createElement('div');ov.className='postos-form-ov';
  ov.innerHTML=`<div class="postos-form-box">
    <div class="postos-form-title">Editar posto</div>
    <div class="postos-form-field"><label>Nome</label><input id="pfNome" value="${esc(p.nome||'')}"></div>
    <div class="postos-form-field"><label>Cidade</label><input id="pfCidade" value="${esc(p.cidade||'')}"></div>
    <div class="postos-form-field"><label>Cartão</label>
      <select id="pfCartao">
        <option value="truckpag"${p.cartao==='truckpag'?' selected':''}>TruckPag</option>
        <option value="shell"${p.cartao==='shell'?' selected':''}>Shell</option>
        <option value="frota"${p.cartao==='frota'?' selected':''}>Rede Frota</option>
        <option value="antecipada"${p.cartao==='antecipada'?' selected':''}>Antecipada</option>
      </select>
    </div>
    <div class="postos-form-field"><label>Link Google Maps</label><input id="pfLink" value="${esc(p.link||'')}"></div>
    <div class="postos-form-err" id="pfError" style="display:none"></div>
    <div class="postos-form-btns">
      <button class="postos-form-cancel" onclick="this.closest('.postos-form-ov').remove()">Cancelar</button>
      <button class="postos-form-save" onclick="saveEditPostoAvulso('${id}')">Salvar</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  setTimeout(()=>document.getElementById('pfNome')?.focus(),100);
}

async function saveEditPostoAvulso(id){
  const nome=(document.getElementById('pfNome')?.value||'').trim();
  const cidade=(document.getElementById('pfCidade')?.value||'').trim();
  const cartao=document.getElementById('pfCartao')?.value||'truckpag';
  const link=(document.getElementById('pfLink')?.value||'').trim();
  const errEl=document.getElementById('pfError');
  if(!nome||!cidade){errEl.textContent='Nome e cidade são obrigatórios';errEl.style.display='block';return;}
  const posto={...postosAvulsos[id],nome,cidade,cartao,link};
  try{
    if(db)await db.ref('postos/'+id).set(posto);
    else postosAvulsos[id]={...posto,_source:'avulso'};
    document.querySelector('.postos-form-ov')?.remove();
    renderAdminPostos();
  }catch(e){errEl.textContent='Erro ao salvar.';errEl.style.display='block';}
}

