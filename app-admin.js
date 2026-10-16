// ═══ RENDER ADMIN — ROTAS ═══
let _adminRouteFilter='';
let _adminRegionFilter='all';
const _AR_REGIONS=['Centro-Oeste','Nordeste','Sudeste','Sul','Norte','Centro-Norte'];
const _AR_REG_CLS={'Centro-Oeste':'co','Nordeste':'ne','Sudeste':'se','Sul':'su','Norte':'no','Centro-Norte':'cn'};

function _arStops(r){return (r.paradas||[]).filter(p=>p.tipo!=='origem'&&p.tipo!=='destino').length}
function _arKm(r){const n=parseInt(String(r.distancia||'').replace(/[^\d]/g,''),10);return isNaN(n)?0:n}
function _arKmLabel(r){const km=_arKm(r);if(!km)return esc(String(r.distancia||'—'));return (String(r.distancia).includes('~')?'~':'')+km.toLocaleString('pt-BR')+' km'}
function _arSplitName(nome){
  const parts=String(nome||'').split(/\s*(?:→|->|⟶)\s*/);
  if(parts.length<2)return null;
  const p=s=>{const m=s.trim().match(/^(.*?)\s*[-–—]\s*([A-Za-z]{2})$/);return m?{c:m[1].trim(),uf:m[2].toUpperCase()}:{c:s.trim(),uf:''}};
  return {o:p(parts[0]),d:p(parts.slice(1).join(' → '))};
}
function _arNorm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')}

function renderAdmin(){
  const el=document.getElementById('adminList');if(!el)return;
  let h=`<div class="ar-head"><div><div class="ar-crumb">Administração / Rotas</div><h2 class="ar-title">Rotas cadastradas</h2></div><div class="ar-head-actions"><button class="ar-btn ar-btn-ghost" onclick="exportRoutesCSV()"><i class="ti ti-download" aria-hidden="true"></i> Exportar</button><button class="ar-btn ar-btn-primary" onclick="editRoute(-1)"><i class="ti ti-plus" aria-hidden="true"></i> Nova rota</button></div></div>`;
  h+=`<div class="ar-kpis" id="adminRoutesStats"></div>`;
  h+=`<div class="ar-panel"><div class="ar-panel-top"><div class="admin-search ar-search"><i class="ti ti-search admin-search-icon" aria-hidden="true"></i><input id="adminRouteSearch" type="text" aria-label="Pesquisar rota" placeholder="Buscar por cidade, UF ou número da rota…" value="${esc(_adminRouteFilter)}" oninput="_adminRouteFilter=this.value;renderAdminRoutes()"><button class="admin-search-clear ${_adminRouteFilter?'visible':''}" aria-label="Limpar busca" onclick="_adminRouteFilter='';document.getElementById('adminRouteSearch').value='';renderAdminRoutes()">✕</button></div><div class="ar-chips" id="adminRegionChips" role="group" aria-label="Filtrar por região"></div></div><div class="ar-thead" aria-hidden="true"><span>Nº</span><span>Rota</span><span>Região</span><span>Postos</span><span>Distância</span><span>Ações</span></div><div id="adminRouteCards"></div><div class="ar-foot" id="adminRouteFoot"></div></div>`;
  el.innerHTML=h;
  renderAdminRoutes();
  renderAdminRoutesStats();
}

function renderAdminRoutesStats(){
  const el=document.getElementById('adminRoutesStats');
  const total=routes.length;
  const tabCt=document.getElementById('adminTabRoutesCount');if(tabCt)tabCt.textContent=total||'';
  if(!el)return;
  const stops=routes.reduce((s,r)=>s+_arStops(r),0);
  const avg=total?(stops/total).toFixed(1).replace('.',','):'0';
  const kms=routes.map(_arKm).filter(k=>k>0);
  const avgKm=kms.length?Math.round(kms.reduce((a,b)=>a+b,0)/kms.length).toLocaleString('pt-BR'):'—';
  const semPosto=routes.filter(r=>_arStops(r)===0).length;
  const byReg={};routes.forEach(r=>{const k=r.regiao||'Sem região';byReg[k]=(byReg[k]||0)+1});
  const top=Object.entries(byReg).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([k,v])=>`${v} no ${k}`).join(' · ');
  el.innerHTML=`<div class="ar-kpi"><div class="ar-kpi-lbl">Rotas cadastradas</div><div class="ar-kpi-val">${total}</div><div class="ar-kpi-sub">${esc(top||'Nenhuma rota ainda')}</div></div>`
   +`<div class="ar-kpi"><div class="ar-kpi-lbl">Paradas no total</div><div class="ar-kpi-val">${stops}</div><div class="ar-kpi-sub">Média de ${avg} por rota</div></div>`
   +`<div class="ar-kpi"><div class="ar-kpi-lbl">Distância média</div><div class="ar-kpi-val">${avgKm}<small>km</small></div><div class="ar-kpi-sub">${kms.length} rota${kms.length===1?'':'s'} com distância informada</div></div>`
   +`<div class="ar-kpi ar-kpi-alert${semPosto?'':' ok'}"><div class="ar-kpi-lbl"><i class="ti ${semPosto?'ti-alert-triangle':'ti-circle-check'}" aria-hidden="true"></i> Rotas sem posto</div><div class="ar-kpi-val">${semPosto}</div><div class="ar-kpi-sub">${semPosto?'Precisam de parada definida':'Todas as rotas têm parada'}</div></div>`;
}

