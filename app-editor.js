// ═══ EDITOR ═══
let editingRouteIndex=-1; // alias legacy (o índice ativo é editingIndex em app-state.js)

function saveDraft(){captureEditorFields();localStorage.setItem('rotograma_draft',JSON.stringify({index:editingIndex,data:editData}));}
function clearDraft(){localStorage.removeItem('rotograma_draft')}
function loadDraft(){try{const d=JSON.parse(localStorage.getItem('rotograma_draft'));if(d&&d.data&&d.data.nome)return d}catch(e){}return null}

function captureEditorFields(){
  const v=k=>document.getElementById(k)?.value;
  if(v('ed_nome')!==undefined){
    editData.nome=v('ed_nome')||editData.nome;editData.numero=v('ed_numero')||editData.numero;
    editData.regiao=v('ed_regiao')||editData.regiao;editData.estados=v('ed_estados')||editData.estados;
    editData.distancia=v('ed_distancia')||editData.distancia;editData.tempo=v('ed_tempo')||editData.tempo;
    editData.linkRota=v('ed_linkRota')||editData.linkRota;editData.observacao=v('ed_observacao')||'';editData.retorno=v('ed_retorno')||'';
    const orig=editData.paradas.find(p=>p.tipo==='origem');
    if(orig){orig.nome=v('ed_orig_nome')||orig.nome;orig.cidade=v('ed_orig_cidade')||orig.cidade;orig.detalhe=v('ed_orig_detalhe')||orig.detalhe}
    const dest=editData.paradas.find(p=>p.tipo==='destino');
    if(dest){dest.nome=v('ed_dest_nome')||dest.nome;dest.cidade=v('ed_dest_cidade')||dest.cidade;dest.km=v('ed_dest_km')||dest.km}
  }
}

function editRoute(i){
  isEditing=true;editingIndex=i;
  const draft=loadDraft();
  if(draft&&draft.index===i){editData=draft.data;document.getElementById('editorTitle').textContent=i>=0?'Editar Rota (rascunho)':'Nova Rota (rascunho)';}
  else if(i>=0){editData=JSON.parse(JSON.stringify(routes[i]));document.getElementById('editorTitle').textContent='Editar Rota';}
  else{editData={id:'',nome:'',estados:'',numero:String(routes.length+1).padStart(2,'0'),regiao:'Centro-Oeste',subtitulo:'',linkRota:'',distancia:'',tempo:'',paradas:[{ordem:0,tipo:'origem',nome:'',cidade:'',km:'0',detalhe:''},{ordem:1,tipo:'destino',nome:'',cidade:'',km:''}]};document.getElementById('editorTitle').textContent='Nova Rota';}
  renderEditor();navPush('screenEditor');
  if(window._draftInterval)clearInterval(window._draftInterval);
  window._draftInterval=setInterval(saveDraft,3000);
}

