// ═══ INFORMATIVOS ═══
// Lista de informativos de abastecimento por região.
// Admin cadastra/exclui; motorista apenas lê.
// Firebase: /informativos/{id} = { regiao, posto, formaPagamento, descricao, ts }
var informativos = {};

// ─── navegação ───
function showInformativos(){
  navPush('screenInformativos');
  renderInformativos();
  updateBottomNav('Informativos');
  const l=document.querySelector('#screenInformativos .inf-list');
  if(l)l.scrollTop=0;
  // Re-render garantido após Firebase responder (cobre cache frio)
  setTimeout(renderInformativos,600);
}

function bnavGoInformativos(){
  const top=_navStack[_navStack.length-1];
  if(top==='screenInformativos'){updateBottomNav('Informativos');return;}
  if(top!=='screenHome')showHome();
  showInformativos();
}

// ─── render ───
function _infList(){
  return Object.entries(informativos||{})
    .map(([id,v])=>Object.assign({id},v))
    .sort((a,b)=>(b.ts||0)-(a.ts||0));
}

function _infNl2br(s){return esc(s).replace(/\n/g,'<br>');}

function buildInformativoCard(it){
  const regiao=it.regiao
    ?`<span class="inf-region"><i class="ti ti-map-pin" aria-hidden="true"></i>${esc(it.regiao)}</span>`:'';
  const pay=it.formaPagamento
    ?`<span class="inf-pay"><i class="ti ti-credit-card" aria-hidden="true"></i>${esc(it.formaPagamento)}</span>`:'';
  const del=adminMode
    ?`<button class="inf-del" onclick="deleteInformativo('${it.id}')" aria-label="Excluir informativo"><i class="ti ti-trash" aria-hidden="true"></i></button>`:'';
  const desc=it.descricao
    ?`<div class="inf-desc">${_infNl2br(it.descricao)}</div>`:'';
  return `<article class="inf-card">
    <div class="inf-card-top">
      <div class="inf-card-badges">${regiao}</div>
      ${del}
    </div>
    <h3 class="inf-posto">${esc(it.posto||'')}</h3>
    ${pay}
    ${desc}
  </article>`;
}

function renderInformativos(){
  const el=document.getElementById('informativosList');
  if(!el)return;
  const items=_infList();
  let html='';
  if(items.length===0){
    html=`<div class="inf-empty"><i class="ti ti-speakerphone" aria-hidden="true"></i><p>Nenhum informativo publicado</p></div>`;
  } else {
    items.forEach(it=>{html+=buildInformativoCard(it);});
  }
  el.innerHTML=html;
  const fab=document.getElementById('infFab');
  if(fab)fab.style.display=adminMode?'flex':'none';
}

// ─── admin: cadastrar ───
function showAddInformativoForm(){
  if(!adminMode)return;
  document.querySelector('.postos-form-ov')?.remove();
  const ov=document.createElement('div');
  ov.className='postos-form-ov';
  ov.innerHTML=`<div class="postos-form-box">
    <div class="postos-form-title">Novo informativo</div>
    <div class="postos-form-field"><label>Região</label><input id="ifRegiao" placeholder="Ex: Cuiabá — MT"></div>
    <div class="postos-form-field"><label>Posto</label><input id="ifPosto" placeholder="Ex: Posto São Matheus"></div>
    <div class="postos-form-field"><label>Forma de pagamento</label><input id="ifPagamento" placeholder="Ex: Cartão Rede Frota"></div>
    <div class="postos-form-field"><label>Descrição</label><textarea id="ifDescricao" class="inf-textarea" rows="6" placeholder="Instruções, regras de senha, observações..."></textarea></div>
    <div class="postos-form-err" id="ifError" style="display:none"></div>
    <div class="postos-form-btns">
      <button class="postos-form-cancel" onclick="this.closest('.postos-form-ov').remove()">Cancelar</button>
      <button class="postos-form-save" onclick="saveInformativo()">Publicar</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  setTimeout(()=>document.getElementById('ifPosto')?.focus(),100);
}

function saveInformativo(){
  if(!adminMode)return;
  const regiao=(document.getElementById('ifRegiao')?.value||'').trim();
  const posto=(document.getElementById('ifPosto')?.value||'').trim();
  const formaPagamento=(document.getElementById('ifPagamento')?.value||'').trim();
  const descricao=(document.getElementById('ifDescricao')?.value||'').trim();
  const errEl=document.getElementById('ifError');
  const btn=document.querySelector('.postos-form-ov .postos-form-save');
  if(!posto){errEl.textContent='O nome do posto é obrigatório.';errEl.style.display='block';return;}
  if(!db||!firebaseReady){errEl.textContent='Sem conexão com o servidor. Tente novamente.';errEl.style.display='block';return;}
  if(btn){btn.disabled=true;btn.textContent='Publicando...';}
  db.ref('informativos').push({regiao,posto,formaPagamento,descricao,ts:Date.now()})
    .then(()=>{document.querySelector('.postos-form-ov')?.remove();})
    .catch(e=>{
      if(btn){btn.disabled=false;btn.textContent='Publicar';}
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
