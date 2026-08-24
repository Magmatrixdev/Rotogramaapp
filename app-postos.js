// ═══ POSTOS ═══
var postosAvulsos={};
var _postosListenerInit=false;
var pfSelectedFiles=[];

// ─── helpers cartão ───
function getCartaoLabel(cartao){
  const m={truckpag:'TruckPag',shell:'Shell',shell_expers:'Shell Experis',frota:'Rede Frota',rede_frota:'Rede Frota',redefrota:'Rede Frota',antecipada:'Antecipada',compra_antecipada:'Antecipada'};
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

// ─── busca fotos de um posto pelo nome (cruza avulsos → rotas) ───
function getFotosByNome(nome){
  if(!nome)return[];
  const norm=s=>(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const n=norm(nome);
  const match=Object.values(postosAvulsos).find(p=>norm(p.nome)===n);
  return(match&&match.fotos&&match.fotos.length>0)?match.fotos:[];
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
  showHome();
}

function bnavGoPostos(){
  const top=_navStack[_navStack.length-1];
  if(top==='screenPostos'){updateBottomNav('Postos');return;}
  if(top!=='screenHome')showHome();
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
  const norm=s=>(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const queryNorm=norm(query);
  function matchQuery(p){
    if(!queryNorm)return true;
    return norm(p.nome).includes(queryNorm)||norm(p.cidade).includes(queryNorm);
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
  const fotos=p._source==='avulso'?(p.fotos||[]):getFotosByNome(p.nome);
  const editBtn=(adminMode&&p._source==='avulso')
    ?`<button class="postos-edit-btn" onclick="showEditPostoFotos('${p.id}')" aria-label="Editar fotos"><i class="ti ti-photo-edit" aria-hidden="true"></i></button>`:'';
  const del=(adminMode&&p._source==='avulso')
    ?`<button class="postos-del-btn" onclick="deletePostoAvulso('${p.id}')" aria-label="Remover posto"><i class="ti ti-trash" aria-hidden="true"></i></button>`:'';
  // hero: primeira foto ou placeholder
  const heroInner=fotos.length>0
    ?`<img class="posto-hero-img" src="${fotos[0]}" loading="lazy" alt="${p.nome}" onclick="showPostoFotoViewer('${fotos[0]}')">`
    :`<i class="ti ti-gas-station posto-hero-ph-icon" aria-hidden="true"></i>`;
  // strip extra: fotos 2 e 3
  const extraStrip=fotos.length>1
    ?`<div class="posto-fotos-strip">${fotos.slice(1).map(url=>`<img class="posto-foto-thumb" src="${url}" onclick="showPostoFotoViewer('${url}')" loading="lazy" alt="Foto do posto">`).join('')}</div>`
    :'';
  return `<div class="postos-card">
    <div class="posto-hero${fotos.length===0?' posto-hero--no-photo':''}">
      ${heroInner}
      <div class="posto-hero-overlay"></div>
      <div class="posto-hero-badge-row">${badge}</div>
      <div class="posto-hero-name">${p.nome}</div>
    </div>
    <div class="posto-card-body">
      <div class="posto-card-body-left">
        <div class="postos-card-city"><i class="ti ti-map-pin" style="font-size:11px" aria-hidden="true"></i> ${p.cidade}</div>
        <div class="postos-card-tags"><span class="postos-tag ${cls}"><i class="ti ti-credit-card" style="font-size:11px" aria-hidden="true"></i> ${lbl}</span></div>
      </div>
      <div class="posto-card-body-right">${editBtn}${del}${maps}</div>
    </div>
    ${extraStrip}
  </div>`;
}

function filterPostos(){renderPostosList();}

function setPostosFilter(el,filter){
  document.querySelectorAll('.postos-chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  renderPostosList();
}

// ─── foto viewer fullscreen ───
function showPostoFotoViewer(url){
  const ov=document.createElement('div');
  ov.className='posto-foto-modal';
  ov.innerHTML=`<img src="${url}" alt="Foto do posto"><button onclick="this.parentElement.remove()" aria-label="Fechar">✕</button>`;
  ov.onclick=e=>{if(e.target===ov)ov.remove();};
  document.body.appendChild(ov);
}

// ─── foto form helpers ───
function pfHandlePhotos(input){
  const files=Array.from(input.files);
  const remaining=3-pfSelectedFiles.length;
  pfSelectedFiles=pfSelectedFiles.concat(files.slice(0,remaining));
  _renderPfPhotoPreviews();
  input.value='';
}

function pfRemovePhoto(i){
  pfSelectedFiles.splice(i,1);
  _renderPfPhotoPreviews();
}

function _renderPfPhotoPreviews(){
  const wrap=document.getElementById('pfPhotosWrap');
  if(!wrap)return;
  wrap.querySelectorAll('.pf-photo-preview').forEach(el=>el.remove());
  pfSelectedFiles.forEach((file,i)=>{
    const url=URL.createObjectURL(file);
    const div=document.createElement('div');
    div.className='pf-photo-preview';
    div.innerHTML=`<img src="${url}" alt="preview"><button class="pf-photo-del" onclick="pfRemovePhoto(${i})" type="button">✕</button>`;
    wrap.insertBefore(div,document.getElementById('pfPhotosAdd'));
  });
  const addBtn=document.getElementById('pfPhotosAdd');
  if(addBtn)addBtn.style.display=pfSelectedFiles.length>=3?'none':'flex';
}

// ─── admin: adicionar posto avulso ───
function showAddPostoForm(){
  pfSelectedFiles=[];
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
    <div class="postos-form-field"><label>Fotos (até 3)</label>
      <div class="pf-photos-wrap" id="pfPhotosWrap">
        <label class="pf-photos-add" id="pfPhotosAdd">
          <i class="ti ti-camera" aria-hidden="true"></i>
          <span>Adicionar</span>
          <input type="file" accept="image/*" multiple style="display:none" onchange="pfHandlePhotos(this)">
        </label>
      </div>
    </div>
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
  const btn=document.querySelector('.postos-form-ov .postos-form-save');
  if(!nome||!cidade){errEl.textContent='Nome e cidade são obrigatórios';errEl.style.display='block';return;}
  const norm=s=>(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const dup=Object.values(postosAvulsos).find(p=>norm(p.nome)===norm(nome)&&norm(p.cidade)===norm(cidade));
  if(dup){errEl.textContent='Posto já cadastrado com esse nome e cidade.';errEl.style.display='block';return;}
  if(btn){btn.disabled=true;btn.textContent='Salvando...';}
  const id='posto_'+Date.now();
  const posto={id,nome,cidade,cartao,link,criadoEm:Date.now()};
  // Upload de fotos
  if(storage&&pfSelectedFiles.length>0){
    if(btn)btn.textContent='Enviando fotos...';
    try{
      const uploads=pfSelectedFiles.map((file,idx)=>{
        const ref=storage.ref('postos/'+id+'/foto_'+(idx+1));
        return ref.put(file).then(snap=>snap.ref.getDownloadURL());
      });
      posto.fotos=await Promise.all(uploads);
    }catch(e){
      errEl.textContent='Erro ao enviar fotos. Tente novamente.';errEl.style.display='block';
      if(btn){btn.disabled=false;btn.textContent='Salvar';}
      return;
    }
  }
  try{
    if(db)await db.ref('postos/'+id).set(posto);
    else{postosAvulsos[id]={...posto,_source:'avulso'};renderPostosList();}
    document.querySelector('.postos-form-ov')?.remove();
  }catch(e){
    errEl.textContent='Erro ao salvar. Tente novamente.';errEl.style.display='block';
    if(btn){btn.disabled=false;btn.textContent='Salvar';}
  }
}

// ─── admin: editar fotos de posto existente ───
function showEditPostoFotos(id){
  const posto=postosAvulsos[id];
  if(!posto)return;
  pfSelectedFiles=[];
  document.querySelector('.postos-form-ov')?.remove();
  const ov=document.createElement('div');
  ov.className='postos-form-ov';
  const fotosAtuais=(posto.fotos||[]);
  const fotosHtml=fotosAtuais.length>0
    ?`<div class="pf-edit-fotos-wrap" id="pfEditFotosWrap">${fotosAtuais.map((url,i)=>`<div class="pf-photo-preview"><img src="${url}" alt="foto"><button class="pf-photo-del" onclick="pfRemoveExistingFoto('${id}',${i})" type="button">✕</button></div>`).join('')}</div>`
    :`<div class="pf-edit-fotos-wrap" id="pfEditFotosWrap"><p style="font-size:12px;color:#9a9894;margin:0">Nenhuma foto ainda</p></div>`;
  ov.innerHTML=`<div class="postos-form-box">
    <div class="postos-form-title">Fotos — ${posto.nome}</div>
    <div class="postos-form-field"><label>Fotos atuais</label>${fotosHtml}</div>
    <div class="postos-form-field" id="pfAddMoreWrap" style="${fotosAtuais.length>=3?'display:none':''}">
      <label>Adicionar fotos</label>
      <div class="pf-photos-wrap" id="pfPhotosWrap">
        <label class="pf-photos-add" id="pfPhotosAdd">
          <i class="ti ti-camera" aria-hidden="true"></i>
          <span>Adicionar</span>
          <input type="file" accept="image/*" multiple style="display:none" onchange="pfHandlePhotosEdit('${id}',this)">
        </label>
      </div>
    </div>
    <div class="postos-form-err" id="pfError" style="display:none"></div>
    <div class="postos-form-btns">
      <button class="postos-form-cancel" onclick="this.closest('.postos-form-ov').remove()">Fechar</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
}

async function pfRemoveExistingFoto(postoId,idx){
  const posto=postosAvulsos[postoId];
  if(!posto||!posto.fotos)return;
  const url=posto.fotos[idx];
  try{
    if(storage)await storage.refFromURL(url).delete().catch(()=>{});
    const newFotos=posto.fotos.filter((_,i)=>i!==idx);
    const update=newFotos.length>0?{...posto,fotos:newFotos}:{...posto};
    if(newFotos.length===0)delete update.fotos;
    await db.ref('postos/'+postoId).set(update);
    showEditPostoFotos(postoId);
  }catch(e){alert('Erro ao remover foto.');}
}

async function pfHandlePhotosEdit(postoId,input){
  const posto=postosAvulsos[postoId];
  if(!posto)return;
  const existentes=(posto.fotos||[]).length;
  const files=Array.from(input.files).slice(0,3-existentes);
  if(!files.length)return;
  const errEl=document.getElementById('pfError');
  const addBtn=document.getElementById('pfPhotosAdd');
  if(addBtn){addBtn.style.display='none';}
  errEl.style.display='none';
  try{
    const uploads=files.map((file,idx)=>{
      const ref=storage.ref('postos/'+postoId+'/foto_'+(existentes+idx+1)+'_'+Date.now());
      return ref.put(file).then(snap=>snap.ref.getDownloadURL());
    });
    const newUrls=await Promise.all(uploads);
    const updFotos=[...(posto.fotos||[]),...newUrls];
    await db.ref('postos/'+postoId+'/fotos').set(updFotos);
    showEditPostoFotos(postoId);
  }catch(e){
    errEl.textContent='Erro ao enviar fotos.';errEl.style.display='block';
    if(addBtn)addBtn.style.display='flex';
  }
  input.value='';
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