function renderEditor(){
  const d=editData;const fs=d.paradas.filter(p=>p.tipo!=='origem'&&p.tipo!=='destino');const orig=d.paradas.find(p=>p.tipo==='origem')||{};const dest=d.paradas.find(p=>p.tipo==='destino')||{};
  let h=`<div class="editor-section"><div class="editor-section-title"><span class="bar"></span>Dados da Rota</div>
  <div class="field"><label>Nome da rota</label><input id="ed_nome" value="${esc(d.nome)}" placeholder="Ex: Goiânia → Cabedelo"></div>
  <div class="field-row"><div class="field"><label>Número</label><input id="ed_numero" value="${esc(d.numero)}" placeholder="01"></div><div class="field"><label>Região</label><select id="ed_regiao">${REGION_ORDER.map(r=>`<option${d.regiao===r?' selected':''}>${r}</option>`).join('')}</select></div></div>
  <div class="field"><label>Estados</label><input id="ed_estados" value="${esc(d.estados)}" placeholder="GO → BA → SE"></div>
  <div class="field-row"><div class="field"><label>Distância</label><input id="ed_distancia" value="${esc(d.distancia)}" placeholder="~900 km"></div><div class="field"><label>Tempo</label><input id="ed_tempo" value="${esc(d.tempo)}" placeholder="~12h"></div></div>
  <div class="field"><label>Link rota Google Maps</label><input id="ed_linkRota" value="${esc(d.linkRota)}" placeholder="https://maps.app.goo.gl/..."></div>
  <div class="field"><label>⚠️ Observação / Alerta</label><textarea id="ed_observacao" placeholder="Ex: BR-242 com obra no km 380">${esc(d.observacao||'')}</textarea></div>
  <div class="field"><label>🔄 Informações da volta</label><input id="ed_retorno" value="${esc(d.retorno||'')}" placeholder="Ex: Na volta, abastecer no Posto XYZ"></div></div>`;
  h+=`<div class="editor-section"><div class="editor-section-title"><span class="bar"></span>Origem</div>
  <div class="field"><label>Local</label><input id="ed_orig_nome" value="${esc(orig.nome)}" placeholder="Goiânia — GO"></div>
  <div class="field"><label>Descrição</label><input id="ed_orig_cidade" value="${esc(orig.cidade)}" placeholder="Saída da garagem"></div>
  <div class="field"><label>BRs / Rodovias</label><input id="ed_orig_detalhe" value="${esc(orig.detalhe||'')}" placeholder="BR-153 → BR-020"></div></div>`;
  h+=`<div class="editor-section"><div class="editor-section-title"><span class="bar"></span>Postos de Abastecimento</div>`;
  fs.forEach((s,si)=>{h+=renderStopEditor(s,si)});
  h+=`<button class="add-stop-btn" onclick="addStop()">＋ Adicionar Posto</button></div>`;
  h+=`<div class="editor-section"><div class="editor-section-title"><span class="bar"></span>Destino</div>
  <div class="field"><label>Local</label><input id="ed_dest_nome" value="${esc(dest.nome)}" placeholder="Cabedelo — PB"></div>
  <div class="field"><label>Descrição</label><input id="ed_dest_cidade" value="${esc(dest.cidade)}" placeholder="Chegada ao destino"></div>
  <div class="field"><label>KM total</label><input id="ed_dest_km" value="${esc(dest.km)}" placeholder="2.450"></div></div>`;
  document.getElementById('editorContent').innerHTML=h;
}

