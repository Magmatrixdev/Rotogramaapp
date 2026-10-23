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
        list.push({_id:rota.id+'_'+p.ordem+'_alt',nome:p.alternativa.nome,cidade:p.alternativa.cidade,cartao:p.alternativa.cartao,link:p.alternativa.link||'',rotaNumero:rota.numero,_source:'rota',_alt:true});
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
  // O listener de /postos já é ligado em _attachDataListeners (app-firebase.js).
  // Um segundo listener aqui duplicava o download e os redesenhos da lista.
}
// Só vale redesenhar a lista (e recriar as <img>) com a tela de Postos aberta
function _postosVisivel(){
  return typeof _navStack!=='undefined'&&_navStack[_navStack.length-1]==='screenPostos';
}

// ─── compressão de foto antes do upload ───
// Fotos do celular chegam com 3–8 MB; reduz para no máx. 1600 px em JPEG 80%
// (~150–400 KB). Se algo falhar, envia o arquivo original.
const _FOTO_MAX=1600,_FOTO_Q=0.8;
const _FOTO_META={contentType:'image/jpeg',cacheControl:'public,max-age=31536000'};
function _comprimirFoto(file){
  return new Promise(resolve=>{
    try{
      if(!file||!/^image\//.test(file.type)||/gif|svg/.test(file.type)){resolve(file);return;}
      const url=URL.createObjectURL(file);
      const img=new Image();
      img.onload=()=>{
        try{
          let w=img.naturalWidth,h=img.naturalHeight;
          const k=Math.min(1,_FOTO_MAX/Math.max(w,h));
          w=Math.round(w*k);h=Math.round(h*k);
          const c=document.createElement('canvas');c.width=w;c.height=h;
          const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);
          URL.revokeObjectURL(url);
          c.toBlob(b=>resolve(b&&b.size<file.size?b:file),'image/jpeg',_FOTO_Q);
        }catch(e){URL.revokeObjectURL(url);resolve(file);}
      };
      img.onerror=()=>{URL.revokeObjectURL(url);resolve(file);};
      img.src=url;
    }catch(e){resolve(file);}
  });
}
async function _uploadFoto(ref,file){
  const blob=await _comprimirFoto(file);
  const meta=blob===file?{cacheControl:_FOTO_META.cacheControl}:_FOTO_META;
  const snap=await ref.put(blob,meta);
  return snap.ref.getDownloadURL();
}

// ─── navegação ───
function showPostos(){
  navPush('screenPostos');
  _pstAplicarModo();
  renderPostosList();
  updateBottomNav('Postos');
  // Reseta scroll do container interno para garantir que cards com foto (topo da lista) fiquem visíveis
  const _resetListScroll=()=>{const l=document.querySelector('#screenPostos .pst-main');if(l)l.scrollTop=0;};
  _resetListScroll();
  // Sem re-render de 600 ms: o listener de /postos redesenha sozinho quando os
  // dados chegam e a tela está aberta (evita recriar todas as fotos 2x)
}

// ─── bottom nav ───
function updateBottomNav(active){
  const nav=document.getElementById('bottomNav');
  if(!nav)return;
  if(IS_DESKTOP()){nav.style.display='none';return;}
  nav.style.display='flex';
  if(typeof simSyncNav==='function')simSyncNav();
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
  if(top!=='screenHome'){window._homeInstant=true;try{showHome();}finally{window._homeInstant=false;}}
  showPostos();
}

function hideBottomNav(){
  const nav=document.getElementById('bottomNav');
  if(nav)nav.style.display='none';
}