function renderAdminRoutes(){
  const container=document.getElementById('adminRouteCards');if(!container)return;
  const q=_arNorm(_adminRouteFilter);
  const clearBtn=document.querySelector('.admin-search-clear');
  if(clearBtn)clearBtn.className='admin-search-clear'+(q?' visible':'');
  const counts={};routes.forEach(r=>{const k=r.regiao||'';if(k)counts[k]=(counts[k]||0)+1});
  const regs=_AR_REGIONS.slice();Object.keys(counts).forEach(k=>{if(!regs.includes(k))regs.push(k)});
  if(_adminRegionFilter!=='all'&&!regs.includes(_adminRegionFilter))_adminRegionFilter='all';
  const chipsEl=document.getElementById('adminRegionChips');
  if(chipsEl)chipsEl.innerHTML=[['all','Todas',routes.length]].concat(regs.map(k=>[k,k,counts[k]||0])).map(([k,l,c])=>{const on=_adminRegionFilter===k;return `<button class="ar-chip${on?' on':''}" aria-pressed="${on}" data-r="${esc(k)}" onclick="_adminSetRegion(this.dataset.r)">${esc(l)}<span class="ar-chip-ct">${c}</span></button>`}).join('');
  const maxKm=Math.max(1,...routes.map(_arKm));
  let h='';let count=0;
  routes.forEach((r,i)=>{
    if(_adminRegionFilter!=='all'&&(r.regiao||'')!==_adminRegionFilter)return;
    const searchText=_arNorm(r.nome+' '+r.numero+' '+(r.regiao||'')+' '+(r.estados||'')+' '+(r.distancia||''));
    if(q&&!searchText.includes(q))return;
    count++;
    const stops=_arStops(r),km=_arKm(r),sp=_arSplitName(r.nome),num=esc(String(r.numero??''));
    const city=x=>`<span>${esc(x.c)}</span>${x.uf?`<span class="ar-uf">${esc(x.uf)}</span>`:''}`;
    const nameHtml=sp?`${city(sp.o)}<i class="ti ti-arrow-right ar-arrow" aria-hidden="true"></i>${city(sp.d)}`:`<span>${esc(String(r.nome||''))}</span>`;
    const regCls=_AR_REG_CLS[r.regiao]||'xx';
    const stopsTxt=stops===0?'sem paradas':stops+(stops===1?' parada':' paradas');
    h+=`<div class="ar-row"><span class="ar-num">${num}</span>`
      +`<div class="ar-route"><div class="ar-route-name">${nameHtml}</div><div class="ar-route-sub">${esc(r.regiao||'Sem região')} · ${stopsTxt} · ${_arKmLabel(r)}</div></div>`
      +`<span class="ar-col-reg"><span class="ar-badge ar-reg-${regCls}">${esc(r.regiao||'—')}</span></span>`
      +`<span class="ar-col-postos">${stops===0?'<span class="ar-warn">Sem posto</span>':stops+(stops===1?' posto':' postos')}</span>`
      +`<div class="ar-col-km"><span>${_arKmLabel(r)}</span><div class="ar-bar"><div style="width:${km?Math.round(km/maxKm*100):0}%"></div></div></div>`
      +`<div class="ar-actions"><button class="ar-icon" title="Editar" aria-label="Editar rota ${num}" onclick="editRoute(${i})"><i class="ti ti-edit" aria-hidden="true"></i></button><button class="ar-icon ar-icon-del" title="Excluir" aria-label="Excluir rota ${num}" onclick="deleteRoute(${i})"><i class="ti ti-trash" aria-hidden="true"></i></button></div></div>`;
  });
  if(count===0)h=`<div class="admin-no-results"><i class="ti ti-search" aria-hidden="true"></i>${routes.length?'Nenhuma rota encontrada para esse filtro.':'Nenhuma rota cadastrada ainda.'}</div>`;
  container.innerHTML=h;
  const foot=document.getElementById('adminRouteFoot');if(foot)foot.textContent=`Mostrando ${count} de ${routes.length} rota${routes.length===1?'':'s'}`;
}

function _adminSetRegion(k){_adminRegionFilter=k||'all';renderAdminRoutes()}

