// ═══ INFORMATIVOS ═══
// Layout aprovado (mockup "Avisos — Senhas"): hero com contadores, filtro por região,
// cards de posto, seção de senhas por operadora e formulário em folha inferior.
// Admin cadastra/exclui; motorista apenas lê.
// Firebase: /informativos/{id} = { regiao, posto, localizacao?, formaPagamento, descricao, ts }
var informativos = {};
var _infFilter = 'Todas';
var _infOp = 'truck';

const INF_PAY_OPTS = ['Cartão Rede Frota','Truckpag','Shell Experts'];
const INF_OPS = {
  truck:{name:'Truckpag',color:'#1a6fb5',tint:'#e7f0f9',rule:'4 primeiros dígitos do CPF',pass:'0123',hint:'dígitos 1 a 4',pick:[0,1,2,3],skip:[],label:'SENHA'},
  shell:{name:'Shell Experts',color:'#b5651d',tint:'#fbeee2',rule:'6 primeiros dígitos, pulando o zero',pass:'123456',hint:'pula o 0 → dígitos 2 a 7',pick:[1,2,3,4,5,6],skip:[0],label:'MATRÍCULA E SENHA',
    need:['Matrícula','Senha'],note:'Matrícula e senha são o <strong>mesmo número</strong>.',
    warn:'Se o <strong>primeiro dígito</strong> do CPF for <strong>0</strong>, ele é pulado. Se o CPF não começa com 0, use os 6 primeiros normalmente. Vale para a matrícula e para a senha.'},
  frota:{name:'Rede Frota',color:'#1f8a3d',tint:'#e6f3ea',rule:'4 últimos dígitos do CPF',pass:'7890',hint:'dígitos 8 a 11',pick:[7,8,9,10],skip:[],label:'SENHA',
    virtual:true,need:['Placa do veículo','CPF','Senha']}
};

const _INF_SVG={
  back:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  plus:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  pin:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  trash:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>',
  edit:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4"/><path d="M13.5 6.5l4 4"/></svg>',
  pump:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="10" height="18" rx="1.5"/><path d="M6 8h4"/><path d="M13 8h3l3 3v7a2 2 0 0 1-4 0v-5"/></svg>',
  loc:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l18-8-8 18-2-8-8-2z"/></svg>',
  chat:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8a8886" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  down:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c2c0ba" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="M6 13l6 6 6-6"/></svg>',
  warn:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#e8a020" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
  lock:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  cam:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  card:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M6 15h4"/></svg>',
  alert:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
  close:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1c1c1c" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>'
};

// ─── navegação ───
function showInformativos(){
  navPush('screenInformativos');
  renderInformativos();
  updateBottomNav('Informativos');
  const m=document.querySelector('#screenInformativos .inf-main');
  if(m)m.scrollTop=0;
  setTimeout(renderInformativos,600); // re-render após Firebase responder (cache frio)
}

function bnavGoInformativos(){
  const top=_navStack[_navStack.length-1];
  if(top==='screenInformativos'){updateBottomNav('Informativos');return;}
  if(top!=='screenHome'){window._homeInstant=true;try{showHome();}finally{window._homeInstant=false;}}
  showInformativos();
}

