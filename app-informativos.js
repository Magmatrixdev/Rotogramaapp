// ═══ INFORMATIVOS ═══
// Layout aprovado (mockup "Avisos — Senhas"): hero com contadores, filtro por região,
// cards de posto, seção de senhas por operadora e formulário em folha inferior.
// Admin cadastra/exclui; motorista apenas lê.
// Firebase: /informativos/{id} = { regiao, posto, formaPagamento, descricao, ts }
var informativos = {};
var _infFilter = 'Todas';
var _infOp = 'truck';

const INF_PAY_OPTS = ['Cartão Rede Frota','Truckpag','Shell Experts'];
const INF_OPS = {
  truck:{name:'Truckpag',color:'#1a6fb5',tint:'#e7f0f9',rule:'4 primeiros dígitos do CPF',pass:'0123',hint:'dígitos 1 a 4',pick:[0,1,2,3],skip:[]},
  shell:{name:'Shell Experts',color:'#b5651d',tint:'#fbeee2',rule:'6 primeiros dígitos, pulando o zero',pass:'123456',hint:'pula o 0 → dígitos 2 a 7',pick:[1,2,3,4,5,6],skip:[0]},
  frota:{name:'Rede Frota',color:'#1f8a3d',tint:'#e6f3ea',rule:'4 últimos dígitos do CPF',pass:'7890',hint:'dígitos 8 a 11',pick:[7,8,9,10],skip:[]}
};