function renderStopEditor(s,si){
  const hasAlt=!!s.alternativa;const a=s.alternativa||{};let mh='';
  if(s.marcas&&s.marcas.length){s.marcas.forEach((m,mi)=>{mh+=`<div class="marca-row"><div class="field" style="margin:0"><input value="${esc(m.marca)}" onchange="editData.paradas.filter(p=>p.tipo!=='origem'&&p.tipo!=='destino')[${si}].marcas[${mi}].marca=this.value" placeholder="Marca"></div><div class="field" style="margin:0;display:flex;gap:4px"><input value="${esc(m.litros)}" onchange="editData.paradas.filter(p=>p.tipo!=='origem'&&p.tipo!=='destino')[${si}].marcas[${mi}].litros=this.value" placeholder="Litros"><button style="background:#fe2627;color:#fff;border:none;border-radius:6px;width:32px;cursor:pointer;font-size:16px" onclick="removeMarca(${si},${mi})">✕</button></div></div>`})}
  return `<div class="stop-editor"><div class="stop-editor-head"><span class="stop-editor-num">${si+1}º Posto</span><button class="stop-editor-del" onclick="removeStop(${si})">✕</button></div>
  <div class="field"><label>Nome do posto</label><input value="${esc(s.nome)}" onchange="updateStop(${si},'nome',this.value)"></div>
  <div class="field"><label>Cidade — UF</label><input value="${esc(s.cidade)}" onchange="updateStop(${si},'cidade',this.value)"></div>
  <div class="field-row"><div class="field"><label>Tipo</label><select onchange="updateStop(${si},'tipo',this.value)"><option value="completa"${s.tipo==='completa'?' selected':''}>Completa</option><option value="parcial"${s.tipo==='parcial'?' selected':''}>Parcial</option></select></div><div class="field"><label>KM</label><input value="${esc(s.km)}" onchange="updateStop(${si},'km',this.value)"></div></div>
  <div class="field-row"><div class="field"><label>Litragem</label><input value="${esc(s.litragem)}" onchange="updateStop(${si},'litragem',this.value)"></div><div class="field"><label>Tipo de pagamento</label><select onchange="updateStop(${si},'cartao',this.value)"><option value="truckpag"${s.cartao==='truckpag'?' selected':''}>TruckPag</option><option value="shell"${s.cartao==='shell'?' selected':''}>Shell</option><option value="shell_expers"${s.cartao==='shell_expers'?' selected':''}>Shell Expers</option><option value="redefrota"${s.cartao==='redefrota'?' selected':''}>Rede Frota</option><option value="compra_antecipada"${s.cartao==='compra_antecipada'?' selected':''}>Compra Antecipada</option></select></div></div>
  <div class="field"><label>Link Google Maps</label><input value="${esc(s.link||'')}" onchange="updateStop(${si},'link',this.value)"></div>
  <div class="field"><label>Razão social</label><input value="${esc(s.razaoSocial||'')}" onchange="updateStop(${si},'razaoSocial',this.value)"></div>
  <div class="field"><label>Nota / Estratégia</label><textarea onchange="updateStop(${si},'nota',this.value)">${esc(s.nota||'')}</textarea></div>
  <div class="field"><label>Litragem por marca</label>${mh}<button class="add-marca-btn" onclick="addMarca(${si})">＋ Adicionar marca</button></div>
  <button class="alt-toggle" onclick="toggleAlt(${si})"><span class="red">OU</span> ${hasAlt?'Remover alternativo':'Adicionar alternativo'}</button>
  ${hasAlt?`<div class="alt-box"><div class="field"><label>Nome</label><input value="${esc(a.nome)}" onchange="updateAlt(${si},'nome',this.value)"></div><div class="field"><label>Cidade</label><input value="${esc(a.cidade)}" onchange="updateAlt(${si},'cidade',this.value)"></div><div class="field-row"><div class="field"><label>Litragem</label><input value="${esc(a.litragem)}" onchange="updateAlt(${si},'litragem',this.value)"></div><div class="field"><label>KM</label><input value="${esc(a.km)}" onchange="updateAlt(${si},'km',this.value)"></div></div><div class="field"><label>Tipo de pagamento</label><select onchange="updateAlt(${si},'cartao',this.value)"><option value="truckpag"${a.cartao==='truckpag'?' selected':''}>TruckPag</option><option value="shell"${a.cartao==='shell'?' selected':''}>Shell</option><option value="shell_expers"${a.cartao==='shell_expers'?' selected':''}>Shell Expers</option><option value="redefrota"${a.cartao==='redefrota'?' selected':''}>Rede Frota</option><option value="compra_antecipada"${a.cartao==='compra_antecipada'?' selected':''}>Compra Antecipada</option></select></div><div class="field"><label>Link Maps</label><input value="${esc(a.link||'')}" onchange="updateAlt(${si},'link',this.value)"></div><div class="field"><label>Nota</label><input value="${esc(a.nota||'')}" onchange="updateAlt(${si},'nota',this.value)"></div></div>`:''}</div>`
}