// ─── helpers ───
function _infList(){
  return Object.entries(informativos||{})
    .map(([id,v])=>Object.assign({id},v))
    .sort((a,b)=>(b.ts||0)-(a.ts||0));
}
function _infRegions(items){
  const r=[];items.forEach(it=>{const g=(it.regiao||'').trim();if(g&&r.indexOf(g)<0)r.push(g);});return r;
}
function _infPayColor(p){
  const s=(p||'').toLowerCase();
  if(s.indexOf('frota')>=0)return '#1f8a3d';
  if(s.indexOf('truck')>=0)return '#1a6fb5';
  if(s.indexOf('shell')>=0)return '#b5651d';
  return '#8a8886';
}
function _infIsAdmin(){return !!(adminMode&&!currentDriver);}
function _infMapUrl(loc){
  const l=(loc||'').trim();
  if(/^https?:\/\//i.test(l))return l;
  return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(l);
}
function _infNl2br(s){return esc(s).replace(/\n/g,'<br>');}

// ─── render ───
function renderInformativos(){
  const el=document.getElementById('informativosList');
  if(!el)return;
  if(!el.querySelector('.inf-main')){
    el.innerHTML=`<header class="inf-hero">
      <svg class="inf-hero-road" width="390" height="200" viewBox="0 0 390 200" aria-hidden="true"><path d="M250 200 L330 0" stroke="#2f2f2d" stroke-width="70"/><path d="M290 200 L370 0" stroke="#fe2627" stroke-width="3" stroke-dasharray="16 14"/></svg>
      <div class="inf-hero-row">
        <button class="inf-hero-back" onclick="bnavGoRotas()" aria-label="Voltar">${_INF_SVG.back}</button>
        <span class="inf-hero-kicker">AVISOS · ABASTECIMENTO</span>
      </div>
      <h1 class="inf-hero-title">Informativos<br>de postos</h1>
      <div class="inf-hero-stats" id="infStats"></div>
    </header>
    <main class="inf-main">
      <div class="inf-sec-label inf-sec-top">SENHAS POR OPERADORA</div>
      <div id="infSenhas"></div>
      <div class="inf-sec-head">
        <span class="inf-sec-label">POSTOS POR REGIÃO</span>
        <button class="inf-add" id="infAddBtn" onclick="showAddInformativoForm()">${_INF_SVG.plus}<span>Adicionar</span></button>
      </div>
      <div class="inf-filters" id="infFilters"></div>
      <div id="infCards"></div>
    </main>`;
  }
  const items=_infList();
  const regions=_infRegions(items);
  if(_infFilter!=='Todas'&&regions.indexOf(_infFilter)<0)_infFilter='Todas';

  document.getElementById('infStats').innerHTML=
    `<div class="inf-stat"><div class="inf-stat-n">${items.length}</div><div class="inf-stat-l">POSTOS</div></div>
     <div class="inf-stat"><div class="inf-stat-n">${regions.length}</div><div class="inf-stat-l">REGIÕES</div></div>`;

  const add=document.getElementById('infAddBtn');
  if(add)add.style.display=_infIsAdmin()?'flex':'none';

  document.getElementById('infFilters').innerHTML=['Todas'].concat(regions).map(r=>
    `<button class="inf-chip${r===_infFilter?' active':''}" data-r="${esc(r)}" onclick="setInfFilter(this.dataset.r)">${esc(r)}</button>`).join('');

  const cards=items.filter(it=>_infFilter==='Todas'||(it.regiao||'').trim()===_infFilter);
  document.getElementById('infCards').innerHTML=cards.length
    ?cards.map(buildInformativoCard).join('')
    :`<div class="inf-empty">${items.length?'Nenhum informativo nesta região.':'Nenhum informativo publicado.'}</div>`;

  renderInfSenhas();
  if(typeof renderAdminInformativos==='function')renderAdminInformativos();
}

// ─── fotos do posto (mesma base da tela de Postos: avulsos → paradas das rotas) ───
var _infFotoCache={};
function _infNorm(x){return String(x||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();}
function _infFotos(nome){
  let f=(typeof getFotosByNome==='function')?(getFotosByNome(nome)||[]).filter(Boolean):[];
  if(f.length)return f;
  const n=_infNorm(nome);if(!n)return[];
  const rs=(typeof routes!=='undefined'&&Array.isArray(routes))?routes:[];
  for(const r of rs){for(const p of (r.paradas||[])){
    if(_infNorm(p.nome)===n&&Array.isArray(p.fotos)){const g=p.fotos.filter(Boolean);if(g.length)return g;}
  }}
  return[];
}
function _infOpenFotos(id){
  const f=_infFotoCache[id];
  if(!f||!f.length||typeof showPostoGaleria!=='function')return;
  _postoGaleriaCache['inf_'+id]=f;
  showPostoGaleria('inf_'+id,0);
}

function buildInformativoCard(it){
  const fotos=_infFotos(it.posto);
  _infFotoCache[it.id]=fotos;
  const regTxt=(it.regiao||'').trim();
  const del=_infIsAdmin()
    ?`<button class="inf-del inf-edit" onclick="showAddInformativoForm('${it.id}')" aria-label="Editar informativo">${_INF_SVG.edit}</button><button class="inf-del" onclick="deleteInformativo('${it.id}')" aria-label="Remover informativo">${_INF_SVG.trash}</button>`:'';
  const pay=it.formaPagamento
    ?`<div class="inf-pay"><span class="inf-pay-dot" style="background:${_infPayColor(it.formaPagamento)}"></span><span>Pagamento: <strong>${esc(it.formaPagamento)}</strong></span></div>`:'';
  const locTxt=(it.localizacao||'').trim();
  const loc=locTxt
    ?`<a class="inf-loc" href="${esc(_infMapUrl(locTxt))}" target="_blank" rel="noopener">${_INF_SVG.loc}<span>${/^https?:\/\//i.test(locTxt)?'Abrir localização no mapa':esc(locTxt)}</span></a>`:'';
  const desc=(it.descricao||'').trim()
    ?`<div class="inf-desc"><div class="inf-desc-head">${_INF_SVG.alert}<span>ATENÇÃO MOTORISTA</span></div><p>${_infNl2br(it.descricao)}</p></div>`:'';
  let top,body;
  if(fotos.length){
    top=`<div class="inf-photo">
      <img src="${esc(fotos[0])}" loading="lazy" decoding="async" alt="Foto do posto ${esc(it.posto||'')}" onclick="_infOpenFotos('${it.id}')">
      ${regTxt?`<span class="inf-region inf-region--photo">${_INF_SVG.pin}<span>Região de ${esc(regTxt)}</span></span>`:''}
      ${del?`<div class="inf-photo-adm">${del}</div>`:''}
      <button class="inf-fotos-btn" onclick="_infOpenFotos('${it.id}')" aria-label="Ver fotos do posto">${_INF_SVG.cam}<span>${fotos.length===1?'1 foto':fotos.length+' fotos'}</span></button>
    </div>`;
    body=`<div class="inf-card-body inf-card-body--photo"><div style="min-width:0"><div class="inf-posto">${esc(it.posto||'')}</div>${pay}</div></div>`;
  }else{
    top=`<div class="inf-card-top">${regTxt?`<span class="inf-region">${_INF_SVG.pin}<span>Região de ${esc(regTxt)}</span></span>`:''}<span style="flex:1"></span>${del}</div>`;
    body=`<div class="inf-card-body"><div class="inf-pump">${_INF_SVG.pump}</div><div style="min-width:0"><div class="inf-posto">${esc(it.posto||'')}</div>${pay}</div></div>`;
  }
  return `<article class="inf-card">${top}${body}${desc}${loc}<div style="height:12px"></div></article>`;
}

function setInfFilter(r){_infFilter=r;renderInformativos();}

// ─── senhas: 3 botões na tela; o detalhe abre em pop-up (folha inferior) ───
function renderInfSenhas(){
  const el=document.getElementById('infSenhas');
  if(!el)return;
  el.innerHTML=`<div class="inf-ops">${Object.keys(INF_OPS).map(k=>{
    const o=INF_OPS[k];
    return `<button class="inf-op" onclick="openInfSenha('${k}')"><span class="inf-op-ic" style="background:${o.color}">${_INF_SVG.lock}</span><span class="inf-op-n">${o.name}</span></button>`;
  }).join('')}</div><p class="inf-ops-hint">Toque na operadora para ver como acessar e montar a senha.</p>`;
}

function openInfSenha(k){
  if(INF_OPS[k])_infOp=k;
  document.querySelectorAll('.inf-senha-ov').forEach(o=>o.remove());
  const ov=document.createElement('div');
  ov.className='inf-sheet-ov inf-senha-ov';
  ov.onclick=e=>{if(e.target===ov)closeInfSenha();};
  ov.innerHTML=`<section class="inf-sheet inf-senha-sheet" role="dialog" aria-modal="true" aria-label="Senha da operadora"><div class="inf-sheet-grip"></div><div id="infSenhaBody"></div></section>`;
  document.body.appendChild(ov);
  _infRenderSenhaBody();
  void ov.offsetWidth; // ponto de partida (folha fora da tela) antes de deslizar
  ov.classList.add('is-open');
}
// Fecha com slide para baixo; remove do DOM ao fim da animação
function closeInfSenha(){
  const ov=document.querySelector('.inf-senha-ov:not(.is-closing)');
  if(!ov)return;
  ov.classList.add('is-closing');ov.classList.remove('is-open');
  setTimeout(()=>ov.remove(),300);
}
function setInfOp(k){if(INF_OPS[k]){_infOp=k;_infRenderSenhaBody();}}

function _infRenderSenhaBody(){
  const el=document.getElementById('infSenhaBody');
  if(!el)return;
  const o=INF_OPS[_infOp], seps={2:'.',5:'.',8:'-'};
  const tabs=Object.keys(INF_OPS).map(k=>{
    const a=k===_infOp;
    return `<button class="inf-tab${a?' active':''}" style="${a?'color:'+INF_OPS[k].color:''}" onclick="setInfOp('${k}')">${INF_OPS[k].name}</button>`;
  }).join('');
  const digits='01234567890'.split('').map((ch,i)=>{
    const on=o.pick.indexOf(i)>=0, skip=o.skip.indexOf(i)>=0;
    const cls=on?'inf-dg on':(skip?'inf-dg skip':'inf-dg');
    const st=on?`background:${o.color};box-shadow:0 3px 8px ${o.color}55`:'';
    return `<div class="inf-dg-wrap"><div class="${cls}" style="${st}">${ch}</div>${seps[i]?`<span class="inf-dg-sep">${seps[i]}</span>`:''}</div>`;
  }).join('');
  const virt=o.virtual?`<div class="inf-virtual" style="background:${o.tint};color:${o.color}">${_INF_SVG.card}<span><strong>Cartão virtual</strong> — não existe cartão físico.</span></div>`:'';
  const need=o.need?`<div class="inf-need"><div class="inf-senha-lbl">O QUE INFORMAR NO POSTO</div><div class="inf-need-row">${o.need.map((n,i)=>`<span class="inf-need-chip"><b style="background:${o.color}">${i+1}</b>${n}</span>`).join('')}</div>${o.note?`<div class="inf-need-note">${o.note}</div>`:''}</div>`:'';
  el.innerHTML=`<div class="inf-sheet-head">
      <div class="inf-ss-id"><span class="inf-op-ic inf-op-ic--lg" style="background:${o.color}">${_INF_SVG.lock}</span><div><div class="inf-senha-lbl">SENHA DA OPERADORA</div><div class="inf-sheet-title" style="line-height:1">${o.name}</div></div></div>
      <button type="button" class="inf-sheet-x" onclick="closeInfSenha()" aria-label="Fechar">${_INF_SVG.close}</button>
    </div>
    <div class="inf-tabs inf-tabs--sheet">${tabs}</div>
    ${virt}${need}
    <div class="inf-senha-lbl inf-ss-gap">COMO MONTAR ${o.label==='SENHA'?'A SENHA':'MATRÍCULA E SENHA'}</div>
    <div class="inf-senha-rule">${o.rule}</div>
    <div class="inf-digits">${digits}</div>
    <div class="inf-senha-cap"><span>CPF de exemplo</span><span>${o.hint}</span></div>
    <div class="inf-senha-res" style="background:${o.color};box-shadow:0 6px 16px ${o.color}40">
      <div class="inf-senha-res-l">${o.label}</div>
      <div class="inf-senha-res-v">${o.pass}</div>
    </div>
    ${o.warn?`<div class="inf-senha-warn">${_INF_SVG.warn}<span>${o.warn}</span></div>`:''}
    <p class="inf-footnote">CPF de exemplo fictício. Use sempre o CPF do motorista que está abastecendo.</p>`;
}

// ─── admin: cadastrar (folha inferior) ───
let _infEditId=null;
function showAddInformativoForm(editId){
  if(!_infIsAdmin())return;
  closeInfSheet();
  _infEditId=(editId&&informativos&&informativos[editId])?editId:null;
  const cur=_infEditId?informativos[_infEditId]:{};
  const v=k=>esc(cur[k]||'');
  const ov=document.createElement('div');
  ov.className='inf-sheet-ov';
  ov.onclick=e=>{if(e.target===ov)closeInfSheet();};
  ov.innerHTML=`<form class="inf-sheet" onsubmit="event.preventDefault();saveInformativo()">
    <div class="inf-sheet-grip"></div>
    <div class="inf-sheet-head">
      <div class="inf-sheet-title">${_infEditId?'Editar informativo':'Novo informativo'}</div>
      <button type="button" class="inf-sheet-x" onclick="closeInfSheet()" aria-label="Fechar">${_INF_SVG.close}</button>
    </div>
    <label class="inf-fld"><span>REGIÃO</span><input id="ifRegiao" value="${v('regiao')}" maxlength="100" placeholder="Ex.: Cuiabá - MT" oninput="_infValidate()"></label>
    <label class="inf-fld stop-ac-wrap"><span>POSTO</span><input id="ifPosto" value="${v('posto')}" maxlength="200" placeholder="Digite o nome — sugestões dos postos cadastrados" autocomplete="off" oninput="_infValidate();_infPostoInput(this.value)" onblur="setTimeout(_infCloseAC,200)"><div class="stop-ac-drop" id="ifPostoAC"></div></label>
    <label class="inf-fld"><span>LOCALIZAÇÃO</span><input id="ifLocalizacao" value="${v('localizacao')}" maxlength="500" placeholder="Endereço ou link do Google Maps"></label>
    <label class="inf-fld"><span>FORMA DE PAGAMENTO</span><select id="ifPagamento">${INF_PAY_OPTS.map(p=>`<option value="${p}"${cur.formaPagamento===p?' selected':''}>${p}</option>`).join('')}</select></label>
    <label class="inf-fld"><span>DESCRIÇÃO</span><textarea id="ifDescricao" rows="3" maxlength="4000" placeholder="Ex.: difícil achar vaga para pernoite, tem lavagem e borracharia…">${v('descricao')}</textarea></label>
    <div class="inf-sheet-err" id="ifError" style="display:none"></div>
    <button type="submit" class="inf-sheet-save" id="ifSave" disabled>${_infEditId?'SALVAR ALTERAÇÕES':'PUBLICAR INFORMATIVO'}</button>
  </form>`;
  document.body.appendChild(ov);
  _infValidate();
  setTimeout(()=>document.getElementById(_infEditId?'ifDescricao':'ifRegiao')?.focus(),100);
}

// ─── auto-completar do posto (mesma base do editor: postos das rotas + avulsos) ───
let _infACList=[];
const _INF_CARD2PAY={truckpag:'Truckpag',shell_expers:'Shell Experts',rede_frota:'Cartão Rede Frota'};
function _infPostoInput(val){
  const drop=document.getElementById('ifPostoAC');if(!drop)return;
  const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  const q=norm(val);
  if(q.length<2||typeof getAllKnownPostos!=='function'){_infCloseAC();return;}
  _infACList=getAllKnownPostos().filter(p=>norm(p.nome).includes(q)||norm(p.cidade).includes(q)).slice(0,8);
  if(!_infACList.length){_infCloseAC();return;}
  drop.innerHTML=_infACList.map((p,i)=>`<div class="stop-ac-item" onmousedown="event.preventDefault();_infPickPosto(${i})"><div class="stop-ac-nome">${esc(p.nome)}</div><div class="stop-ac-cidade">${esc(p.cidade)}</div></div>`).join('');
  drop.style.display='block';
}
function _infCloseAC(){const d=document.getElementById('ifPostoAC');if(d){d.innerHTML='';d.style.display='none';}}
function _infPickPosto(i){
  const p=_infACList[i];if(!p)return;
  const set=(id,v,onlyEmpty)=>{const el=document.getElementById(id);if(el&&v&&(!onlyEmpty||!el.value.trim()))el.value=v;};
  set('ifPosto',p.nome,false);
  set('ifRegiao',p.cidade,true);       // não sobrescreve região já digitada
  set('ifLocalizacao',p.link,true);    // link do Maps do posto
  const pay=_INF_CARD2PAY[p.cartao];
  if(pay)set('ifPagamento',pay,false);
  _infCloseAC();_infValidate();
  document.getElementById('ifDescricao')?.focus();
}

function closeInfSheet(){document.querySelector('.inf-sheet-ov')?.remove();}

function _infValidate(){
  const ok=!!((document.getElementById('ifRegiao')?.value||'').trim()&&(document.getElementById('ifPosto')?.value||'').trim());
  const b=document.getElementById('ifSave');if(b)b.disabled=!ok;
  return ok;
}

function saveInformativo(){
  if(!_infIsAdmin()||!_infValidate())return;
  const regiao=document.getElementById('ifRegiao').value.trim();
  const posto=document.getElementById('ifPosto').value.trim();
  const formaPagamento=document.getElementById('ifPagamento').value;
  const descricao=(document.getElementById('ifDescricao').value||'').trim();
  const localizacao=(document.getElementById('ifLocalizacao').value||'').trim();
  const errEl=document.getElementById('ifError');
  const btn=document.getElementById('ifSave');
  if(!db||!firebaseReady){errEl.textContent='Sem conexão com o servidor. Tente novamente.';errEl.style.display='block';return;}
  btn.disabled=true;btn.textContent='PUBLICANDO...';
  const editId=_infEditId;
  const prevTs=editId&&informativos[editId]?informativos[editId].ts:0;
  const rec={regiao,posto,formaPagamento,descricao,ts:prevTs||Date.now()};
  if(localizacao)rec.localizacao=localizacao; // só grava se preenchido
  const op=editId?db.ref('informativos/'+editId).set(rec):db.ref('informativos').push(rec);
  op
    .then(()=>{
      closeInfSheet();
      if(editId){if(typeof showToast==='function')showToast('Informativo atualizado','#1a7f37');}
      else{_infFilter='Todas';_infNotify(rec);}
      _infEditId=null;
    })
    .catch(e=>{
      btn.disabled=false;btn.textContent=editId?'SALVAR ALTERAÇÕES':'PUBLICAR INFORMATIVO';
      errEl.textContent='Erro ao publicar: '+((e&&e.message)||e);
      errEl.style.display='block';
    });
}

// ─── aviso + push para os motoristas ───
// Grava em /notifications via pushNotification(); a Cloud Function
// onNotificationCreated dispara o push FCM (chega mesmo com o app fechado).
function _infNotify(rec){
  if(typeof pushNotification!=='function')return;
  try{
    const desc=String(rec.descricao||'').replace(/\s+/g,' ').trim();
    const parts=[rec.posto,rec.formaPagamento,desc.length>140?desc.slice(0,137)+'...':desc].filter(Boolean);
    const titulo=('Informativo · '+(rec.regiao||'')).slice(0,100);
    pushNotification('info',titulo,('Novo informativo: '+parts.join(' · ')).slice(0,480));
  }catch(e){}
}

// ─── aba Informativos do painel Admin ───
function renderAdminInformativos(){
  const el=document.getElementById('adminInformativosList');if(!el)return;
  const items=_infList();
  el.innerHTML=`<div class="ap-topbar">
      <div class="adm-inf-count">${items.length} informativo${items.length===1?'':'s'} publicado${items.length===1?'':'s'}</div>
      <button class="ap-add-btn" onclick="showAddInformativoForm()"><i class="ti ti-plus" aria-hidden="true"></i>Novo informativo</button>
    </div>
    <div class="adm-inf-list">${items.length?items.map(buildInformativoCard).join(''):'<div class="inf-empty">Nenhum informativo publicado.</div>'}</div>`;
}

// ─── admin: excluir ───
function deleteInformativo(id){
  if(!_infIsAdmin()||!id)return;
  if(!confirm('Excluir este informativo? Esta ação não pode ser desfeita.'))return;
  if(!db)return;
  db.ref('informativos/'+id).remove()
    .catch(e=>{alert('Erro ao excluir: '+((e&&e.message)||e));});
}