const _INF_SVG={
  back:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  plus:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  pin:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  trash:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>',
  pump:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="10" height="18" rx="1.5"/><path d="M6 8h4"/><path d="M13 8h3l3 3v7a2 2 0 0 1-4 0v-5"/></svg>',
  chat:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8a8886" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  down:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c2c0ba" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="M6 13l6 6 6-6"/></svg>',
  warn:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#e8a020" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
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
  if(top!=='screenHome')showHome();
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
      <div class="inf-sec-head">
        <span class="inf-sec-label">POSTOS POR REGIÃO</span>
        <button class="inf-add" id="infAddBtn" onclick="showAddInformativoForm()">${_INF_SVG.plus}<span>Adicionar</span></button>
      </div>
      <div class="inf-filters" id="infFilters"></div>
      <div id="infCards"></div>
      <div class="inf-sec-label inf-sec-gap">SENHAS POR OPERADORA</div>
      <div id="infSenhas"></div>
      <p class="inf-footnote">CPF de exemplo fictício. Use sempre o CPF do motorista que está abastecendo.</p>
    </main>`;
  }
  const items=_infList();
  const regions=_infRegions(items);
  if(_infFilter!=='Todas'&&regions.indexOf(_infFilter)<0)_infFilter='Todas';

  document.getElementById('infStats').innerHTML=
    `<div class="inf-stat"><div class="inf-stat-n">${items.length}</div><div class="inf-stat-l">POSTOS</div></div>
     <div class="inf-stat"><div class="inf-stat-n">${regions.length}</div><div class="inf-stat-l">REGIÕES</div></div>`;

  const add=document.getElementById('infAddBtn');
  if(add)add.style.display=adminMode?'flex':'none';

  document.getElementById('infFilters').innerHTML=['Todas'].concat(regions).map(r=>
    `<button class="inf-chip${r===_infFilter?' active':''}" data-r="${esc(r)}" onclick="setInfFilter(this.dataset.r)">${esc(r)}</button>`).join('');

  const cards=items.filter(it=>_infFilter==='Todas'||(it.regiao||'').trim()===_infFilter);
  document.getElementById('infCards').innerHTML=cards.length
    ?cards.map(buildInformativoCard).join('')
    :`<div class="inf-empty">${items.length?'Nenhum informativo nesta região.':'Nenhum informativo publicado.'}</div>`;

  renderInfSenhas();
}

function buildInformativoCard(it){
  const regiao=(it.regiao||'').trim()
    ?`<span class="inf-region">${_INF_SVG.pin}<span>Região de ${esc(it.regiao)}</span></span>`:'';
  const del=adminMode
    ?`<button class="inf-del" onclick="deleteInformativo('${it.id}')" aria-label="Remover informativo">${_INF_SVG.trash}</button>`:'';
  const pay=it.formaPagamento
    ?`<div class="inf-pay"><span class="inf-pay-dot" style="background:${_infPayColor(it.formaPagamento)}"></span><span>Pagamento: <strong>${esc(it.formaPagamento)}</strong></span></div>`:'';
  const desc=(it.descricao||'').trim()
    ?`<div class="inf-desc">${_INF_SVG.chat}<p>${_infNl2br(it.descricao)}</p></div>`
    :'<div style="height:14px"></div>';
  return `<article class="inf-card">
    <div class="inf-card-top">${regiao}<span style="flex:1"></span>${del}</div>
    <div class="inf-card-body">
      <div class="inf-pump">${_INF_SVG.pump}</div>
      <div style="min-width:0">
        <div class="inf-posto">${esc(it.posto||'')}</div>
        ${pay}
      </div>
    </div>
    ${desc}
  </article>`;
}

function setInfFilter(r){_infFilter=r;renderInformativos();}

function setInfOp(k){if(INF_OPS[k]){_infOp=k;renderInfSenhas();}}

function renderInfSenhas(){
  const el=document.getElementById('infSenhas');
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
  el.innerHTML=`<div class="inf-tabs">${tabs}</div>
  <section class="inf-senha">
    <div class="inf-senha-head">
      <span class="inf-senha-lbl">COMO MONTAR A SENHA</span>
      <span class="inf-senha-chip" style="background:${o.tint};color:${o.color}">${o.name}</span>
    </div>
    <div class="inf-senha-rule">${o.rule}</div>
    <div class="inf-digits">${digits}</div>
    <div class="inf-senha-cap"><span>CPF de exemplo</span><span>${o.hint}</span></div>
    <div class="inf-senha-arrow">${_INF_SVG.down}</div>
    <div class="inf-senha-res" style="background:${o.color};box-shadow:0 6px 16px ${o.color}40">
      <div class="inf-senha-res-l">SENHA</div>
      <div class="inf-senha-res-v">${o.pass}</div>
    </div>
    ${_infOp==='shell'?`<div class="inf-senha-warn">${_INF_SVG.warn}<span>O <strong>0</strong> do início do CPF é ignorado. Se o CPF não começa com 0, use os 6 primeiros normalmente.</span></div>`:''}
  </section>`;
}

// ─── admin: cadastrar (folha inferior) ───
function showAddInformativoForm(){
  if(!adminMode)return;
  closeInfSheet();
  const ov=document.createElement('div');
  ov.className='inf-sheet-ov';
  ov.onclick=e=>{if(e.target===ov)closeInfSheet();};
  ov.innerHTML=`<form class="inf-sheet" onsubmit="event.preventDefault();saveInformativo()">
    <div class="inf-sheet-grip"></div>
    <div class="inf-sheet-head">
      <div class="inf-sheet-title">Novo informativo</div>
      <button type="button" class="inf-sheet-x" onclick="closeInfSheet()" aria-label="Fechar">${_INF_SVG.close}</button>
    </div>
    <label class="inf-fld"><span>REGIÃO</span><input id="ifRegiao" maxlength="100" placeholder="Ex.: Cuiabá - MT" oninput="_infValidate()"></label>
    <label class="inf-fld"><span>POSTO</span><input id="ifPosto" maxlength="200" placeholder="Ex.: Posto São Matheus" oninput="_infValidate()"></label>
    <label class="inf-fld"><span>FORMA DE PAGAMENTO</span><select id="ifPagamento">${INF_PAY_OPTS.map(p=>`<option value="${p}">${p}</option>`).join('')}</select></label>
    <label class="inf-fld"><span>DESCRIÇÃO</span><textarea id="ifDescricao" rows="3" maxlength="4000" placeholder="Ex.: difícil achar vaga para pernoite, tem lavagem e borracharia…"></textarea></label>
    <div class="inf-sheet-err" id="ifError" style="display:none"></div>
    <button type="submit" class="inf-sheet-save" id="ifSave" disabled>PUBLICAR INFORMATIVO</button>
  </form>`;
  document.body.appendChild(ov);
  setTimeout(()=>document.getElementById('ifRegiao')?.focus(),100);
}

function closeInfSheet(){document.querySelector('.inf-sheet-ov')?.remove();}

function _infValidate(){
  const ok=!!((document.getElementById('ifRegiao')?.value||'').trim()&&(document.getElementById('ifPosto')?.value||'').trim());
  const b=document.getElementById('ifSave');if(b)b.disabled=!ok;
  return ok;
}

function saveInformativo(){
  if(!adminMode||!_infValidate())return;
  const regiao=document.getElementById('ifRegiao').value.trim();
  const posto=document.getElementById('ifPosto').value.trim();
  const formaPagamento=document.getElementById('ifPagamento').value;
  const descricao=(document.getElementById('ifDescricao').value||'').trim();
  const errEl=document.getElementById('ifError');
  const btn=document.getElementById('ifSave');
  if(!db||!firebaseReady){errEl.textContent='Sem conexão com o servidor. Tente novamente.';errEl.style.display='block';return;}
  btn.disabled=true;btn.textContent='PUBLICANDO...';
  db.ref('informativos').push({regiao,posto,formaPagamento,descricao,ts:Date.now()})
    .then(()=>{_infFilter='Todas';closeInfSheet();})
    .catch(e=>{
      btn.disabled=false;btn.textContent='PUBLICAR INFORMATIVO';
      errEl.textContent='Erro ao publicar: '+((e&&e.message)||e);
      errEl.style.display='block';
    });
}

// ─── admin: excluir ───
function deleteInformativo(id){
  if(!adminMode||!id)return;
  if(!confirm('Excluir este informativo? Esta ação não pode ser desfeita.'))return;
  if(!db)return;
  db.ref('informativos/'+id).remove()
    .catch(e=>{alert('Erro ao excluir: '+((e&&e.message)||e));});
}
