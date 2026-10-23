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
      const fn=_callFn('registerDriver');
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
        const fn=_callFn('adminSetDriverPIN');
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
      const fn=_callFn('adminSetDriverPIN');
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

// ═══ ADMIN MOTORISTAS v2 — visual igual ao da aba Rotas ═══
let _driverStatusFilter='all';
let _driverSort='nome';
function _amAttr(s){return String(s==null?'':s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function _amNorm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')}
function _amList(){return Object.values(drivers||{}).filter(d=>d&&typeof d==='object'&&d.nome)}
// Situação: bloqueado > login travado > nunca acessou > ativo
function _amStatus(d){
  if(d.bloqueado)return 'blk';
  if(_driverLockState(d).locked)return 'lock';
  if(!d.ultimoAcesso)return 'new';
  return 'ok';
}
const _AM_ST={ok:{t:'Ativo',c:'am-st-ok'},blk:{t:'Bloqueado',c:'am-st-blk'},lock:{t:'Login travado',c:'am-st-lock'},new:{t:'Nunca acessou',c:'am-st-new'}};
function _amRel(ts){
  if(!ts)return 'PIN inicial ainda não usado';
  const m=Math.floor((Date.now()-ts)/60000);
  if(m<1)return 'agora mesmo';
  if(m<60)return 'há '+m+' min';
  const h=Math.floor(m/60);if(h<24)return 'há '+h+(h===1?' hora':' horas');
  const d=Math.floor(h/24);if(d<31)return 'há '+d+(d===1?' dia':' dias');
  const mo=Math.floor(d/30);return 'há '+mo+(mo===1?' mês':' meses');
}
function _amAbs(ts){
  if(!ts)return 'Nunca';
  const dt=new Date(ts),hoje=new Date();
  const hm=dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  const ontem=new Date(hoje);ontem.setDate(hoje.getDate()-1);
  if(dt.toDateString()===hoje.toDateString())return 'Hoje, '+hm;
  if(dt.toDateString()===ontem.toDateString())return 'Ontem, '+hm;
  return dt.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})+', '+hm;
}
function _amDate(ts){return ts?new Date(ts).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'}):''}

async function renderDriverManager(){
  const el=document.getElementById('adminDriversList');if(!el)return;
  let h=`<div class="ar-head"><div><div class="ar-crumb">Administração / Motoristas</div><h2 class="ar-title">Motoristas cadastrados</h2></div><div class="ar-head-actions"><button class="ar-btn ar-btn-ghost" onclick="exportDriversCSV()"><i class="ti ti-download" aria-hidden="true"></i> Exportar</button><button class="ar-btn ar-btn-primary" onclick="showAddDriverModal()"><i class="ti ti-plus" aria-hidden="true"></i> Cadastrar motorista</button></div></div>`;
  h+=`<div class="ar-kpis" id="adminDriversStats"></div>`;
  h+=`<div class="ar-panel"><div class="ar-panel-top"><div class="admin-search ar-search"><i class="ti ti-search admin-search-icon" aria-hidden="true"></i><input id="driverSearch" type="text" aria-label="Pesquisar motorista" placeholder="Buscar por nome do motorista…" value="${esc(_driverFilter)}" oninput="_driverFilter=this.value;renderDriverCards()"><button class="admin-search-clear ${_driverFilter?'visible':''}" aria-label="Limpar busca" onclick="_driverFilter='';document.getElementById('driverSearch').value='';renderDriverCards()">✕</button></div><div class="ar-chips" id="driverStatusChips" role="group" aria-label="Filtrar por situação"></div></div>`
    +`<div class="am-thead" aria-hidden="true"><span>Motorista</span><span>Situação</span><button type="button" tabindex="-1" class="am-sort" id="amSortAcc" onclick="_driverSetSort()">Último acesso <i class="ti ti-arrows-sort"></i></button><span>Tentativas de PIN</span><span>Ações</span></div>`
    +`<div id="driverCardsContainer"></div><div class="ar-foot" id="driverFoot"></div></div>`;
  el.innerHTML=h;
  await _loadDriverRateLimits();
  renderDriverCards();
  renderDriverStats();
}

function _driverSetStatus(k){_driverStatusFilter=k||'all';renderDriverCards()}
function _driverSetSort(){_driverSort=_driverSort==='nome'?'acesso':'nome';renderDriverCards()}

function renderDriverStats(){
  const el=document.getElementById('adminDriversStats');if(!el)return;
  const list=_amList();
  const total=list.length;
  const blocked=list.filter(d=>d.bloqueado).length;
  const active=total-blocked;
  const semana=list.filter(d=>d.ultimoAcesso&&Date.now()-d.ultimoAcesso<7*864e5).length;
  const travados=list.filter(d=>!d.bloqueado&&_driverLockState(d).locked).length;
  el.innerHTML=`<div class="ar-kpi"><div class="ar-kpi-lbl">Motoristas</div><div class="ar-kpi-val">${total}</div><div class="ar-kpi-sub">${semana} acessaram nos últimos 7 dias</div></div>`
   +`<div class="ar-kpi"><div class="ar-kpi-lbl">Ativos</div><div class="ar-kpi-val am-v-ok">${active}</div><div class="ar-kpi-sub">Podem entrar no app</div></div>`
   +`<div class="ar-kpi"><div class="ar-kpi-lbl">Bloqueados</div><div class="ar-kpi-val am-v-blk">${blocked}</div><div class="ar-kpi-sub">Bloqueio manual pelo admin</div></div>`
   +`<div class="ar-kpi ar-kpi-alert am-kpi-lock${travados?'':' ok'}"><div class="ar-kpi-lbl"><i class="ti ${travados?'ti-lock':'ti-circle-check'}" aria-hidden="true"></i> Login travado</div><div class="ar-kpi-val">${travados}</div><div class="ar-kpi-sub">${travados?'Errou o PIN 5 vezes — libere na lista':'Nenhum login travado agora'}</div></div>`;
}

function renderDriverCards(){
  const container=document.getElementById('driverCardsContainer');if(!container)return;
  const q=_amNorm(_driverFilter);
  const clearBtn=document.getElementById('driverSearch')?.parentElement?.querySelector('.admin-search-clear');
  if(clearBtn)clearBtn.className='admin-search-clear'+(q?' visible':'');
  const all=_amList();
  const counts={all:all.length,ok:0,blk:0,lock:0,new:0};
  all.forEach(d=>counts[_amStatus(d)]++);
  const chipsEl=document.getElementById('driverStatusChips');
  if(chipsEl)chipsEl.innerHTML=[['all','Todos'],['ok','Ativos'],['blk','Bloqueados'],['lock','Login travado'],['new','Nunca acessou']].map(([k,l])=>{const on=_driverStatusFilter===k;return `<button class="ar-chip${on?' on':''}" aria-pressed="${on}" onclick="_driverSetStatus('${k}')">${l}<span class="ar-chip-ct">${counts[k]}</span></button>`}).join('');
  const sortBtn=document.getElementById('amSortAcc');if(sortBtn)sortBtn.classList.toggle('on',_driverSort==='acesso');
  let list=all.filter(d=>(_driverStatusFilter==='all'||_amStatus(d)===_driverStatusFilter)&&(!q||_amNorm(d.nome).includes(q)));
  if(_driverSort==='acesso')list.sort((a,b)=>(b.ultimoAcesso||0)-(a.ultimoAcesso||0));
  else list.sort((a,b)=>String(a.nome).localeCompare(String(b.nome),'pt'));
  const foot=document.getElementById('driverFoot');
  if(foot)foot.innerHTML=`<span>Mostrando ${list.length} de ${all.length} motorista${all.length===1?'':'s'}</span><span>${_driverSort==='acesso'?'Ordenado por último acesso (mais recente primeiro)':'Ordenado por nome'}</span>`;
  if(list.length===0){
    container.innerHTML=`<div class="admin-no-results"><i class="ti ${q?'ti-search':'ti-users'}" aria-hidden="true"></i>${q||_driverStatusFilter!=='all'?'Nenhum motorista encontrado para esse filtro.':'Nenhum motorista cadastrado ainda.'}</div>`;
    return;
  }
  let h='';
  for(const d of list){
    const id=_amAttr(d.id||d.uid||'');
    const nome=_amAttr(d.nome);
    const st=_amStatus(d),S=_AM_ST[st];
    const lock=_driverLockState(d);
    const t=lock.attemptsUsed||0;
    const initials=String(d.nome).trim().split(/\s+/).slice(0,2).map(n=>n[0]||'').join('').toUpperCase();
    let pinTxt='Nenhum erro',pinCls='';
    if(lock.locked){pinTxt=`Travado · libera em ~${lock.waitMin} min`;pinCls=' am-pin-warn';}
    else if(lock.warning){pinTxt=`${t} de ${_RL_MAX} erros · restam ${_RL_MAX-t}`;pinCls=' am-pin-warn';}
    else if(t){pinTxt=`${t} de ${_RL_MAX} erros`;}
    let dots='';for(let i=0;i<_RL_MAX;i++)dots+=`<span class="${i<t?(lock.locked||lock.warning?'on warn':'on'):''}"></span>`;
    const blk=!!d.bloqueado;
    h+=`<div class="am-row${blk?' am-blocked':''}">
      <div class="am-who"><div class="am-av">${_amAttr(initials)}</div><div class="am-who-txt"><div class="am-name">${nome}</div><div class="am-sub">CPF ***.***.***-**${d.criadoEm?' · cadastrado em '+_amDate(d.criadoEm):''}</div></div><span class="ar-badge ${S.c} am-st-m">${S.t}</span></div>
      <span class="am-col-st"><span class="ar-badge ${S.c}">${S.t}</span></span>
      <div class="am-col-acc"><div class="am-acc-abs"><span class="am-acc-lbl">Último acesso: </span>${_amAbs(d.ultimoAcesso)}</div><div class="am-acc-rel">${_amRel(d.ultimoAcesso)}</div></div>
      <div class="am-col-pin${t?'':' am-pin-zero'}${pinCls}"><div class="am-pins" aria-hidden="true">${dots}</div><div class="am-pin-txt">${pinTxt}</div></div>
      <div class="am-actions">
        <button class="ar-icon am-act" title="Editar" aria-label="Editar ${nome}" onclick="showEditDriverModal('${id}')"><i class="ti ti-edit" aria-hidden="true"></i><span>Editar</span></button>
        <button class="ar-icon am-act" title="Ver CPF" aria-label="Ver CPF de ${nome}" data-id="${id}" onclick="viewDriverCPF(this.dataset.id,(drivers[this.dataset.id]||{}).nome)"><i class="ti ti-eye" aria-hidden="true"></i><span>CPF</span></button>
        <button class="ar-icon am-act${lock.locked||lock.warning?' am-act-warn':''}" title="Liberar login (zera tentativas de PIN)" aria-label="Liberar login de ${nome}" data-id="${id}" onclick="clearDriverLoginRate(this.dataset.id,(drivers[this.dataset.id]||{}).nome)"><i class="ti ti-key" aria-hidden="true"></i><span>Liberar</span></button>
        <button class="ar-icon am-act" title="${blk?'Desbloquear':'Bloquear'}" aria-label="${blk?'Desbloquear':'Bloquear'} ${nome}" onclick="toggleBlockDriver('${id}',${blk})"><i class="ti ti-${blk?'lock-open':'lock'}" aria-hidden="true"></i><span>${blk?'Desbloq.':'Bloquear'}</span></button>
        <button class="ar-icon ar-icon-del am-act am-act-del" title="Excluir" aria-label="Excluir ${nome}" onclick="deleteDriver('${id}')"><i class="ti ti-trash" aria-hidden="true"></i></button>
      </div>
    </div>`;
  }
  container.innerHTML=h;
}

function exportDriversCSV(){
  const cell=v=>{let s=String(v??'');if(/^[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};
  const fmt=ts=>ts?new Date(ts).toLocaleString('pt-BR'):'';
  const rows=[['Nome','Situacao','Ultimo acesso','Cadastrado em','Erros de PIN (janela atual)']];
  _amList().sort((a,b)=>String(a.nome).localeCompare(String(b.nome),'pt')).forEach(d=>{
    rows.push([d.nome,_AM_ST[_amStatus(d)].t,fmt(d.ultimoAcesso)||'Nunca',fmt(d.criadoEm),_driverLockState(d).attemptsUsed||0]);
  });
  const csv='﻿'+rows.map(x=>x.map(cell).join(';')).join('\r\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.download='motoristas-'+new Date().toISOString().slice(0,10)+'.csv';document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);
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
    const fn=_callFn('getDriverCPF');
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
    const fn=_callFn('clearDriverRateLimit');
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

// ═══ ADMIN TAB SWITCH ═══
function switchAdminTab(tab,el){
  document.querySelectorAll('.admin-tab-btn').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('.admin-tab-pane').forEach(p=>p.classList.remove('active'));
  const paneMap={routes:'adminTabRoutes',drivers:'adminTabDrivers',postos:'adminTabPostos',informativos:'adminTabInformativos'};
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
  else if(tab==='informativos'){if(typeof renderAdminInformativos==='function')renderAdminInformativos();}
  else if(tab==='postos'){if(!_postosListenerInit){initPostosListener();_postosListenerInit=true;}renderAdminPostos();}
}

// ═══ ADMIN POSTOS v2 — visual igual ao da aba Rotas ═══
let _adminPostoFilter='';
let _adminPostoCard='all';
let _adminPostoPend=false;
const _APX_CARD={truckpag:'TruckPag',shell:'Shell Experis',frota:'Rede Frota',antecipada:'Antecipada',outro:'Outros'};
function _apxEnc(s){return encodeURIComponent(s||'').replace(/'/g,'%27')}
function _apxUF(cidade){return typeof _pstUF==='function'?_pstUF(cidade):''}
function _apxUFNome(uf){return (typeof _UF_NOMES!=='undefined'&&_UF_NOMES[uf])||''}

// Lista única deduplicada por nome|cidade (avulsos têm prioridade), com as rotas onde aparece
function _apxBuild(){
  const n=_amNorm;
  const dedup={},rotas={};
  routes.forEach(r=>{(r.paradas||[]).forEach(p=>{
    if(p.tipo==='origem'||p.tipo==='destino'||!p.nome)return;
    const k=n(p.nome)+'|'+n(p.cidade);
    if(!dedup[k])dedup[k]={nome:p.nome,cidade:p.cidade,cartao:p.cartao,link:p.link||''};
    const lbl='Rota '+(r.numero??'?');
    (rotas[k]=rotas[k]||[]);if(!rotas[k].includes(lbl))rotas[k].push(lbl);
  });});
  Object.values(postosAvulsos||{}).forEach(p=>{if(!p||!p.nome)return;const k=n(p.nome)+'|'+n(p.cidade);dedup[k]={...(dedup[k]||{}),...p};});
  return Object.keys(dedup).map(k=>{
    const p=dedup[k];
    let fotos=Array.isArray(p.fotos)?p.fotos.filter(Boolean):[];
    if(!fotos.length&&typeof getFotosByNome==='function')fotos=getFotosByNome(p.nome).filter(Boolean);
    return {...p,_rotas:rotas[k]||[],_fotos:fotos,_uf:_apxUF(p.cidade),_ck:(typeof getCartaoKey==='function'?getCartaoKey(p.cartao):'outro'),_avulso:!!p.id};
  }).sort((a,b)=>String(a.nome||'').localeCompare(String(b.nome||''),'pt'));
}

function renderAdminPostos(){
  const el=document.getElementById('adminPostosList');if(!el)return;
  let h=`<div class="ar-head"><div><div class="ar-crumb">Administração / Postos</div><h2 class="ar-title">Postos cadastrados</h2></div><div class="ar-head-actions"><button class="ar-btn ar-btn-ghost" onclick="exportPostosCSV()"><i class="ti ti-download" aria-hidden="true"></i> Exportar</button><button class="ar-btn ar-btn-primary" onclick="showAddPostoForm()"><i class="ti ti-plus" aria-hidden="true"></i> Novo posto</button></div></div>`;
  h+=`<div class="ar-kpis" id="adminPostosStats"></div>`;
  h+=`<div class="ar-panel"><div class="ar-panel-top"><div class="admin-search ar-search"><i class="ti ti-search admin-search-icon" aria-hidden="true"></i><input id="adminPostoSearch" type="text" aria-label="Pesquisar posto" placeholder="Buscar posto, cidade ou UF…" value="${esc(_adminPostoFilter)}" oninput="_adminPostoFilter=this.value;renderAdminPostoCards()"><button class="admin-search-clear ${_adminPostoFilter?'visible':''}" aria-label="Limpar busca" onclick="_adminPostoFilter='';document.getElementById('adminPostoSearch').value='';renderAdminPostoCards()">✕</button></div><div class="ar-chips" id="adminPostoChips" role="group" aria-label="Filtrar por cartão"></div></div>`
    +`<div class="apx-thead" aria-hidden="true"><span>Foto</span><span>Posto</span><span>Cartão</span><span>Nas rotas</span><span>Cadastro</span><span>Ações</span></div>`
    +`<div id="adminPostoCards"></div><div class="ar-foot" id="adminPostoFoot"></div></div>`;
  el.innerHTML=h;
  renderAdminPostoCards();
}

function _adminPostoSetCard(k){_adminPostoCard=k||'all';renderAdminPostoCards()}
function _adminPostoTogglePend(){_adminPostoPend=!_adminPostoPend;renderAdminPostoCards()}

function _renderAdminPostoStats(all){
  const el=document.getElementById('adminPostosStats');if(!el)return;
  const total=all.length;
  const nasRotas=all.filter(p=>p._rotas.length).length;
  const avulsos=all.filter(p=>p._avulso&&!p._rotas.length).length;
  const semMaps=all.filter(p=>!p.link).length;
  const semFoto=all.filter(p=>!p._fotos.length).length;
  const byCard={};all.forEach(p=>{if(p._ck!=='outro')byCard[p._ck]=(byCard[p._ck]||0)+1});
  const top=Object.entries(byCard).sort((a,b)=>b[1]-a[1])[0];
  el.innerHTML=`<div class="ar-kpi"><div class="ar-kpi-lbl">Postos cadastrados</div><div class="ar-kpi-val">${total}</div><div class="ar-kpi-sub">${nasRotas} nas rotas · ${avulsos} avulso${avulsos===1?'':'s'}</div></div>`
   +`<div class="ar-kpi"><div class="ar-kpi-lbl">Cartão mais usado</div><div class="ar-kpi-val apx-kpi-txt">${top?_APX_CARD[top[0]]:'—'}</div><div class="ar-kpi-sub">${top?top[1]+' posto'+(top[1]===1?'':'s')+' com esse cartão':'Nenhum posto ainda'}</div></div>`
   +`<div class="ar-kpi"><div class="ar-kpi-lbl">Sem localização</div><div class="ar-kpi-val${semMaps?' am-v-blk':''}">${semMaps}</div><div class="ar-kpi-sub">${semMaps?'Sem link do Maps — motorista não acha':'Todos têm link do Maps'}</div></div>`
   +`<div class="ar-kpi ar-kpi-alert${semFoto?'':' ok'}"><div class="ar-kpi-lbl"><i class="ti ${semFoto?'ti-photo-off':'ti-circle-check'}" aria-hidden="true"></i> Postos sem foto</div><div class="ar-kpi-val">${semFoto}</div><div class="ar-kpi-sub">${semFoto?'Adicione a foto da fachada':'Todos os postos têm foto'}</div></div>`;
}

function renderAdminPostoCards(){
  const container=document.getElementById('adminPostoCards');if(!container)return;
  const q=_amNorm(_adminPostoFilter);
  const clearBtn=document.getElementById('adminPostoSearch')?.parentElement?.querySelector('.admin-search-clear');
  if(clearBtn)clearBtn.className='admin-search-clear'+(q?' visible':'');
  const all=_apxBuild();
  _renderAdminPostoStats(all);
  const counts={all:all.length};all.forEach(p=>{counts[p._ck]=(counts[p._ck]||0)+1});
  const pendCt=all.filter(p=>!p.link||!p._fotos.length).length;
  const keys=['all','truckpag','shell','frota','antecipada'].concat(counts.outro?['outro']:[]);
  if(_adminPostoCard!=='all'&&!counts[_adminPostoCard])_adminPostoCard='all';
  const chipsEl=document.getElementById('adminPostoChips');
  if(chipsEl)chipsEl.innerHTML=keys.map(k=>{const on=_adminPostoCard===k;return `<button class="ar-chip${on?' on':''}" aria-pressed="${on}" onclick="_adminPostoSetCard('${k}')">${k==='all'?'':`<span class="apx-dot apx-dot-${k}" aria-hidden="true"></span>`}${k==='all'?'Todos':_APX_CARD[k]}<span class="ar-chip-ct">${counts[k]||0}</span></button>`}).join('')
    +`<button class="ar-chip apx-chip-pend${_adminPostoPend?' on':''}" aria-pressed="${_adminPostoPend}" onclick="_adminPostoTogglePend()"><i class="ti ti-alert-triangle" aria-hidden="true"></i>Só com pendência<span class="ar-chip-ct">${pendCt}</span></button>`;
  const list=all.filter(p=>(_adminPostoCard==='all'||p._ck===_adminPostoCard)
    &&(!_adminPostoPend||!p.link||!p._fotos.length)
    &&(!q||_amNorm((p.nome||'')+' '+(p.cidade||'')+' '+p._uf+' '+_apxUFNome(p._uf)).includes(q)));
  const foot=document.getElementById('adminPostoFoot');
  if(foot)foot.innerHTML=`<span>Mostrando ${list.length} de ${all.length} posto${all.length===1?'':'s'} · agrupados por estado</span><span>Excluir só vale para posto avulso — os das rotas saem editando a rota</span>`;
  if(list.length===0){
    container.innerHTML=`<div class="admin-no-results"><i class="ti ${q?'ti-search':'ti-gas-station'}" aria-hidden="true"></i>${all.length?'Nenhum posto encontrado para esse filtro.':'Nenhum posto cadastrado ainda.'}</div>`;
    return;
  }
  const grupos={};list.forEach(p=>{const k=p._uf||'__';(grupos[k]=grupos[k]||[]).push(p)});
  const ordem=Object.keys(grupos).sort((a,b)=>a==='__'?1:b==='__'?-1:_apxUFNome(a).localeCompare(_apxUFNome(b),'pt'));
  let h='';
  ordem.forEach(uf=>{
    const g=grupos[uf];
    h+=`<div class="apx-group"><span class="apx-uf">${uf==='__'?'—':uf}</span>${uf==='__'?'SEM UF':_apxUFNome(uf).toUpperCase()}<span class="apx-group-ct">· ${g.length} posto${g.length===1?'':'s'}</span></div>`;
    g.forEach(p=>{h+=_adminPostoRow(p)});
  });
  container.innerHTML=h;
}

function _adminPostoRow(p){
  const nE=_apxEnc(p.nome),cE=_apxEnc(p.cidade);
  const nome=_amAttr(p.nome||'—');
  const nf=p._fotos.length;
  const thumb=nf?`<img src="${_amAttr(p._fotos[0])}" loading="lazy" decoding="async" alt="">${nf>1?`<span class="apx-thumb-ct">${nf}</span>`:''}`:`<i class="ti ti-gas-station" aria-hidden="true"></i>`;
  const ck=p._ck;
  const cardBadge=`<span class="ar-badge apx-c-${ck}">${_amAttr(typeof getCartaoLabel==='function'?getCartaoLabel(p.cartao):(p.cartao||'—'))}</span>`;
  const rts=p._rotas;
  let rtHtml=rts.slice(0,2).map(r=>`<span class="apx-rt">${_amAttr(r)}</span>`).join('')+(rts.length>2?`<span class="apx-rt" title="${_amAttr(rts.join(', '))}">+${rts.length-2}</span>`:'');
  if(p._avulso&&!rts.length)rtHtml+=`<span class="apx-rt apx-rt-av">Avulso</span>`;
  const pend=[!p.link?'Sem localização no Maps':'',!nf?'Sem foto':''].filter(Boolean).join(' · ');
  const mapsBtn=p.link?`<a class="ar-icon am-act" href="${_amAttr(p.link)}" target="_blank" rel="noopener" title="Abrir no Maps" aria-label="Abrir ${nome} no Maps"><i class="ti ti-map" aria-hidden="true"></i><span>Maps</span></a>`
    :`<button class="ar-icon am-act apx-off" disabled title="Sem link do Maps" aria-label="${nome} sem link do Maps"><i class="ti ti-map" aria-hidden="true"></i><span>Maps</span></button>`;
  const delBtn=p._avulso?`<button class="ar-icon ar-icon-del am-act am-act-del" title="Excluir posto avulso" aria-label="Excluir ${nome}" onclick="deletePostoAvulso('${_amAttr(p.id)}')"><i class="ti ti-trash" aria-hidden="true"></i></button>`
    :`<button class="ar-icon am-act am-act-del apx-off" disabled title="Posto de rota — remova editando a rota" aria-label="${nome} é posto de rota"><i class="ti ti-trash" aria-hidden="true"></i></button>`;
  return `<div class="apx-row">
    <button class="apx-thumb${nf?'':' apx-thumb-empty'}" title="Fotos" aria-label="Fotos de ${nome}" onclick="editPostoFotosByKey('${nE}','${cE}')">${thumb}</button>
    <div class="apx-info"><div class="am-name">${nome}</div><div class="am-sub"><i class="ti ti-map-pin" aria-hidden="true"></i> ${_amAttr(p.cidade||'Cidade não informada')}</div><div class="apx-tags-m">${cardBadge}${rtHtml}</div></div>
    <span class="apx-col-card">${cardBadge}</span>
    <div class="apx-col-rt">${rtHtml||'<span class="am-sub">—</span>'}</div>
    <div class="apx-col-cad"><span class="${p.link?'apx-ok':'apx-bad'}">${p.link?'✓ Localização ok':'Sem localização'}</span><span class="${nf?'apx-muted':'apx-warn'}">${nf?nf+(nf===1?' foto':' fotos'):'Sem foto'}</span></div>
    ${pend?`<div class="apx-pend-m">${pend}</div>`:''}
    <div class="am-actions">${mapsBtn}<button class="ar-icon am-act" title="Fotos" aria-label="Fotos de ${nome}" onclick="editPostoFotosByKey('${nE}','${cE}')"><i class="ti ti-photo" aria-hidden="true"></i><span>Fotos</span></button><button class="ar-icon am-act" title="Editar" aria-label="Editar ${nome}" onclick="showEditPostoUnified('${nE}','${cE}')"><i class="ti ti-edit" aria-hidden="true"></i><span>Editar</span></button>${delBtn}</div>
  </div>`;
}

function exportPostosCSV(){
  const cell=v=>{let s=String(v??'');if(/^[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};
  const rows=[['Posto','Cidade','UF','Cartao','Rotas','Tipo','Link Maps','Fotos']];
  _apxBuild().forEach(p=>rows.push([p.nome,p.cidade||'',p._uf,typeof getCartaoLabel==='function'?getCartaoLabel(p.cartao):(p.cartao||''),p._rotas.join(', '),p._rotas.length?'Rota':'Avulso',p.link||'',p._fotos.length]));
  const csv='﻿'+rows.map(x=>x.map(cell).join(';')).join('\r\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.download='postos-'+new Date().toISOString().slice(0,10)+'.csv';document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);
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