function getFuelStops(){return editData.paradas.filter(p=>p.tipo!=='origem'&&p.tipo!=='destino')}
function updateStop(si,k,v){getFuelStops()[si][k]=v}
function updateAlt(si,k,v){const s=getFuelStops()[si];if(s.alternativa)s.alternativa[k]=v}
function toggleAlt(si){const s=getFuelStops()[si];if(s.alternativa)delete s.alternativa;else s.alternativa={nome:'',cidade:'',litragem:'',cartao:s.cartao,km:'',nota:'',link:''};renderEditor()}
function addMarca(si){const s=getFuelStops()[si];if(!s.marcas)s.marcas=[];s.marcas.push({marca:'',litros:''});renderEditor()}
function removeMarca(si,mi){getFuelStops()[si].marcas.splice(mi,1);renderEditor()}
function addStop(){const fs=getFuelStops();const o=fs.length?Math.max(...fs.map(s=>s.ordem))+1:1;editData.paradas.splice(editData.paradas.length-1,0,{ordem:o,tipo:'completa',nome:'',cidade:'',litragem:'Completa o tanque',cartao:'truckpag',km:'',link:''});renderEditor()}
function removeStop(si){const s=getFuelStops()[si];editData.paradas.splice(editData.paradas.indexOf(s),1);renderEditor()}

function _diffRoute(oldR,newR){
  const msgs=[];
  const oldStops=(oldR.paradas||[]).filter(p=>p.tipo!=='origem'&&p.tipo!=='destino');
  const newStops=(newR.paradas||[]).filter(p=>p.tipo!=='origem'&&p.tipo!=='destino');
  const key=p=>(p.nome||'').trim()+'|'+(p.cidade||'').trim();
  oldStops.forEach(os=>{if(!newStops.some(ns=>key(ns)===key(os)))msgs.push({type:'alert',msg:'Posto removido: '+(os.nome||os.cidade||'#'+os.ordem)});});
  newStops.forEach(ns=>{if(!oldStops.some(os=>key(os)===key(ns)))msgs.push({type:'new',msg:'Posto adicionado: '+(ns.nome||ns.cidade||'#'+ns.ordem)});});
  oldStops.forEach(os=>{
    const ns=newStops.find(s=>key(s)===key(os));if(!ns)return;
    if(['litragem','cartao','km','nota','link'].some(f=>os[f]!==ns[f]))msgs.push({type:'edit',msg:'Posto alterado: '+(os.nome||os.cidade)});
  });
  if(['nome','distancia','tempo','estados','observacao'].some(f=>oldR[f]!==newR[f]))msgs.push({type:'edit',msg:'Dados gerais da rota atualizados'});
  return msgs;
}

function saveRoute(){captureEditorFields();
  editData.subtitulo='Rota '+editData.numero;editData.id=editData.nome.toLowerCase().replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-');
  let ord=1;editData.paradas.forEach(p=>{if(p.tipo!=='origem'&&p.tipo!=='destino')p.ordem=ord++});
  const isNew=editingIndex<0;
  const oldRoute=(!isNew&&editingIndex>=0)?JSON.parse(JSON.stringify(routes[editingIndex])):null;
  if(editingIndex>=0)routes[editingIndex]=editData;else routes.push(editData);
  clearDraft();isEditing=false;if(window._draftInterval)clearInterval(window._draftInterval);
  saveToFirebase();
  if(isNew){
    pushNotification('new',editData.nome,'Nova rota adicionada');
  }else if(oldRoute){
    const diffs=_diffRoute(oldRoute,editData);
    if(diffs.length>0){diffs.forEach(d=>pushNotification(d.type,editData.nome,d.msg));}
    else{pushNotification('edit',editData.nome,'Rota atualizada');}
  }
  navPop(()=>renderAdmin());
}

function cancelEdit(){
  saveDraft();
  const ov=document.createElement('div');ov.className='confirm-overlay';
  ov.innerHTML=`<div class="confirm-box"><h3>Sair da edição?</h3><p>Seu rascunho foi salvo automaticamente.</p><div class="btns"><button style="background:#eae8e3;color:#1c1c1c" onclick="clearDraft();this.closest('.confirm-overlay').remove();navPop(()=>renderAdmin())">Descartar</button><button style="background:#fe2627;color:#fff" onclick="this.closest('.confirm-overlay').remove();navPop(()=>renderAdmin())">Manter rascunho</button></div></div>`;
  document.body.appendChild(ov);
}
