// ═══ POSTOS ═══
var postosAvulsos={};
var _postosListenerInit=false;

// ─── helpers cartão ───
function getCartaoLabel(cartao){
  const m={truckpag:'TruckPag',shell:'Shell',shell_expers:'Shell Experis',frota:'Rede Frota',rede_frota:'Rede Frota',antecipada:'Antecipada',compra_antecipada:'Antecipada'};
  return m[(cartao||'').toLowerCase()]||cartao||'—';
}
function getCartaoClass(cartao){
  const c=(cartao||'').toLowerCase();
  if(c==='truckpag')return 'ptag-truckpag';
  if(c.startsWith('shell'))return 'ptag-shell';
  if(c.includes('frota'))return 'ptag-frota';
  if(c.includes('antecipada'))return 'ptag-antecipada';
  return 'ptag-outro';
}

// ─── extrai postos das rotas (usa variável global `routes`) ───
function extractPostosFromRoutes(){
  const src=routes.length>0?routes:DEFAULTS;
  const list=[];
  src.forEach(rota=>{
    (rota.paradas||[]).forEach(p=>{
      if(p.tipo==='origem'||p.tipo==='destino')return;
      list.push({_id:rota.id+'_'+p.ordem,nome:p.nome,cidade:p.cidade,cartao:p.cartao,link:p.link||'',rotaNumero:rota.numero,_source:'rota'});
      if(p.alternativa){
        list.push({_id:rota.id+'_'+p.ordem+'_alt',nome:p.alternativa.nome,cidade:p.alternativa.cidade,cartao:p.alternativa.cartao,link:p.alternativa.link||'',rotaNumero:rota.numero,_source:'rota'});
      }
    });
  });
  return list;
}

// ─── Firebase listener (lazy) ───
function initPostosListener(){
  if(!db)return;
  db.ref('postos').on('value',snap=>{
    postosAvulsos=snap.val()||{};
    if(document.getElementById('screenPostos')?.classList.contains('active'))renderPostosList();
  });
}

// ─── navegação ───
function showPostos(){
  if(!_postosListenerInit){initPostosListener();_postosListenerInit=true;}
  navPush('screenPostos');
  renderPostosList();
  updateBottomNav('Postos');
}

// ─── bottom nav ───
function updateBottomNav(active){
  const nav=document.getElementById('bottomNav');
  if(!nav)return;
  if(IS_DESKTOP()){nav.style.display='none';return;}
  nav.style.display='flex';
  document.querySelectorAll('.bnav-item').forEach(b=>b.classList.remove('active'));
  const btn=document.getElementById('bnav'+active);
  if(btn)btn.classList.add('active');
}

function bnavGoRotas(){
  if(_navStack[_navStack.length-1]==='screenPostos')navPop();
  updateBottomNav('Rotas');
}

function bnavGoPostos(){
  if(_navStack[_navStack.length-1]==='screenPostos'){updateBottomNav('Postos');return;}
  showPostos();
}

function bnavGoViagem(){showMapLive();}

function hideBottomNav(){
  const nav=document.getElementById('bottomNav');
  if(nav)nav.style.display='none';
}

// ─── render lista ───
function renderPostosList(){
  const query=(document.getElementById('postosSearch')?.value||'').toLowerCase().trim();
  const activeFilter=document.querySelector('.postos-chip.active')?.dataset.filter||'all';

  function matchFilter(cartao){
    if(activeFilter==='all')return true;
    const c=(cartao||'').toLowerCase();
    if(activeFilter==='truckpag')return c==='truckpag';
    if(activeFilter==='shell')return c.startsWith('shell');
    if(activeFilter==='frota')return c.includes('frota');
    if(activeFilter==='antecipada')return c.includes('antecipada');
    return true;
  }
  function matchQuery(p){
    if(!query)return true;
    return (p.nome||'').toLowerCase().includes(query)||(p.cidade||'').toLowerCase().includes(query);
  }

  const rotaList=extractPostosFromRoutes().filter(p=>matchFilter(p.cartao)&&matchQuery(p));
  const avulsoList=Object.values(postosAvulsos).map(p=>({...p,_source:'avulso'})).filter(p=>matchFilter(p.cartao)&&matchQuery(p));

  let html='';
  if(rotaList.length>0){
    html+=`<div class="postos-section-label">Das rotas</div>`;
    rotaList.forEach(p=>{html+=buildPostoCard(p);});
  }
  if(avulsoList.length>0){
    if(rotaList.length>0)html+=`<div class="postos-divider"></div>`;
    html+=`<div class="postos-section-label">Cadastrados avulsos</div>`;
    avulsoList.forEach(p=>{html+=buildPostoCard(p);});
  }
  if(!rotaList.length&&!avulsoList.length){
    html=`<div class="postos-empty"><i class="ti ti-gas-station" aria-hidden="true"></i><p>Nenhum posto encontrado</p></div>`;
  }

  const el=document.getElementById('postosListContainer');
  if(el)el.innerHTML=html;
  const fab=document.getElementById('postosFab');
  if(fab)fab.style.display=adminMode?'flex':'none';
}