// ─── render lista (layout modernizado — mockup "Postos — Tela modernizada") ───
var _postosFiltro='all';
var _postoGaleriaCache={};
const _UF_NOMES={AC:'Acre',AL:'Alagoas',AP:'Amapá',AM:'Amazonas',BA:'Bahia',CE:'Ceará',DF:'Distrito Federal',ES:'Espírito Santo',GO:'Goiás',MA:'Maranhão',MT:'Mato Grosso',MS:'Mato Grosso do Sul',MG:'Minas Gerais',PA:'Pará',PB:'Paraíba',PR:'Paraná',PE:'Pernambuco',PI:'Piauí',RJ:'Rio de Janeiro',RN:'Rio Grande do Norte',RS:'Rio Grande do Sul',RO:'Rondônia',RR:'Roraima',SC:'Santa Catarina',SP:'São Paulo',SE:'Sergipe',TO:'Tocantins'};
const _PST_CARTOES={
  truckpag:{label:'TruckPag',dot:'#1f8a3b',fg:'#14662b',bg:'#e6f4ea'},
  shell:{label:'Shell',dot:'#d4241c',fg:'#a3170f',bg:'#fdecea'},
  frota:{label:'Rede Frota',dot:'#6b6a66',fg:'#4a4946',bg:'#f1f0eb'},
  antecipada:{label:'Antecipada',dot:'#c98a00',fg:'#7a5300',bg:'#fef6dc'},
  outro:{label:'Outro',dot:'#9a9894',fg:'#4a4946',bg:'#f1f0eb'}
};
function getCartaoKey(cartao){
  const c=(cartao||'').toLowerCase();
  if(c==='truckpag')return 'truckpag';
  if(c.startsWith('shell'))return 'shell';
  if(c.includes('frota'))return 'frota';
  if(c.includes('antecipada'))return 'antecipada';
  return 'outro';
}
function _pstEsc(s){return String(s==null?'':s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function _pstUF(cidade){
  const m=String(cidade||'').toUpperCase().match(/(?:^|[^A-Z])([A-Z]{2})\s*\.?\s*$/);
  return(m&&_UF_NOMES[m[1]])?m[1]:'';
}

// Junta postos das rotas + avulsos (dedup por nome) — usado pela lista e pelo mapa
function _pstColetar(){
  const norm=s=>(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  // Dedup por NOME — rotas primeiro, avulsos do Firebase sobrescrevem (fotos/dados ricos)
  const dedup={};
  const rotasMap={};
  extractPostosFromRoutes().forEach(p=>{
    const k=norm(p.nome);
    if(!k)return;
    if(!dedup[k])dedup[k]=p;
    const lbl='Rota '+(p.rotaNumero||'?')+(p._alt?' · alternativa':'');
    (rotasMap[k]=rotasMap[k]||[]);
    if(!rotasMap[k].includes(lbl))rotasMap[k].push(lbl);
  });
  Object.values(postosAvulsos).forEach(p=>{
    const k=norm(p.nome);
    if(!k)return;
    dedup[k]={...(dedup[k]||{}),...p,_source:'avulso'};
  });
  Object.keys(dedup).forEach(k=>{
    const entry=dedup[k];
    if(entry._source==='rota'&&(!Array.isArray(entry.fotos)||!entry.fotos.filter(Boolean).length)){
      const fotos=getFotosByNome(entry.nome);
      if(fotos.length>0)dedup[k]={...entry,fotos};
    }
    dedup[k]._key=k;
    dedup[k]._rotas=rotasMap[k]||[];
    dedup[k]._uf=_pstUF(dedup[k].cidade);
    const f=Array.isArray(dedup[k].fotos)?dedup[k].fotos.filter(Boolean):[];
    dedup[k]._fotos=f;
  });
  return Object.values(dedup);
}

function renderPostosList(){
  const norm=s=>(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  const queryNorm=norm((document.getElementById('postosSearch')?.value||'').trim());
  const filtro=_postosFiltro;
  const todos=_pstColetar();
  const porBusca=todos.filter(p=>!queryNorm||norm(p.nome).includes(queryNorm)||norm(p.cidade).includes(queryNorm)||norm(p._uf).includes(queryNorm)||norm(_UF_NOMES[p._uf]).includes(queryNorm));
  const visiveis=porBusca.filter(p=>filtro==='all'||getCartaoKey(p.cartao)===filtro);

  // ── stats do topo (lista completa) ──
  const stats=document.getElementById('postosStats');
  if(stats){
    const ufs=new Set(todos.map(p=>p._uf).filter(Boolean)).size;
    const comFoto=todos.filter(p=>p._fotos.length>0).length;
    const st=(n,l)=>`<div class="pst-stat"><div class="pst-stat-n">${n}</div><div class="pst-stat-l">${l}</div></div>`;
    stats.innerHTML=st(todos.length,'POSTOS')+st(ufs,'ESTADOS')+st(comFoto,'COM FOTO');
  }

  // ── chips de cartão (contagem respeita a busca) ──
  const chipsEl=document.getElementById('postosFilters');
  if(chipsEl){
    const _emMapa=_pstModo==='mapa';
    const defs=[{id:'all',label:'Todos',dot:'#1c1c1c'}].concat(['truckpag','shell','frota','antecipada'].map(id=>({id,label:_PST_CARTOES[id].label,dot:_emMapa?_PST_PINO[id]:_PST_CARTOES[id].dot})));
    chipsEl.innerHTML=defs.map(c=>{
      const n=porBusca.filter(p=>c.id==='all'||getCartaoKey(p.cartao)===c.id).length;
      const on=c.id===filtro;
      return `<button class="postos-chip pst-chip${on?' active':''}" data-filter="${c.id}" onclick="setPostosFilter(this,'${c.id}')"><span class="pst-chip-dot" style="background:${on&&c.id==='all'?'#fff':c.dot}"></span>${c.label}<span class="pst-chip-n">${n}</span></button>`;
    }).join('');
  }

  // ── modo mapa: desenha os pinos e não monta a lista (evita carregar fotos à toa) ──
  if(_pstModo==='mapa'){
    const el0=document.getElementById('postosListContainer');if(el0)el0.innerHTML='';
    _pstMapaDesenhar(visiveis,todos);
    return;
  }

  // ── agrupa por estado ──
  const grupos={};
  visiveis.forEach(p=>{const uf=p._uf||'__';(grupos[uf]=grupos[uf]||[]).push(p);});
  const ordemUF=Object.keys(grupos).sort((a,b)=>{
    if(a==='__')return 1;if(b==='__')return -1;
    return _UF_NOMES[a].localeCompare(_UF_NOMES[b],'pt');
  });

  _postoGaleriaCache={};
  let html='';
  if(adminMode){
    html+=`<div class="pst-admin-bar"><div class="pst-sec-label">GERENCIAR POSTOS</div><button class="pst-add" onclick="showAddPostoForm()"><i class="ti ti-plus" aria-hidden="true"></i><span>Adicionar posto</span></button></div>`;
  }
  if(visiveis.length===0){
    const msg=filtro!=='all'&&porBusca.length>0?'Nenhum posto nesse cartão':'Nenhum posto encontrado';
    const sub=filtro!=='all'?'Toque em “Todos” para ver a lista completa.':'Tente buscar por outro nome, cidade ou UF.';
    html+=`<div class="pst-empty"><i class="ti ti-gas-station" aria-hidden="true"></i><div class="pst-empty-t">${msg}</div><div class="pst-empty-s">${sub}</div></div>`;
  } else {
    ordemUF.forEach(uf=>{
      const itens=grupos[uf].sort((a,b)=>{
        const af=a._fotos.length>0,bf=b._fotos.length>0;
        if(af&&!bf)return -1;if(!af&&bf)return 1;
        return(a.nome||'').localeCompare(b.nome||'','pt');
      });
      const titulo=uf==='__'?'OUTROS':(_UF_NOMES[uf].toUpperCase()+' · '+uf);
      html+=`<section class="pst-group"><div class="pst-group-head"><div class="pst-sec-label">${titulo}</div><div class="pst-group-line"></div><div class="pst-group-n">${itens.length}</div></div><div class="pst-group-list">${itens.map(buildPostoCard).join('')}</div></section>`;
    });
  }

  const el=document.getElementById('postosListContainer');
  if(el)el.innerHTML=html;
}

function buildPostoCard(p){
  const ck=getCartaoKey(p.cartao);
  const cc=_PST_CARTOES[ck];
  const lbl=ck==='outro'?getCartaoLabel(p.cartao):cc.label;
  const fotos=(p._fotos&&p._fotos.length)?p._fotos:getFotosByNome(p.nome).filter(Boolean);
  const gk='g'+Object.keys(_postoGaleriaCache).length;
  if(fotos.length)_postoGaleriaCache[gk]=fotos;
  const _nEnc=encodeURIComponent(p.nome||'');const _cEnc=encodeURIComponent(p.cidade||'');
  const pill=`<span class="pst-pill" style="background:${cc.bg};color:${cc.fg}"><span class="pst-pill-dot" style="background:${cc.dot}"></span>${_pstEsc(lbl)}</span>`;

  const foto=fotos.length
    ?`<div class="pst-photo">
        <img src="${_pstEsc(fotos[0])}" loading="lazy" decoding="async" alt="${_pstEsc(p.nome)}" onclick="showPostoGaleria('${gk}',0)">
        <span class="pst-pill pst-pill--onphoto" style="color:${cc.fg}"><span class="pst-pill-dot" style="background:${cc.dot}"></span>${_pstEsc(lbl)}</span>
        <button class="pst-fotos-btn" onclick="showPostoGaleria('${gk}',0)" aria-label="Ver fotos"><i class="ti ti-camera" aria-hidden="true"></i>${fotos.length===1?'1 foto':fotos.length+' fotos'}</button>
      </div>`:'';

  const rotas=(p._rotas||[]).length
    ?`<div class="pst-rotas"><span class="pst-rotas-l">Nas rotas</span>${p._rotas.map(r=>`<span class="pst-rota">${_pstEsc(r)}</span>`).join('')}</div>`:'';

  const go=p.link
    ?`<a class="pst-go" href="${_pstEsc(p.link)}" target="_blank" rel="noopener"><i class="ti ti-navigation" aria-hidden="true"></i>Como chegar</a>`
    :`<div class="pst-go pst-go--off"><i class="ti ti-map-pin-off" aria-hidden="true"></i>Sem localização</div>`;

  let adm='';
  if(adminMode){
    adm+=`<button class="pst-ico" onclick="showEditPostoUnified('${_nEnc}','${_cEnc}')" aria-label="Editar dados do posto"><i class="ti ti-pencil" aria-hidden="true"></i></button>`;
    adm+=`<button class="pst-ico" onclick="editPostoFotosByKey('${_nEnc}','${_cEnc}')" aria-label="Editar fotos do posto"><i class="ti ti-photo-edit" aria-hidden="true"></i></button>`;
    if(p._source==='avulso'&&p.id)adm+=`<button class="pst-ico pst-ico--del" onclick="deletePostoAvulso('${p.id}')" aria-label="Remover posto"><i class="ti ti-trash" aria-hidden="true"></i></button>`;
  }

  return `<article class="pst-card">
    ${foto}
    <div class="pst-head">
      ${fotos.length?'':`<div class="pst-pump"><i class="ti ti-gas-station" aria-hidden="true"></i></div>`}
      <div class="pst-head-txt">
        <h2 class="pst-name">${_pstEsc(p.nome)}</h2>
        <div class="pst-city"><i class="ti ti-map-pin" aria-hidden="true"></i>${_pstEsc(p.cidade||'—')}</div>
      </div>
      ${fotos.length?'':pill}
    </div>
    ${rotas}
    ${typeof simPrecoPostoHTML==='function'?simPrecoPostoHTML(p.nome):''}
    <div class="pst-actions">${go}${adm}</div>
  </article>`;
}

function filterPostos(){renderPostosList();}

function setPostosFilter(el,filter){
  _postosFiltro=filter||'all';
  renderPostosList();
}

// ─── galeria de fotos (desliza entre as fotos do posto) ───
function showPostoGaleria(gk,idx){
  const fotos=_postoGaleriaCache[gk]||[];
  if(!fotos.length)return;
  if(fotos.length===1){showPostoFotoViewer(fotos[0]);return;}
  document.querySelector('.posto-foto-modal')?.remove();
  const ov=document.createElement('div');
  ov.className='posto-foto-modal pst-gal';
  ov.innerHTML=`<div class="pst-gal-track">${fotos.map(u=>`<div class="pst-gal-slide"><img src="${_pstEsc(u)}" alt="Foto do posto"></div>`).join('')}</div>
    <div class="pst-gal-count"><span id="pstGalN">${(idx||0)+1}</span> / ${fotos.length}</div>
    <button class="pst-gal-close" aria-label="Fechar"><i class="ti ti-x" aria-hidden="true"></i></button>
    <button class="pst-gal-nav pst-gal-prev" aria-label="Foto anterior"><i class="ti ti-chevron-left" aria-hidden="true"></i></button>
    <button class="pst-gal-nav pst-gal-next" aria-label="Próxima foto"><i class="ti ti-chevron-right" aria-hidden="true"></i></button>`;
  // web: setas e teclado (← → Esc) para navegar sem arrastar
  const onKey=e=>{if(e.key==='Escape')close();else if(e.key==='ArrowLeft')go(-1);else if(e.key==='ArrowRight')go(1);};
  const close=()=>{ov.remove();document.removeEventListener('keydown',onKey);};
  ov.querySelector('.pst-gal-close').onclick=close;
  ov.addEventListener('click',e=>{if(e.target===ov||e.target.classList.contains('pst-gal-slide'))close();});
  document.body.appendChild(ov);
  const tr=ov.querySelector('.pst-gal-track');
  const cur=()=>Math.round(tr.scrollLeft/tr.clientWidth);
  const go=d=>{const i=Math.max(0,Math.min(fotos.length-1,cur()+d));tr.scrollTo({left:i*tr.clientWidth,behavior:'smooth'});};
  ov.querySelector('.pst-gal-prev').onclick=()=>go(-1);
  ov.querySelector('.pst-gal-next').onclick=()=>go(1);
  document.addEventListener('keydown',onKey);
  tr.scrollLeft=(idx||0)*tr.clientWidth;
  tr.addEventListener('scroll',()=>{const n=ov.querySelector('#pstGalN');if(n)n.textContent=cur()+1;},{passive:true});
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
  // Checa duplicata por nome apenas (consistente com dedup do frontend)
  const dup=Object.values(postosAvulsos).find(p=>norm(p.nome)===norm(nome));
  if(dup){errEl.textContent='Já existe um posto com este nome ('+dup.cidade+').';errEl.style.display='block';return;}
  if(btn){btn.disabled=true;btn.textContent='Salvando...';}
  const id='posto_'+Date.now();
  const posto={id,nome,cidade,cartao,link,criadoEm:Date.now()};
  // Upload de fotos
  if(storage&&pfSelectedFiles.length>0){
    if(btn)btn.textContent='Enviando fotos...';
    try{
      const uploads=pfSelectedFiles.map((file,idx)=>{
        const ref=storage.ref('postos/'+id+'/foto_'+(idx+1));
        return _uploadFoto(ref,file);
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
    if(typeof geoAtualizarPosto==='function')geoAtualizarPosto(nome,link);
  }catch(e){
    errEl.textContent='Erro ao salvar. Tente novamente.';errEl.style.display='block';
    if(btn){btn.disabled=false;btn.textContent='Salvar';}
  }
}

// ─── admin: editar fotos por nome/cidade (rotas + avulsos) ───
async function editPostoFotosByKey(nomeEnc,cidadeEnc){
  const nome=decodeURIComponent(nomeEnc);
  const cidade=decodeURIComponent(cidadeEnc);
  const normFn=s=>(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const n=normFn(nome),c=normFn(cidade);
  let id=Object.entries(postosAvulsos).find(([,v])=>normFn(v.nome)===n&&normFn(v.cidade)===c)?.[0];
  if(!id){
    id='posto_'+Date.now();
    const fromRoute=extractPostosFromRoutes().find(p=>normFn(p.nome)===n&&normFn(p.cidade)===c);
    const newEntry={id,nome,cidade,cartao:fromRoute?.cartao||'truckpag',link:fromRoute?.link||'',criadoEm:Date.now()};
    if(db)await db.ref('postos/'+id).set(newEntry);
    postosAvulsos[id]=newEntry;
  }
  showEditPostoFotos(id);
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
      return _uploadFoto(ref,file);
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

// ═══════════════════════════════════════════════════════════════
// MAPA DE POSTOS (mockup "Mapa de Postos" + prévia aprovada)
// Leaflet + fundo Esri World Street Map (sem chave). Carregado só quando
// alguém abre o mapa, para não pesar no app de quem nunca usa.
// Coordenadas, por ordem: definida à mão (/postosGeo, fonte manual) →
// tirada do link longo do Maps → resolvida pela Cloud Function
// resolverLinkMaps (link curto, gravada em /postosGeo).
// ═══════════════════════════════════════════════════════════════
var _pstModo=(function(){try{return localStorage.getItem('rotograma_postos_modo')==='mapa'?'mapa':'lista';}catch(e){return 'lista';}})();
const _PST_PINO={truckpag:'#3B82F6',shell:'#F59E0B',frota:'#14B8A6',antecipada:'#8B5CF6',outro:'#71717A'};
const _PST_NOVO_MS=24*60*60*1000;
var _postosGeo={};
var _postosGeoArq={},_pstArqOn=false; // postos-geo.json: coordenadas já lidas, reserva até a função estar publicada
var _pstGeoOn=false,_pstGeoNegado=false;
var _pstMapa=null,_pstCluster=null,_pstCamada=null,_pstFundoIdx=0,_pstEu=null;
var _pstMapaPontos=[],_pstMapaSem=[],_pstSel=null,_pstVistos=null;
var _pstLeafletP=null,_pstAjustou=false;
var _pstResolvendo={},_pstFnIndisponivel=false;

function _geoKey(nome){
  return String(nome||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()
    .replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,120)||'sem_nome';
}
function _geoOk(lat,lng){
  return isFinite(lat)&&isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180&&!(lat===0&&lng===0);
}
// Extrai lat/lng de link longo do Google Maps ou de "lat, lng" digitado
function _geoParse(txt){
  let s=String(txt||'').trim();
  if(!s)return null;
  try{s=decodeURIComponent(s);}catch(e){}
  const N='(-?\\d{1,3}(?:\\.\\d+)?)';
  const pats=[
    new RegExp('!3d'+N+'!4d'+N),
    new RegExp('[?&](?:q|query|ll|sll|destination|daddr|center)=(?:loc:)?'+N+'\\s*,\\s*'+N),
    new RegExp('/place/'+N+'\\s*,\\s*'+N),
    new RegExp('@'+N+','+N+',(\\d+(?:\\.\\d+)?)(z|m)'),
    new RegExp('^'+N+'\\s*[,;]\\s*'+N+'$')
  ];
  const busca=/\/maps\/search\//i.test(s); // link de pesquisa: "@" é só o centro da tela
  for(const re of pats){
    if(busca&&re.source.startsWith('@'))continue;
    const m=s.match(re);
    if(m){
      // "@lat,lng,8z" é só a vista do mapa (link sem lugar marcado) — vale apenas com zoom de rua
      if(m[4]&&(m[4]==='z'?parseFloat(m[3])<14:parseFloat(m[3])>3000))continue;
      const lat=parseFloat(m[1]),lng=parseFloat(m[2]);if(_geoOk(lat,lng))return{lat,lng};
    }
  }
  return null;
}
function _geoLinkCurto(link){
  return /^https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl|g\.co)\//i.test(String(link||'').trim());
}
// Coordenada de um posto (ou null) — veja a ordem no topo da seção
function _pstCoord(p){
  const k=_geoKey(p.nome),g=_postosGeo[k],a=_postosGeoArq[k];
  const ok=x=>x&&!x.falhou&&_geoOk(x.lat,x.lng);
  if(ok(g)&&g.fonte==='manual')return{lat:g.lat,lng:g.lng};
  const c=_geoParse(p.link);
  if(c)return c;
  if(ok(g))return{lat:g.lat,lng:g.lng};
  if(ok(a)&&(!a.link||a.link===p.link))return{lat:a.lat,lng:a.lng};
  return null;
}
function _pstEhNovo(p){
  const t=p.criadoEm||p.createdAt;
  return typeof t==='number'&&Date.now()-t<_PST_NOVO_MS;
}

// ─── alternância Lista | Mapa ───
function setPostosModo(modo){
  _pstModo=modo==='mapa'?'mapa':'lista';
  try{localStorage.setItem('rotograma_postos_modo',_pstModo);}catch(e){}
  _pstAplicarModo();
  renderPostosList();
}
function _pstAplicarModo(){
  const scr=document.getElementById('screenPostos');
  if(scr)scr.classList.toggle('pst-modo-mapa',_pstModo==='mapa');
  const wrap=document.getElementById('postosMapWrap');
  if(wrap)wrap.hidden=_pstModo!=='mapa';
  document.querySelectorAll('#screenPostos .pst-view-btn').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.modo===_pstModo)));
  if(_pstModo==='mapa'){
    _pstGeoListener();
    if(_pstMapa)setTimeout(()=>_pstMapa&&_pstMapa.invalidateSize(),60);
  }
}

// ─── /postosGeo (lido só quando o mapa é aberto) ───
function _pstGeoListener(){
  if(!_pstArqOn){
    _pstArqOn=true;
    fetch('postos-geo.json?v='+(typeof APP_VERSION!=='undefined'?APP_VERSION:0)).then(r=>r.ok?r.json():{}).then(j=>{
      _postosGeoArq=j||{};
      if(_pstModo==='mapa'&&_postosVisivel())renderPostosList();
    }).catch(()=>{_pstArqOn=false;});
  }
  if(_pstGeoOn||typeof db==='undefined'||!db)return;
  _pstGeoOn=true;
  db.ref('postosGeo').on('value',snap=>{
    _postosGeo=snap.val()||{};_pstGeoNegado=false;
    if(_pstModo==='mapa'&&_postosVisivel())renderPostosList();
  },err=>{
    console.warn('postosGeo listener:',err&&err.code);
    _pstGeoOn=false;_pstGeoNegado=true;_postosGeo={};
    if(_pstModo==='mapa'&&_postosVisivel())renderPostosList();
  });
}

// ─── Leaflet sob demanda (cdnjs) ───
function _pstCarregarLeaflet(){
  if(window.L&&L.markerClusterGroup)return Promise.resolve();
  if(_pstLeafletP)return _pstLeafletP;
  const CDN='https://cdnjs.cloudflare.com/ajax/libs/';
  const add=(tag,attrs)=>new Promise((res,rej)=>{const e=document.createElement(tag);Object.assign(e,attrs);e.onload=res;e.onerror=()=>rej(new Error('falha ao carregar '+(attrs.src||attrs.href)));document.head.appendChild(e);});
  add('link',{rel:'stylesheet',href:CDN+'leaflet/1.9.4/leaflet.min.css'}).catch(()=>{});
  add('link',{rel:'stylesheet',href:CDN+'leaflet.markercluster/1.5.3/MarkerCluster.min.css'}).catch(()=>{});
  _pstLeafletP=add('script',{src:CDN+'leaflet/1.9.4/leaflet.min.js'})
    .then(()=>add('script',{src:CDN+'leaflet.markercluster/1.5.3/leaflet.markercluster.min.js'}))
    .catch(e=>{_pstLeafletP=null;throw e;});
  return _pstLeafletP;
}

// Fundos de mapa sem chave: Esri; se falhar, OpenStreetMap
const _PST_FUNDOS=[
  {url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',opt:{maxZoom:19,attribution:'&copy; Esri, OpenStreetMap'}},
  {url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',opt:{maxZoom:19,attribution:'&copy; OpenStreetMap'}}
];
function _pstUsarFundo(i){
  if(_pstCamada)_pstMapa.removeLayer(_pstCamada);
  let erros=0,carregou=false;
  _pstCamada=L.tileLayer(_PST_FUNDOS[i].url,_PST_FUNDOS[i].opt);
  _pstCamada.on('tileload',()=>{carregou=true;});
  _pstCamada.on('tileerror',()=>{if(!carregou&&++erros>=4&&i<_PST_FUNDOS.length-1)_pstUsarFundo(_pstFundoIdx=i+1);});
  _pstCamada.addTo(_pstMapa);
}

function _pstCriarMapa(){
  const el=document.getElementById('postosMap');
  if(!el||_pstMapa)return;
  const web=typeof IS_DESKTOP==='function'&&IS_DESKTOP();
  _pstMapa=L.map(el,{zoomControl:false,attributionControl:true,worldCopyJump:true}).setView([-16.7,-49.3],6);
  _pstMapa.attributionControl.setPrefix(false);
  if(web)L.control.zoom({position:'topright'}).addTo(_pstMapa);
  _pstUsarFundo(0);
  _pstCluster=L.markerClusterGroup({showCoverageOnHover:false,maxClusterRadius:45,spiderfyOnMaxZoom:true,
    iconCreateFunction:c=>{const n=c.getChildCount();const sz=n<10?34:n<100?40:46;
      return L.divIcon({className:'pst-clu',html:'<div style="width:'+sz+'px;height:'+sz+'px">'+n+'</div>',iconSize:[sz+6,sz+6]});}});
  _pstMapa.addLayer(_pstCluster);
  _pstMapa.on('moveend',_pstListaLateral);
  _pstMapa.on('click',()=>_pstFecharFicha());
  if(window.ResizeObserver)new ResizeObserver(()=>_pstMapa&&_pstMapa.invalidateSize()).observe(el);
}

function _pstIcone(p){
  const cor=_PST_PINO[getCartaoKey(p.cartao)];
  if(_pstSel===p._gk){
    return L.divIcon({className:'pst-pin-sel',iconSize:[34,42],iconAnchor:[17,41],
      html:'<span class="pst-pin-lbl">'+_pstEsc(p.nome)+'</span><svg width="34" height="42" viewBox="0 0 34 42" aria-hidden="true"><path d="M17 41C17 41 32 25.5 32 16A15 15 0 0 0 2 16C2 25.5 17 41 17 41Z" fill="#DC2626" stroke="#fff" stroke-width="3"/><circle cx="17" cy="16" r="5.5" fill="#fff"/></svg>'});
  }
  if(_pstEhNovo(p))return L.divIcon({className:'',iconSize:[24,24],iconAnchor:[12,12],html:'<div class="pst-pin-novo"><span class="p"></span><span class="c"></span></div>'});
  return L.divIcon({className:'',iconSize:[20,20],iconAnchor:[10,10],html:'<div class="pst-pin" style="background:'+cor+'"></div>'});
}

// Chamado por renderPostosList no modo mapa
function _pstMapaDesenhar(visiveis,todos){
  const wrap=document.getElementById('postosMapWrap');
  if(!wrap)return;
  _pstAplicarModo();
  _pstGeoListener();
  // separa quem tem coordenada
  _pstMapaPontos=[];_pstMapaSem=[];
  visiveis.forEach(p=>{const c=_pstCoord(p);if(c)_pstMapaPontos.push({...p,_gk:_geoKey(p.nome),_lat:c.lat,_lng:c.lng});else _pstMapaSem.push(p);});
  const semTotal=todos.filter(p=>!_pstCoord(p));
  _pstAvisoSem(semTotal);
  if(adminMode)_pstAutoResolver(todos);

  const msg=document.getElementById('postosMapMsg');
  if(!window.L||!L.markerClusterGroup){
    if(msg){msg.hidden=false;msg.innerHTML='<i class="ti ti-loader-2 pst-spin" aria-hidden="true"></i><span>Carregando mapa…</span>';}
    _pstCarregarLeaflet().then(()=>{if(msg)msg.hidden=true;if(_pstModo==='mapa')renderPostosList();})
      .catch(()=>{if(msg){msg.hidden=false;msg.innerHTML='<i class="ti ti-wifi-off" aria-hidden="true"></i><span>O mapa precisa de internet para carregar. Tente de novo quando tiver sinal.</span><button type="button" onclick="renderPostosList()">Tentar de novo</button>';}});
    return;
  }
  if(msg)msg.hidden=true;
  _pstCriarMapa();
  if(!_pstMapa)return;
  setTimeout(()=>_pstMapa&&_pstMapa.invalidateSize(),30);

  // postos que surgiram com o mapa aberto: pino verde + aviso + voo até ele
  const chaves=new Set(todos.map(p=>p._key));
  let chegou=null;
  if(_pstVistos){
    // só conta como "chegou agora" cadastro dos últimos 10 min (evita falso aviso quando os dados terminam de baixar)
    todos.forEach(p=>{const t=p.criadoEm||p.createdAt;if(!_pstVistos.has(p._key)&&typeof t==='number'&&Date.now()-t<600000){const c=_pstCoord(p);if(c&&!chegou)chegou={...p,_lat:c.lat,_lng:c.lng};}});
  }
  _pstVistos=chaves;

  _pstCluster.clearLayers();
  const mk=_pstMapaPontos.map(p=>{
    const m=L.marker([p._lat,p._lng],{icon:_pstIcone(p),title:p.nome,keyboard:true,zIndexOffset:_pstSel===p._gk?1000:0});
    m.on('click',ev=>{L.DomEvent.stopPropagation(ev);_pstSelecionar(p._gk,false);});
    return m;
  });
  _pstCluster.addLayers(mk);

  const sel=_pstMapaPontos.find(p=>p._gk===_pstSel);
  if(sel)_pstFicha(sel);else{_pstSel=null;_pstEsconderFicha();}

  if(!_pstAjustou&&_pstMapaPontos.length){_pstAjustou=true;_pstVerTodos(false);}
  if(chegou){
    _pstMapa.flyTo([chegou._lat,chegou._lng],Math.max(_pstMapa.getZoom(),10),{duration:1.1});
    _pstToast('Posto novo no mapa',chegou.nome+' · '+(chegou.cidade||'')+' — adicionado agora');
  }
  _pstListaLateral();
}

function _pstVerTodos(animar){
  if(!_pstMapa)return;
  const pts=_pstMapaPontos.map(p=>[p._lat,p._lng]);
  if(!pts.length)return;
  if(pts.length===1)_pstMapa.setView(pts[0],12,{animate:animar!==false});
  else _pstMapa.fitBounds(L.latLngBounds(pts).pad(0.08),{animate:animar!==false,maxZoom:13});
}
function _pstMinhaLocal(){
  if(!navigator.geolocation){if(typeof showToast==='function')showToast('Localização indisponível neste aparelho');return;}
  navigator.geolocation.getCurrentPosition(pos=>{
    const ll=[pos.coords.latitude,pos.coords.longitude];
    if(!_pstMapa)return;
    if(_pstEu)_pstMapa.removeLayer(_pstEu);
    _pstEu=L.marker(ll,{icon:L.divIcon({className:'',iconSize:[18,18],iconAnchor:[9,9],html:'<div class="pst-eu"></div>'}),interactive:false}).addTo(_pstMapa);
    _pstMapa.flyTo(ll,Math.max(_pstMapa.getZoom(),11),{duration:.9});
  },()=>{if(typeof showToast==='function')showToast('Não foi possível pegar sua localização','#5a5856');},{enableHighAccuracy:true,timeout:10000,maximumAge:60000});
}

function _pstSelecionar(key,voar){
  _pstSel=key;
  const p=_pstMapaPontos.find(x=>x._gk===key);
  if(!p)return;
  // redesenha só os ícones (sem refazer a lista)
  _pstCluster.eachLayer(m=>{const q=_pstMapaPontos.find(x=>x.nome===m.options.title);if(q){m.setIcon(_pstIcone(q));m.setZIndexOffset(q._gk===key?1000:0);}});
  if(voar){
    const m=_pstCluster.getLayers().find(x=>x.options.title===p.nome);
    if(m)_pstCluster.zoomToShowLayer(m,()=>{});else _pstMapa.flyTo([p._lat,p._lng],Math.max(_pstMapa.getZoom(),12));
  }
  _pstFicha(p);
  _pstListaLateral();
  // celular: se o pino ficou atrás da ficha, sobe o mapa
  if(!voar&&!(typeof IS_DESKTOP==='function'&&IS_DESKTOP())){
    const sh=document.getElementById('postosMapSheet'),hMap=_pstMapa.getSize().y,hSh=sh?sh.offsetHeight:0;
    const pt=_pstMapa.latLngToContainerPoint([p._lat,p._lng]);
    const livre=hMap-hSh;
    if(pt.y>livre-40||pt.y<40)_pstMapa.panBy([0,pt.y-livre/2],{animate:true});
  }
}

function _pstFicha(p){
  const box=document.getElementById('postosMapSheet');
  if(!box)return;
  const ck=getCartaoKey(p.cartao),cc=_PST_CARTOES[ck];
  const lbl=ck==='outro'?getCartaoLabel(p.cartao):cc.label;
  const fotos=(p._fotos&&p._fotos.length)?p._fotos:getFotosByNome(p.nome).filter(Boolean);
  const gk='m'+_geoKey(p.nome);
  if(fotos.length)_postoGaleriaCache[gk]=fotos;
  const nEnc=encodeURIComponent(p.nome||''),cEnc=encodeURIComponent(p.cidade||'');
  const href=p.link||('https://www.google.com/maps/dir/?api=1&destination='+p._lat+','+p._lng);
  const rotas=(p._rotas||[]);
  const thumb=fotos.length
    ?'<img class="pst-ms-foto" src="'+_pstEsc(fotos[0])+'" alt="'+_pstEsc(p.nome)+'" loading="lazy" onclick="showPostoGaleria(\''+gk+'\',0)">'
    :'<div class="pst-ms-foto pst-ms-foto--off"><i class="ti ti-gas-station" aria-hidden="true"></i></div>';
  box.innerHTML='<span class="pst-ms-alca" aria-hidden="true"></span>'
    +'<button type="button" class="pst-ms-x" onclick="_pstFecharFicha()" aria-label="Fechar"><i class="ti ti-x" aria-hidden="true"></i></button>'
    +'<div class="pst-ms-top">'+thumb+'<div class="pst-ms-txt">'
      +'<div class="pst-ms-nome">'+_pstEsc(p.nome)+'</div>'
      +'<div class="pst-ms-loc"><i class="ti ti-map-pin" aria-hidden="true"></i>'+_pstEsc(p.cidade||'—')+'</div>'
      +'<div class="pst-ms-tags"><span class="pst-pill" style="background:'+cc.bg+';color:'+cc.fg+'"><span class="pst-pill-dot" style="background:'+_PST_PINO[ck]+'"></span>'+_pstEsc(lbl)+'</span>'
      +(rotas.length?'<span class="pst-ms-tag">Em '+rotas.length+(rotas.length===1?' rota':' rotas')+'</span>':'')
      +(_pstEhNovo(p)?'<span class="pst-ms-tag pst-ms-tag--novo">NOVO</span>':'')+'</div>'
    +'</div></div>'
    +(rotas.length?'<div class="pst-ms-rotas"><b>Nas rotas:</b> '+rotas.map(_pstEsc).join(', ')+'</div>':'')
    +(typeof simPrecoPostoHTML==='function'?simPrecoPostoHTML(p.nome):'')
    +'<div class="pst-ms-acoes"><a class="pst-go" href="'+_pstEsc(href)+'" target="_blank" rel="noopener"><i class="ti ti-navigation" aria-hidden="true"></i>Como chegar</a>'
    +(adminMode
      ?'<button type="button" class="pst-ms-sec" onclick="showEditPostoUnified(\''+nEnc+'\',\''+cEnc+'\')"><i class="ti ti-pencil" aria-hidden="true"></i>Editar</button>'
      :'<button type="button" class="pst-ms-sec" onclick="_pstVerNaLista(\''+nEnc+'\')"><i class="ti ti-list" aria-hidden="true"></i>Ver detalhes</button>')
    +'</div>';
  box.hidden=false;
  document.getElementById('postosMapWrap')?.classList.add('pst-com-ficha');
}
function _pstEsconderFicha(){
  const box=document.getElementById('postosMapSheet');
  if(box)box.hidden=true;
  document.getElementById('postosMapWrap')?.classList.remove('pst-com-ficha');
}
function _pstFecharFicha(){
  _pstEsconderFicha();
  if(!_pstSel)return;
  const k=_pstSel;_pstSel=null;
  if(_pstCluster)_pstCluster.eachLayer(m=>{const q=_pstMapaPontos.find(x=>x.nome===m.options.title);if(q&&q._gk===k){m.setIcon(_pstIcone(q));m.setZIndexOffset(0);}});
  _pstListaLateral();
}
function _pstVerNaLista(nEnc){
  const s=document.getElementById('postosSearch');
  if(s)s.value=decodeURIComponent(nEnc);
  _pstSel=null;
  setPostosModo('lista');
}

// Lista lateral da versão web: postos na área visível do mapa
function _pstListaLateral(){
  const side=document.getElementById('postosMapSide');
  if(!side||!_pstMapa)return;
  const web=typeof IS_DESKTOP==='function'&&IS_DESKTOP();
  if(!web){side.innerHTML='';return;}
  const b=_pstMapa.getBounds();
  const vis=_pstMapaPontos.filter(p=>b.contains([p._lat,p._lng]))
    .sort((a,c)=>(_pstEhNovo(c)-_pstEhNovo(a))||(a.nome||'').localeCompare(c.nome||'','pt'));
  const itens=vis.slice(0,200).map(p=>{
    const ck=getCartaoKey(p.cartao),novo=_pstEhNovo(p);
    const lbl=ck==='outro'?getCartaoLabel(p.cartao):_PST_CARTOES[ck].label;
    const r=(p._rotas||[]).length;
    return '<button type="button" class="pst-side-it'+(p._gk===_pstSel?' sel':'')+(novo?' novo':'')+'" onclick="_pstSelecionar(\''+p._gk+'\',true)">'
      +'<span class="pst-side-dot" style="background:'+(novo?'#16A34A':_PST_PINO[ck])+'"></span>'
      +'<span class="pst-side-txt"><span class="pst-side-nome">'+_pstEsc(p.nome)+(novo?' <em>NOVO</em>':'')+'</span>'
      +'<span class="pst-side-sub">'+_pstEsc(p.cidade||'—')+' · '+_pstEsc(lbl)+(r?' · em '+r+(r===1?' rota':' rotas'):'')+'</span></span></button>';
  }).join('');
  side.innerHTML='<div class="pst-side-head">NA ÁREA VISÍVEL · '+vis.length+'</div>'
    +(itens||'<div class="pst-side-vazio">Nenhum posto nesta parte do mapa. Afaste o zoom ou use “Ver todos”.</div>')
    +(vis.length>200?'<div class="pst-side-vazio">Mostrando 200 de '+vis.length+'. Aproxime o mapa para ver o resto.</div>':'')
    +(adminMode&&_pstSemCache.length?'<button type="button" class="pst-side-sem" onclick="showPostosSemLocal()"><b>'+_pstSemCache.length+(_pstSemCache.length===1?' posto sem localização':' postos sem localização')+'</b><span>Não aparecem no mapa até ter link do Maps ou coordenada. Corrigir</span></button>':'');
}

// Aviso dos postos sem localização (só admin)
var _pstSemCache=[];
function _pstAvisoSem(sem){
  _pstSemCache=sem;
  const b=document.getElementById('postosMapSem');
  if(!b)return;
  const web=typeof IS_DESKTOP==='function'&&IS_DESKTOP();
  b.hidden=!adminMode||!sem.length||web;
  b.innerHTML='<i class="ti ti-map-pin-off" aria-hidden="true"></i>'+sem.length+' sem localização';
}

function _pstToast(titulo,txt){
  const t=document.getElementById('postosMapToast');
  if(!t)return;
  t.innerHTML='<span class="pst-mt-ico"><i class="ti ti-plus" aria-hidden="true"></i></span><span class="pst-mt-txt"><b>'+_pstEsc(titulo)+'</b><span>'+_pstEsc(txt)+'</span></span>';
  t.hidden=false;
  clearTimeout(_pstToast._t);_pstToast._t=setTimeout(()=>{t.hidden=true;},4500);
}

// ─── coordenada de link curto (Cloud Function) ───
async function _pstResolverLink(nome,link,manual){
  if(typeof _callFn!=='function')throw new Error('Funções indisponíveis');
  const r=await _callFn('resolverLinkMaps')({nome,link,manual:!!manual});
  return r&&r.data;
}
// Admin com o mapa aberto: resolve sozinho os links curtos ainda sem coordenada
function _pstAutoResolver(todos){
  if(_pstFnIndisponivel||_pstGeoNegado)return;
  const fila=todos.filter(p=>{
    if(!p.link||!_geoLinkCurto(p.link)||_geoParse(p.link))return false;
    const g=_postosGeo[_geoKey(p.nome)];
    if(g&&(g.fonte==='manual'||g.link===p.link))return false; // já resolvido (ou já tentou esse link)
    const a=_postosGeoArq[_geoKey(p.nome)];
    if(a&&a.link===p.link)return false; // já lido no postos-geo.json
    return !_pstResolvendo[_geoKey(p.nome)];
  });
  if(!fila.length)return;
  fila.forEach(p=>{_pstResolvendo[_geoKey(p.nome)]=1;});
  let i=0;
  const prox=async()=>{
    while(i<fila.length&&!_pstFnIndisponivel){
      const p=fila[i++];
      try{await _pstResolverLink(p.nome,p.link,false);}
      catch(e){
        const c=String(e&&e.code||'');
        if(/not-found|unavailable|unimplemented|permission-denied|internal/.test(c)){_pstFnIndisponivel=true;console.warn('resolverLinkMaps indisponível:',c);}
      }
    }
  };
  prox();prox();
}
// Chamado depois que o admin salva um posto (cadastro/edição)
function geoAtualizarPosto(nome,link){
  if(!nome||!link||_geoParse(link)||!_geoLinkCurto(link))return;
  _pstResolverLink(nome,link,false).catch(e=>console.warn('resolverLinkMaps:',e&&e.code));
}

// ─── admin: lista de postos sem localização ───
function showPostosSemLocal(){
  document.querySelector('.postos-form-ov')?.remove();
  const ov=document.createElement('div');
  ov.className='postos-form-ov';
  ov.onclick=e=>{if(e.target===ov)ov.remove();};
  ov.innerHTML='<div class="postos-form-box pst-sem-box"><div class="postos-form-title">Postos sem localização</div>'
    +'<div class="pst-sem-intro">Estes postos não aparecem no mapa. Cole o link do Google Maps (longo ou curto) ou as coordenadas, por exemplo <b>-16.82, -49.24</b>.</div>'
    +(_pstGeoNegado?'<div class="postos-form-err" style="display:block">As regras do banco ainda não foram publicadas (nó postosGeo). Rode <b>firebase deploy --only database</b>.</div>':'')
    +'<div id="pstSemLista"></div>'
    +'<div class="postos-form-btns"><button class="postos-form-cancel" onclick="this.closest(\'.postos-form-ov\').remove()">Fechar</button></div></div>';
  document.body.appendChild(ov);
  _pstSemListaRender();
}
function _pstSemListaRender(){
  const el=document.getElementById('pstSemLista');
  if(!el)return;
  const sem=_pstColetar().filter(p=>!_pstCoord(p)).sort((a,b)=>(a.nome||'').localeCompare(b.nome||'','pt'));
  if(!sem.length){el.innerHTML='<div class="pst-sem-ok"><i class="ti ti-circle-check" aria-hidden="true"></i>Todos os postos têm localização.</div>';return;}
  el.innerHTML=sem.map(p=>{
    const k=_geoKey(p.nome),g=_postosGeo[k],a=_postosGeoArq[k];
    const quebrado=(g&&g.falhou&&g.link===p.link)||(a&&a.falhou&&a.link===p.link);
    const motivo=!p.link?'Sem link do Maps':quebrado?'O link abre o Maps sem lugar marcado — copie o link de novo':_geoLinkCurto(p.link)?'Link curto aguardando leitura':'O link não traz a coordenada';
    return '<div class="pst-sem-it" data-k="'+k+'"><div class="pst-sem-nome">'+_pstEsc(p.nome)+'</div><div class="pst-sem-sub">'+_pstEsc(p.cidade||'—')+' · '+motivo+'</div>'
      +'<div class="pst-sem-row"><input aria-label="Link ou coordenadas de '+_pstEsc(p.nome)+'" placeholder="Link do Maps ou -16.82, -49.24"><button type="button" onclick="_pstSemSalvar(this,\''+encodeURIComponent(p.nome)+'\')">Salvar</button></div>'
      +'<div class="pst-sem-err" hidden></div></div>';
  }).join('');
}
async function _pstSemSalvar(btn,nEnc){
  const nome=decodeURIComponent(nEnc);
  const box=btn.closest('.pst-sem-it'),inp=box.querySelector('input'),err=box.querySelector('.pst-sem-err');
  const v=(inp.value||'').trim();
  err.hidden=true;
  if(!v){err.textContent='Cole um link ou as coordenadas.';err.hidden=false;return;}
  btn.disabled=true;btn.textContent='Salvando…';
  try{
    const c=_geoParse(v);
    if(c){
      await db.ref('postosGeo/'+_geoKey(nome)).set({nome,lat:c.lat,lng:c.lng,link:v.slice(0,500),fonte:'manual',data:Date.now()});
    }else if(_geoLinkCurto(v)){
      const r=await _pstResolverLink(nome,v,true);
      if(!r||!_geoOk(r.lat,r.lng))throw new Error('O link não traz a coordenada. Abra o local no Maps, toque no pino e copie o link de novo, ou cole as coordenadas.');
    }else{
      throw new Error('Não encontrei coordenada nesse texto. Use um link do Google Maps ou o formato -16.82, -49.24.');
    }
    box.remove();
    if(typeof showToast==='function')showToast('📍 Localização salva');
    if(!document.querySelector('#pstSemLista .pst-sem-it'))_pstSemListaRender();
  }catch(e){
    const pd=/permission/i.test(String(e&&(e.code||e.message)));
    err.textContent=pd?'Sem permissão: publique as regras do banco (firebase deploy --only database).':(e&&e.message||'Erro ao salvar');
    err.hidden=false;btn.disabled=false;btn.textContent='Salvar';
  }
}