function exportRoutesCSV(){
  const cell=v=>{let s=String(v??'');if(/^[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};
  const rows=[['Numero','Rota','Regiao','Postos','Distancia (km)','Distancia (texto)']];
  routes.forEach(r=>rows.push([r.numero,r.nome,r.regiao||'',_arStops(r),_arKm(r)||'',r.distancia||'']));
  const csv='﻿'+rows.map(x=>x.map(cell).join(';')).join('\r\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.download='rotas-'+new Date().toISOString().slice(0,10)+'.csv';document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);
}

function deleteRoute(i){const r=routes[i];const ov=document.createElement('div');ov.className='confirm-overlay';ov.innerHTML=`<div class="confirm-box"><h3>Excluir rota?</h3><p>${r.nome}</p><div class="btns"><button style="background:#eae8e3;color:#1c1c1c" onclick="this.closest('.confirm-overlay').remove()">Cancelar</button><button style="background:#fe2627;color:#fff" onclick="confirmDeleteRoute(${i});this.closest('.confirm-overlay').remove()">Excluir</button></div></div>`;document.body.appendChild(ov)}

function confirmDeleteRoute(i){routes.splice(i,1);saveToFirebase();renderAdmin()}

// ═══ RENDER DRIVER MANAGER ═══
let _driverFilter='';

let _rateLimitsByHmac={};
const _RL_MAX=5, _RL_WINDOW=15*60*1000, _RL_WARN=3;
async function _loadDriverRateLimits(){
  try{
    if(!db){_rateLimitsByHmac={};return;}
    const snap=await db.ref('rateLimits').once('value');
    _rateLimitsByHmac=snap.val()||{};
  }catch(e){
    _rateLimitsByHmac={};
    console.warn('[rateLimits] leitura indisponivel:',(e&&e.code)||e);
  }
}
function _driverLockState(d){
  const e=d&&d.cpfHmac?_rateLimitsByHmac[d.cpfHmac]:null;
  if(!e||typeof e.attempts!=='number')return{locked:false,warning:false,attemptsUsed:0,waitMin:0};
  const elapsed=Date.now()-(e.windowStart||0);
  if(elapsed>_RL_WINDOW)return{locked:false,warning:false,attemptsUsed:0,waitMin:0};
  const waitMin=Math.max(1,Math.ceil((_RL_WINDOW-elapsed)/60000));
  if(e.attempts>=_RL_MAX)return{locked:true,warning:false,attemptsUsed:e.attempts,waitMin};
  if(e.attempts>=_RL_WARN)return{locked:false,warning:true,attemptsUsed:e.attempts,waitMin};
  return{locked:false,warning:false,attemptsUsed:e.attempts,waitMin};
}

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
  if(!validateCPF(cpfRaw)){showErr('CPF inválido — verifique os dígitos');return;}
  if(pin.length!==4||!/^\d{4}$/.test(pin)){showErr('PIN deve ter 4 dígitos numéricos');return;}
  if(btn){btn.disabled=true;btn.textContent='Salvando...';}
  // ── USE_NEW_AUTH: cadastro via Cloud Function ─────────────────────────
  if(USE_NEW_AUTH){
    try{
      const fn=firebase.functions().httpsCallable('registerDriver');
      await fn({nome,cpf:cpfRaw,pin});
      document.querySelector('.driver-modal-overlay')?.remove();
      showToast('✅ Motorista cadastrado com sucesso');
      renderDriverManager();
    }catch(err){
      const code=err.code||'';
      if(code==='functions/already-exists'){showErr('CPF já cadastrado');}
      else{showErr('Erro: '+(err.message||'tente novamente'));}
    }finally{if(btn){btn.disabled=false;btn.textContent='Cadastrar';}}
    return;
  }
  // ── Fluxo legado ─────────────────────────────────────────────────────
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

function showEditDriverModal(id){
  const d=drivers[id];if(!d)return;
  document.querySelector('.driver-modal-overlay')?.remove();
  const ov=document.createElement('div');ov.className='driver-modal-overlay confirm-overlay';
  ov.innerHTML=`<div class="confirm-box" style="max-width:380px;text-align:left">
    <h3 style="margin-bottom:4px">Editar Motorista</h3>
    <p style="font-size:13px;color:#9a9894;margin-bottom:16px;font-family:'Barlow',sans-serif">CPF não pode ser alterado</p>
    <div class="login-field"><label>Nome completo</label><input type="text" id="edNome" value="${esc(d.nome)}" style="width:100%;padding:12px;border:1.5px solid #e4e2dd;border-radius:10px;font-family:'Barlow',sans-serif;font-size:14px;outline:none"></div>
    <div class="login-field" style="margin-top:10px"><label>Novo PIN (deixe vazio para não alterar)</label><input type="password" id="edPIN" placeholder="••••" maxlength="4" inputmode="numeric" style="width:100%;padding:12px;border:1.5px solid #e4e2dd;border-radius:10px;font-family:'Barlow',sans-serif;font-size:14px;outline:none"></div>
    <div style="border-top:1px solid #efeee9;margin:14px 0 12px"></div>
    <button type="button" style="width:100%;background:#fff;color:#c2410c;border:1.5px solid #f0997b;border-radius:10px;padding:11px;font-weight:700;font-family:'Barlow',sans-serif;font-size:14px;cursor:pointer" onclick="doResetDriverPIN('${id}')">🔑 Resetar senha para 0000</button>
    <p style="font-size:11.5px;color:#9a9894;margin:7px 2px 0;line-height:1.5;font-family:'Barlow',sans-serif">No próximo acesso o motorista entra com <b style="color:#6b6a66">0000</b> e é obrigado a criar uma nova senha.</p>
    <div class="login-error" id="edError" style="display:none;margin-top:8px"></div>
    <div class="btns" style="margin-top:16px">
      <button style="background:#eae8e3;color:#1c1c1c;flex:1;padding:12px;border-radius:10px;border:none;font-weight:700;cursor:pointer" onclick="this.closest('.driver-modal-overlay').remove()">Cancelar</button>
      <button id="edSaveBtn" style="background:#1c1c1c;color:#fff;flex:1;padding:12px;border-radius:10px;border:none;font-weight:700;cursor:pointer" onclick="doEditDriver('${id}')">Salvar</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  setTimeout(()=>document.getElementById('edNome')?.focus(),100);
}

async function doEditDriver(id){
  const d=drivers[id];if(!d)return;
  const nome=(document.getElementById('edNome')?.value||'').trim();
  const pin=(document.getElementById('edPIN')?.value||'').trim();
  const errEl=document.getElementById('edError');
  const btn=document.getElementById('edSaveBtn');
  function showErr(msg){errEl.textContent=msg;errEl.style.display='block';setTimeout(()=>errEl.style.display='none',4000);}
  if(!nome){showErr('Informe o nome completo');return;}
  if(pin&&(pin.length!==4||!/^\d{4}$/.test(pin))){showErr('PIN deve ter 4 dígitos numéricos');return;}
  if(btn){btn.disabled=true;btn.textContent='Salvando...';}
  try{
    // Nome: escrita direta (as rules permitem para admin)
    if(nome!==d.nome){
      if(db){await db.ref('motoristas/'+id).update({nome});}
      else{drivers[id]={...d,nome};}
    }
    // PIN: redefinicao via Cloud Function (hash scrypt server-side; escrita direta
    // do pinHash e barrada pelas rules do novo auth -> PERMISSION_DENIED)
    if(pin){
      if(USE_NEW_AUTH){
        const fn=firebase.functions().httpsCallable('adminSetDriverPIN');
        await fn({uid:id,pinNovo:pin});
      }else{
        const hashFn=(!window.crypto||!window.crypto.subtle)?sha256Fallback:sha256;
        if(db)await db.ref('motoristas/'+id).update({pinHash:await hashFn(pin)});
      }
    }
    if(drivers[id])drivers[id]={...drivers[id],nome};
    document.querySelector('.driver-modal-overlay')?.remove();
    if(typeof showToast==='function')showToast('✅ Motorista atualizado');
    if(typeof renderDriverCards==='function')renderDriverCards();
  }catch(err){
    const code=(err&&err.code)||'';
    let msg='Erro: '+(err.message||'tente novamente');
    if(code==='functions/permission-denied')msg='Você precisa estar logado como administrador.';
    else if(code==='functions/not-found')msg='Função não implantada. Rode o deploy das Cloud Functions.';
    else if(code==='functions/unauthenticated')msg='Sessão expirada. Entre novamente como admin.';
    else if(code==='functions/invalid-argument')msg='PIN inválido (use 4 dígitos).';
    showErr(msg);
  }
  finally{if(btn){btn.disabled=false;btn.textContent='Salvar';}}
}

async function doResetDriverPIN(id){
  const d=drivers[id];if(!d)return;
  document.querySelector('.reset-pin-overlay')?.remove();
  const ov=document.createElement('div');ov.className='reset-pin-overlay confirm-overlay';
  ov.innerHTML=`<div class="confirm-box" style="max-width:360px;text-align:left">
    <h3 style="margin-bottom:8px">Resetar senha?</h3>
    <p style="font-size:13px;color:#9a9894;margin-bottom:6px;font-family:'Barlow',sans-serif">A senha de <b style="color:#1c1c1c">${esc(d.nome)}</b> será redefinida para <b style="color:#1c1c1c">0000</b>.</p>
    <p style="font-size:13px;color:#9a9894;margin-bottom:16px;font-family:'Barlow',sans-serif">No próximo acesso o motorista será obrigado a criar uma nova senha.</p>
    <div class="login-error" id="rpError" style="display:none;margin-bottom:8px"></div>
    <div class="btns">
      <button style="background:#eae8e3;color:#1c1c1c;flex:1;padding:12px;border-radius:10px;border:none;font-weight:700;cursor:pointer;font-family:'Barlow',sans-serif" onclick="this.closest('.reset-pin-overlay').remove()">Cancelar</button>
      <button id="rpConfirmBtn" style="background:#fe2627;color:#fff;flex:1;padding:12px;border-radius:10px;border:none;font-weight:700;cursor:pointer;font-family:'Barlow',sans-serif" onclick="doResetDriverPINConfirm('${id}')">Resetar</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
}

async function doResetDriverPINConfirm(id){
  const d=drivers[id];if(!d)return;
  const errEl=document.getElementById('rpError');
  const btn=document.getElementById('rpConfirmBtn');
  function showErr(msg){if(errEl){errEl.textContent=msg;errEl.style.display='block';}}
  if(btn){btn.disabled=true;btn.textContent='Resetando...';}
  try{
    if(USE_NEW_AUTH){
      const fn=firebase.functions().httpsCallable('adminSetDriverPIN');
      await fn({uid:id,pinNovo:'0000',exigirTroca:true});
    }else{
      const hashFn=(!window.crypto||!window.crypto.subtle)?sha256Fallback:sha256;
      if(db)await db.ref('motoristas/'+id).update({pinHash:await hashFn('0000'),pinResetRequired:true});
    }
    document.querySelector('.reset-pin-overlay')?.remove();
    document.querySelector('.driver-modal-overlay')?.remove();
    if(typeof showToast==='function')showToast('✅ Senha resetada para 0000 — o motorista criará uma nova no próximo acesso');
    if(typeof renderDriverCards==='function')renderDriverCards();
  }catch(err){
    const code=(err&&err.code)||'';
    let msg='Erro: '+(err.message||'tente novamente');
    if(code==='functions/permission-denied')msg='Você precisa estar logado como administrador.';
    else if(code==='functions/not-found')msg='Função não implantada. Rode o deploy das Cloud Functions.';
    else if(code==='functions/unauthenticated')msg='Sessão expirada. Entre novamente como admin.';
    else if(code==='functions/invalid-argument')msg='Dados inválidos.';
    showErr(msg);
    if(btn){btn.disabled=false;btn.textContent='Resetar';}
  }
}

async function renderDriverManager(){
  const el=document.getElementById('adminDriversList');if(!el)return;
  let h=`<div class="admin-stats-bar" id="adminDriversStats"></div>`;
  h+=`<div class="admin-toolbar-row"><div class="admin-search"><span class="admin-search-icon">🔍</span><input id="driverSearch" type="text" placeholder="Pesquisar motorista..." value="${esc(_driverFilter)}" oninput="_driverFilter=this.value;renderDriverCards()"><button class="admin-search-clear ${_driverFilter?'visible':''}" onclick="_driverFilter='';document.getElementById('driverSearch').value='';renderDriverCards()">✕</button></div><button class="admin-add" onclick="showAddDriverModal()">＋ CADASTRAR MOTORISTA</button></div>`;
  h+=`<div id="driverCardsContainer"></div>`;
  el.innerHTML=h;
  await _loadDriverRateLimits();
  await renderDriverCards();
  renderDriverStats();
}

function renderDriverStats(){
  const el=document.getElementById('adminDriversStats');if(!el)return;
  const list=Object.values(drivers);
  const total=list.length;
  const blocked=list.filter(d=>d.bloqueado).length;
  const traveling=list.filter(d=>!d.bloqueado&&Object.values(viagens).some(v=>v.motoristaId===d.id&&v.status==='em_viagem')).length;
  const active=total-blocked-traveling;
  el.innerHTML=`<div class="admin-stat-card"><div class="admin-stat-val">${total}</div><div class="admin-stat-lbl">Motoristas</div></div><div class="admin-stat-card"><div class="admin-stat-val" style="color:#1f8a3d">${active}</div><div class="admin-stat-lbl">Ativos</div></div><div class="admin-stat-card"><div class="admin-stat-val" style="color:#1a6fb5">${traveling}</div><div class="admin-stat-lbl">Em viagem</div></div><div class="admin-stat-card"><div class="admin-stat-val" style="color:#fe2627">${blocked}</div><div class="admin-stat-lbl">Bloqueados</div></div>`;
}

async function renderDriverCards(){
  const container=document.getElementById('driverCardsContainer');if(!container)return;
  const norm=s=>(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const q=norm(_driverFilter);
  const clearBtn=document.getElementById('driverSearch')?.parentElement?.querySelector('.admin-search-clear');
  if(clearBtn)clearBtn.className='admin-search-clear'+(q?' visible':'');
  const driverList=Object.values(drivers).sort((a,b)=>a.nome.localeCompare(b.nome,'pt'));
  const filtered=q?driverList.filter(d=>norm(d.nome).includes(q)):driverList;
  if(filtered.length===0){
    container.innerHTML=`<div style="text-align:center;padding:30px 20px;color:#9a9894;font-family:'Barlow',sans-serif"><span style="font-size:40px">${q?'🔍':'👤'}</span><p style="margin-top:8px">${q?'Nenhum motorista encontrado para "'+esc(_driverFilter)+'"':'Nenhum motorista cadastrado ainda'}</p></div>`;
    return;
  }
  let h='';
  for(const d of filtered){
    const initials=d.nome.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase();
    const isOnTrip=Object.values(viagens).some(v=>v.motoristaId===d.id&&v.status==='em_viagem');
    const lastAccess=d.ultimoAcesso?new Date(d.ultimoAcesso).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'Nunca';
    const lock=_driverLockState(d);
    let statusClass='status-active',statusTxt='Ativo';
    if(d.bloqueado){statusClass='status-blocked';statusTxt='Bloqueado';}
    else if(lock.locked){statusClass='status-lockedrate';statusTxt='🔒 Login travado';}
    else if(isOnTrip){statusClass='status-traveling';statusTxt='Em viagem';}
    let lockMeta='';
    if(lock.locked){lockMeta=`<div class="driver-card-lockmeta">🔒 Travado por tentativas · libera em ~${lock.waitMin} min (${lock.attemptsUsed}/${_RL_MAX} erros)</div>`;}
    else if(lock.warning){lockMeta=`<div class="driver-card-lockmeta warn">⚠️ ${lock.attemptsUsed} de ${_RL_MAX} tentativas de PIN usadas · restam ${_RL_MAX-lock.attemptsUsed}</div>`;}
    const cpfMask='***.***.***-**'; // CPF nunca decifrado no cliente — use botão Ver CPF
    const driverId=d.id||d.uid||'';
    h+=`<div class="driver-card ${d.bloqueado?'blocked':''}${lock.locked?' lockedrate':''}">
      <div class="driver-card-head">
        <div class="driver-card-avatar">${initials}</div>
        <div class="driver-card-info">
          <div class="driver-card-name">${d.nome}</div>
          <div class="driver-card-cpf">CPF: ${cpfMask}</div>
        </div>
        <span class="driver-card-status ${statusClass}"><span class="status-dot" aria-hidden="true"></span>${statusTxt}</span>
      </div>
      <div class="driver-card-meta">Último acesso: ${lastAccess}</div>
      ${lockMeta}
      <div class="driver-card-actions">
        <button class="driver-btn driver-btn-edit" onclick="showEditDriverModal('${driverId}')"><i class="ti ti-edit" aria-hidden="true"></i><span class="driver-btn-label"> Editar</span></button>
        <button class="driver-btn driver-btn-cpf" onclick="viewDriverCPF('${driverId}','${esc(d.nome)}')"><i class="ti ti-eye" aria-hidden="true"></i><span class="driver-btn-label"> Ver CPF</span></button>
        <button class="driver-btn driver-btn-ratelimit${lock.locked?' pulse':''}" onclick="clearDriverLoginRate('${driverId}','${esc(d.nome)}')"><i class="ti ti-key" aria-hidden="true"></i><span class="driver-btn-label"> Liberar login</span></button>
        <button class="driver-btn ${d.bloqueado?'driver-btn-unblock':'driver-btn-block'}" onclick="toggleBlockDriver('${driverId}',${!!d.bloqueado})"><i class="ti ti-${d.bloqueado?'lock-open':'lock'}" aria-hidden="true"></i><span class="driver-btn-label"> ${d.bloqueado?'Desbloquear':'Bloquear'}</span></button>
        <button class="driver-btn driver-btn-del" onclick="deleteDriver('${driverId}')"><i class="ti ti-trash" aria-hidden="true"></i><span class="driver-btn-label"> Excluir</span></button>
      </div>
    </div>`;
  }
  container.innerHTML=h;
}

async function viewDriverCPF(id,nome){
  document.querySelector('.driver-modal-overlay')?.remove();
  const ov=document.createElement('div');ov.className='driver-modal-overlay confirm-overlay';
  ov.innerHTML=`<div class="confirm-box" style="max-width:360px;text-align:left">
    <h3 style="margin-bottom:4px">CPF do motorista</h3>
    <p style="font-size:13px;color:#9a9894;margin-bottom:16px;font-family:'Barlow',sans-serif">${esc(nome||'')}</p>
    <div id="cpfBox" style="display:flex;align-items:center;justify-content:center;padding:16px;background:#f4f2ee;border-radius:10px;font-family:'Barlow',sans-serif;font-size:18px;font-weight:700;letter-spacing:.5px;color:#9a9894;min-height:24px"><span style="font-size:14px;font-weight:600;color:#9a9894">Carregando CPF…</span></div>
    <div class="btns" style="margin-top:16px">
      <button style="background:#eae8e3;color:#1c1c1c;flex:1;padding:12px;border-radius:10px;border:none;font-weight:700;cursor:pointer" onclick="this.closest('.driver-modal-overlay').remove()">Fechar</button>
      <button id="cpfCopyBtn" disabled style="background:#1c1c1c;color:#fff;flex:1;padding:12px;border-radius:10px;border:none;font-weight:700;cursor:pointer;opacity:.5">Copiar</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  const box=ov.querySelector('#cpfBox');const copyBtn=ov.querySelector('#cpfCopyBtn');
  try{
    const fn=firebase.functions().httpsCallable('getDriverCPF');
    const res=await fn({uid:id});
    const cpf=(res&&res.data&&res.data.cpf)||'';
    if(!cpf)throw new Error('empty');
    box.style.color='#1c1c1c';box.innerHTML=`<span>${esc(cpf)}</span>`;
    copyBtn.disabled=false;copyBtn.style.opacity='1';
    copyBtn.onclick=async()=>{try{await navigator.clipboard.writeText(cpf);}catch(e){}if(typeof showToast==='function')showToast('📋 CPF copiado');ov.remove();};
  }catch(err){
    const code=(err&&err.code)||'';
    let msg='Erro ao buscar o CPF. Tente novamente.';
    if(code==='functions/permission-denied')msg='Você precisa estar logado como administrador.';
    else if(code==='functions/not-found')msg='CPF não encontrado para este motorista.';
    else if(code==='functions/unauthenticated')msg='Sessão expirada. Entre novamente como admin.';
    else if(code==='functions/invalid-argument')msg='Identificador do motorista inválido.';
    else if(code)msg='Erro ('+code+'). Tente novamente.';
    box.innerHTML=`<span style="font-size:14px;font-weight:600;color:#c0392b;text-align:center">${esc(msg)}</span>`;
  }
}

function clearDriverLoginRate(id,nome){
  if(!id){if(typeof showToast==='function')showToast('⚠️ Motorista sem ID — recarregue a lista');return;}
  const ov=document.createElement('div');ov.className='confirm-overlay';
  ov.innerHTML=`<div class="confirm-box"><h3>Liberar login?</h3><p>Zera o bloqueio por tentativas de senha de <b>${esc(nome||'')}</b>, permitindo novo login imediato.</p><div class="btns"><button style="background:#eae8e3;color:#1c1c1c" onclick="this.closest('.confirm-overlay').remove()">Cancelar</button><button style="background:#b8791a;color:#fff" onclick="confirmClearDriverLoginRate('${id}');this.closest('.confirm-overlay').remove()">Liberar</button></div></div>`;
  document.body.appendChild(ov);
}

async function confirmClearDriverLoginRate(id){
  try{
    const fn=firebase.functions().httpsCallable('clearDriverRateLimit');
    await fn({uid:id});
    await _loadDriverRateLimits();
    if(typeof renderDriverCards==='function')renderDriverCards();
    if(typeof showToast==='function')showToast('🔓 Login liberado (limite de senha zerado)');
  }catch(err){
    const code=(err&&err.code)||'';
    let msg='Erro ao liberar o login. Tente novamente.';
    if(code==='functions/permission-denied')msg='Voce precisa estar logado como administrador.';
    else if(code==='functions/not-found')msg='Motorista nao encontrado.';
    else if(code==='functions/unauthenticated')msg='Sessao expirada. Entre novamente como admin.';
    else if(code==='functions/invalid-argument')msg='Identificador invalido.';
    else if(code)msg='Erro ('+code+'). Tente novamente.';
    if(typeof showToast==='function')showToast('❌ '+msg);
  }
}

async function toggleBlockDriver(id,blocked){
  if(!id){if(typeof showToast==='function')showToast('⚠️ Motorista sem ID — recarregue a lista');return;}
  try{
    if(db)await db.ref('motoristas/'+id+'/bloqueado').set(!blocked);
    if(drivers[id]&&typeof drivers[id]==='object')drivers[id].bloqueado=!blocked;
    if(typeof renderDriverCards==='function')renderDriverCards();
    if(typeof renderDriverStats==='function')renderDriverStats();
    if(typeof showToast==='function')showToast(blocked?'🔓 Motorista desbloqueado':'🔒 Motorista bloqueado');
  }catch(e){
    console.error('[toggleBlockDriver]',e);
    if(typeof showToast==='function')showToast('❌ Erro ao alterar bloqueio: '+((e&&e.code)||(e&&e.message)||'tente novamente'));
  }
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
  else if(tab==='drivers'){
    // Fallback: se drivers ainda vazio (listener disparou antes de adminMode=true),
    // re-busca do Firebase antes de renderizar
    if(db&&adminMode&&Object.keys(drivers).length===0){
      db.ref('motoristas').once('value',snap=>{
        drivers=snap.val()||{};
        Object.keys(drivers).forEach(k=>{const dr=drivers[k];if(dr&&typeof dr==='object'&&!dr.id)dr.id=k;});
        renderDriverManager();
      }).catch(()=>renderDriverManager());
    }else{
      renderDriverManager();
    }
  }
  else if(tab==='monitor'){renderMonitoring();}
  else if(tab==='bi')renderBI();
  else if(tab==='postos'){if(!_postosListenerInit){initPostosListener();_postosListenerInit=true;}renderAdminPostos();}
}

// ═══ ADMIN POSTOS ═══
let _adminPostoFilter='';

function _adminPostoCard(p,actionsHtml,mapsHtml){
  const cls=getCartaoClass(p.cartao);const lbl=getCartaoLabel(p.cartao);
  const isTruck=(p.cartao==='truckpag');
  const fotos=Array.isArray(p.fotos)?p.fotos.filter(Boolean):[];
  const allFotos=fotos.length>0?fotos:(typeof getFotosByNome==='function'?getFotosByNome(p.nome).filter(Boolean):[]);
  let thumbHtml;
  if(allFotos.length>0){
    const badge=allFotos.length>1?`<div class="ap-photo-badge"><i class="ti ti-photo" aria-hidden="true"></i>${allFotos.length}</div>`:'';
    thumbHtml=`<img class="ap-thumb-img" src="${allFotos[0]}" alt="${esc(p.nome)}">${badge}`;
  }else{
    thumbHtml=`<div class="ap-thumb-icon"><i class="ti ti-gas-station" aria-hidden="true"></i></div>`;
  }
  const routeTag=p._routeName?`<span class="ap-route-tag">Rota ${esc(p._routeNum)}</span>`:'';
  const mapsBtn=p.link?`<a href="${p.link}" target="_blank" class="ap-btn ap-btn--maps"><i class="ti ti-map" aria-hidden="true"></i>Maps</a><div class="ap-sep"></div>`:'';
  return `<div class="ap-card">
    <div class="ap-thumb${isTruck?' ap-thumb--blue':''}">${thumbHtml}</div>
    <div class="ap-body">
      <div class="ap-name">${esc(p.nome||'—')}</div>
      <div class="ap-meta">
        <span class="ap-loc"><i class="ti ti-map-pin" aria-hidden="true"></i>${esc(p.cidade||'')}</span>
        <span class="postos-tag ${cls}" style="font-size:11px;padding:2px 8px;border-radius:10px">${lbl}</span>
        ${routeTag}
      </div>
    </div>
    <div class="ap-actions">${mapsBtn}${actionsHtml}</div>
  </div>`;
}

function renderAdminPostos(){
  const el=document.getElementById('adminPostosList');if(!el)return;
  let h=`<div class="ap-topbar">
    <div class="ap-search-box">
      <i class="ti ti-search ap-search-icon" aria-hidden="true"></i>
      <input id="adminPostoSearch" type="text" class="ap-search-input" placeholder="Pesquisar posto, cidade…" value="${esc(_adminPostoFilter)}" oninput="_adminPostoFilter=this.value;renderAdminPostoCards()">
      <button class="ap-search-clear${_adminPostoFilter?' visible':''}" onclick="_adminPostoFilter='';document.getElementById('adminPostoSearch').value='';renderAdminPostoCards()">✕</button>
    </div>
    <button class="ap-add-btn" onclick="showAddPostoForm()"><i class="ti ti-plus" aria-hidden="true"></i>Novo posto</button>
  </div>`;
  h+=`<div id="adminPostoCards" class="ap-list"></div>`;
  el.innerHTML=h;
  renderAdminPostoCards();
}

function renderAdminPostoCards(){
  const container=document.getElementById('adminPostoCards');if(!container)return;
  const normFn=s=>(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const q=normFn(_adminPostoFilter);
  const clearBtn=document.querySelector('.ap-search-clear');
  if(clearBtn)clearBtn.className='ap-search-clear'+(_adminPostoFilter?' visible':'');
  // Monta lista única deduplicada por nome|cidade (avulsos têm prioridade)
  const dedup={};
  routes.forEach(r=>{(r.paradas||[]).forEach(p=>{if(p.tipo==='origem'||p.tipo==='destino')return;const k=normFn(p.nome)+'|'+normFn(p.cidade);if(!dedup[k])dedup[k]={nome:p.nome,cidade:p.cidade,cartao:p.cartao,link:p.link||''};});});
  Object.values(postosAvulsos||{}).forEach(p=>{const k=normFn(p.nome)+'|'+normFn(p.cidade);dedup[k]={...p};});
  let unified=Object.values(dedup).sort((a,b)=>(a.nome||'').localeCompare(b.nome||'','pt'));
  if(q)unified=unified.filter(p=>normFn((p.nome||'')+' '+(p.cidade||'')).includes(q));
  let h='';
  if(unified.length===0){
    h=`<div style="text-align:center;padding:24px 20px;color:#9a9894;font-family:'Barlow',sans-serif;font-size:13px">${_adminPostoFilter?'Nenhum posto encontrado':'Nenhum posto cadastrado'}</div>`;
  }else{
    unified.forEach(p=>{
      const nEnc=encodeURIComponent(p.nome||'');const cEnc=encodeURIComponent(p.cidade||'');
      const delBtn=p.id?`<button class="ap-btn ap-btn--danger" onclick="deletePostoAvulso('${p.id}')"><i class="ti ti-trash" aria-hidden="true"></i></button>`:'';
      const acts=`<button class="ap-btn" onclick="showEditPostoUnified('${nEnc}','${cEnc}')"><i class="ti ti-pencil" aria-hidden="true"></i>Editar</button><button class="ap-btn ap-btn--green" onclick="editPostoFotosByKey('${nEnc}','${cEnc}')"><i class="ti ti-photo" aria-hidden="true"></i>Fotos</button>${delBtn}`;
      h+=_adminPostoCard(p,acts,'');
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

function showEditPostoUnified(nomeEnc,cidadeEnc){
  const nome=decodeURIComponent(nomeEnc);const cidade=decodeURIComponent(cidadeEnc);
  const normFn=s=>(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const avulso=Object.values(postosAvulsos||{}).find(p=>normFn(p.nome)===normFn(nome)&&normFn(p.cidade)===normFn(cidade))||{};
  const cartao=avulso.cartao||'truckpag';const link=avulso.link||'';
  document.querySelector('.postos-form-ov')?.remove();
  const ov=document.createElement('div');ov.className='postos-form-ov';
  ov.innerHTML=`<div class="postos-form-box">
    <div class="postos-form-title">Editar posto</div>
    <div class="postos-form-field"><label>Nome do posto</label><input id="puNome" value="${esc(nome)}"></div>
    <div class="postos-form-field"><label>Cidade — UF</label><input id="puCidade" value="${esc(cidade)}"></div>
    <div class="postos-form-field"><label>Tipo de pagamento</label>
      <select id="puCartao">
        <option value="truckpag"${cartao==='truckpag'?' selected':''}>TruckPag</option>
        <option value="shell"${cartao==='shell'?' selected':''}>Shell</option>
        <option value="shell_expers"${cartao==='shell_expers'?' selected':''}>Shell Expers</option>
        <option value="redefrota"${cartao==='redefrota'?' selected':''}>Rede Frota</option>
        <option value="compra_antecipada"${cartao==='compra_antecipada'?' selected':''}>Compra Antecipada</option>
      </select>
    </div>
    <div class="postos-form-field"><label>Link Google Maps</label><input id="puLink" value="${esc(link)}"></div>
    <div class="postos-form-err" id="puError" style="display:none"></div>
    <div class="postos-form-btns">
      <button class="postos-form-cancel" onclick="this.closest('.postos-form-ov').remove()">Cancelar</button>
      <button class="postos-form-save" onclick="saveEditPostoUnified('${nomeEnc}','${cidadeEnc}')">Salvar</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  setTimeout(()=>document.getElementById('puNome')?.focus(),100);
}

async function saveEditPostoUnified(oldNomeEnc,oldCidadeEnc){
  const oldNome=decodeURIComponent(oldNomeEnc);const oldCidade=decodeURIComponent(oldCidadeEnc);
  const nome=(document.getElementById('puNome')?.value||'').trim();
  const cidade=(document.getElementById('puCidade')?.value||'').trim();
  const cartao=document.getElementById('puCartao')?.value||'truckpag';
  const link=(document.getElementById('puLink')?.value||'').trim();
  const errEl=document.getElementById('puError');
  const btn=document.querySelector('.postos-form-ov .postos-form-save');
  if(!nome||!cidade){errEl.textContent='Nome e cidade são obrigatórios';errEl.style.display='block';return;}
  if(btn){btn.disabled=true;btn.textContent='Salvando...';}
  // ── diagnóstico de auth ─────────────────────────────────────────────────
  const _cu=firebase.auth().currentUser;
  const _tok=_cu?await _cu.getIdTokenResult().catch(()=>null):null;
  console.log('[saveEditPostoUnified] currentUser:',_cu?.email||'null','| uid:',_cu?.uid||'null','| admin claim:',_tok?.claims?.admin||false);
  if(!_cu){const errMsg='Sessão expirada — faça logout e login novamente';errEl.textContent=errMsg;errEl.style.display='block';if(btn){btn.disabled=false;btn.textContent='Salvar';}return;}
  // ───────────────────────────────────────────────────────────────────────
  const normFn=s=>(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const on=normFn(oldNome),oc=normFn(oldCidade);
  try{
    // 1. Atualizar/criar entrada em Firebase postos
    const existingEntry=Object.entries(postosAvulsos||{}).find(([,v])=>normFn(v.nome)===on&&normFn(v.cidade)===oc);
    const id=existingEntry?.[0]||('posto_'+Date.now());
    const existing=existingEntry?.[1]||{};
    const postoData={id,nome,cidade,cartao,link,criadoEm:existing.criadoEm||Date.now()};
    if(existing.fotos&&existing.fotos.length)postoData.fotos=existing.fotos;
    if(db)await db.ref('postos/'+id).set(postoData);
    else{postosAvulsos[id]=postoData;}
    // 2. Propagar para todas as rotas que usam este posto
    let changed=false;
    routes.forEach(r=>{
      (r.paradas||[]).forEach(p=>{
        if(normFn(p.nome)===on&&normFn(p.cidade)===oc){p.nome=nome;p.cidade=cidade;p.cartao=cartao;p.link=link;changed=true;}
        if(p.alternativa&&normFn(p.alternativa.nome)===on&&normFn(p.alternativa.cidade)===oc){p.alternativa.nome=nome;p.alternativa.cidade=cidade;p.alternativa.cartao=cartao;p.alternativa.link=link;changed=true;}
      });
    });
    if(changed)await saveToFirebase();
    document.querySelector('.postos-form-ov')?.remove();
    renderAdminPostos();
    showToast('✅ Posto atualizado em todas as rotas');
  }catch(e){console.error('[saveEditPostoUnified]',e);errEl.textContent='Erro ao salvar: '+(e?.message||e);errEl.style.display='block';if(btn){btn.disabled=false;btn.textContent='Salvar';}}
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