function buildPostoCard(p){
  const cls=getCartaoClass(p.cartao);
  const lbl=getCartaoLabel(p.cartao);
  const maps=p.link?`<a class="postos-maps-btn" href="${p.link}" target="_blank"><i class="ti ti-map-pin" aria-hidden="true"></i> Maps</a>`:'';
  const badge=p._source==='avulso'
    ?`<span class="postos-tag ptag-avulso">Avulso</span>`
    :`<span class="postos-tag ptag-rota">Rota ${p.rotaNumero}</span>`;
  const del=(adminMode&&p._source==='avulso')
    ?`<button class="postos-del-btn" onclick="deletePostoAvulso('${p.id}')" aria-label="Remover posto"><i class="ti ti-trash" aria-hidden="true"></i></button>`:'';
  return `<div class="postos-card">
    <div class="postos-card-top">
      <div><div class="postos-card-name">${p.nome}</div><div class="postos-card-city">${p.cidade}</div></div>
      <div style="display:flex;align-items:center;gap:6px">${del}${maps}</div>
    </div>
    <div class="postos-card-tags">${badge}<span class="postos-tag ${cls}"><i class="ti ti-credit-card" style="font-size:11px" aria-hidden="true"></i> ${lbl}</span></div>
  </div>`;
}

function filterPostos(){renderPostosList();}

function setPostosFilter(el,filter){
  document.querySelectorAll('.postos-chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  renderPostosList();
}

// ─── admin: adicionar posto avulso ───
function showAddPostoForm(){
  document.querySelector('.postos-form-ov')?.remove();
  const ov=document.createElement('div');
  ov.className='postos-form-ov';
  ov.innerHTML=`<div class="postos-form-box">
    <div class="postos-form-title">Novo posto avulso</div>
    <div class="postos-form-field"><label>Nome</label><input id="pfNome" placeholder="Ex: Posto Boa Viagem"></div>
    <div class="postos-form-field"><label>Cidade</label><input id="pfCidade" placeholder="Ex: Goiânia — GO"></div>
    <div class="postos-form-field"><label>Cartão</label>
      <select id="pfCartao">
        <option value="truckpag">TruckPag</option>
        <option value="shell">Shell</option>
        <option value="frota">Rede Frota</option>
        <option value="antecipada">Antecipada</option>
      </select>
    </div>
    <div class="postos-form-field"><label>Link Google Maps</label><input id="pfLink" placeholder="https://maps.app.goo.gl/..."></div>
    <div class="postos-form-err" id="pfError" style="display:none"></div>
    <div class="postos-form-btns">
      <button class="postos-form-cancel" onclick="this.closest('.postos-form-ov').remove()">Cancelar</button>
      <button class="postos-form-save" onclick="savePostoAvulso()">Salvar</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  setTimeout(()=>document.getElementById('pfNome')?.focus(),100);
}

async function savePostoAvulso(){
  const nome=(document.getElementById('pfNome')?.value||'').trim();
  const cidade=(document.getElementById('pfCidade')?.value||'').trim();
  const cartao=document.getElementById('pfCartao')?.value||'truckpag';
  const link=(document.getElementById('pfLink')?.value||'').trim();
  const errEl=document.getElementById('pfError');
  if(!nome||!cidade){errEl.textContent='Nome e cidade são obrigatórios';errEl.style.display='block';return;}
  const id='posto_'+Date.now();
  const posto={id,nome,cidade,cartao,link,criadoEm:Date.now()};
  try{
    if(db)await db.ref('postos/'+id).set(posto);
    else{postosAvulsos[id]={...posto,_source:'avulso'};renderPostosList();}
    document.querySelector('.postos-form-ov')?.remove();
  }catch(e){errEl.textContent='Erro ao salvar. Tente novamente.';errEl.style.display='block';}
}

function deletePostoAvulso(id){
  if(!id)return;
  const ov=document.createElement('div');ov.className='confirm-overlay';
  ov.innerHTML=`<div class="confirm-box"><h3>Remover posto?</h3><p>Esta ação não pode ser desfeita.</p><div class="btns">
    <button style="background:#eae8e3;color:#1c1c1c;flex:1;padding:12px;border-radius:10px;border:none;font-weight:700;cursor:pointer" onclick="this.closest('.confirm-overlay').remove()">Cancelar</button>
    <button id="confirmDelPostoBtn" style="background:#fe2627;color:#fff;flex:1;padding:12px;border-radius:10px;border:none;font-weight:700;cursor:pointer">Remover</button>
  </div></div>`;
  document.body.appendChild(ov);
  document.getElementById('confirmDelPostoBtn').onclick=async()=>{
    if(db)await db.ref('postos/'+id).remove();
    ov.remove();
  };
}
