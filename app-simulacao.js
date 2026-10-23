// ═══ SIMULAÇÃO DE ABASTECIMENTO (somente admin — fase de teste) ═══
// Lê as rotas direto de `routes` (rota nova cadastrada aparece aqui sozinha),
// os preços de /precos/{chave do posto} e as placas de /simVeiculos/{placa}.
// Não altera as rotas, os postos nem os informativos existentes.
var simPrecos = {};      // { chave: {nome, valor, data, por} }
var simVeiculos = {};    // { placaKey: {placa, modelo, tanque, media, reserva, ts} }
var _simView = 'list';   // 'list' | 'plan'
var _simRouteId = null;
var _simSearch = '';
var _simAlt = {};        // { routeId: { ordem: 'A'|'B' } } — escolha da alternativa no plano
var _simCfg = (function(){try{return JSON.parse(localStorage.getItem('sim_cfg')||'{}')||{};}catch(e){return {};}})();
var _simListenersOn = false;

const _SIM_STALE_DIAS = 3; // preço com mais de 3 dias fica destacado

// ─── permissões / helpers ───
function _simIsAdmin(){return !!(adminMode&&!currentDriver);}
function _simE(s){return String(s==null?'':s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function _simNorm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();}
// Mesma regra de deduplicação da tela de Postos (nome normalizado), em formato aceito como chave do Firebase
function simPostoKey(nome){return _simNorm(nome).replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,120)||'sem_nome';}
function _simNum(v){
  if(v==null)return NaN;
  if(typeof v==='number')return v;
  let s=String(v).trim().replace(/\s/g,'');
  if(!s)return NaN;
  // "6,19" → 6.19 · "1.400" → 1400 · "2.450,5" → 2450.5
  if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');
  else if(/^\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,'');
  const n=parseFloat(s.replace(/[^\d.\-]/g,''));
  return isNaN(n)?NaN:n;
}
function _simKm(v){
  const s=String(v==null?'':v);
  if(!/\d/.test(s))return NaN;
  const n=parseInt(s.replace(/[^\d]/g,''),10); // km nas rotas é sempre inteiro ("1.400", "~900 km")
  return isNaN(n)?NaN:n;
}
function _simFmtL(n){return Math.round(n).toLocaleString('pt-BR')+' L';}
function _simFmtR(n){return 'R$ '+(Math.round(n*100)/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});}
function _simFmtP(n){return 'R$ '+n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:3});}
function _simFmtData(ts){
  if(!ts)return '';
  const d=new Date(ts);
  return d.toLocaleDateString('pt-BR')+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
}
function _simDias(ts){return ts?Math.floor((Date.now()-ts)/86400000):Infinity;}
function _simPlacaKey(p){return String(p||'').toUpperCase().replace(/[^A-Z0-9]/g,'');}
function _simSaveCfg(){try{localStorage.setItem('sim_cfg',JSON.stringify(_simCfg));}catch(e){}}
function simGetPreco(nome){return simPrecos[simPostoKey(nome)]||null;}

// ─── listeners (ligados em _attachDataListeners, só para admin) ───
function simAttachListeners(){
  if(!db||_simListenersOn)return;
  _simListenersOn=true;
  db.ref('precos').on('value',snap=>{
    simPrecos=snap.val()||{};
    simOnData();
    if(typeof renderPostosList==='function'&&typeof _postosVisivel==='function'&&_postosVisivel())renderPostosList();
  },err=>{console.warn('precos listener err:',err);_simListenersOn=false;});
  db.ref('simVeiculos').on('value',snap=>{simVeiculos=snap.val()||{};simOnData();},err=>{console.warn('simVeiculos listener err:',err);});
}
function simDetachListeners(){
  if(!db)return;
  try{db.ref('precos').off();}catch(e){}
  try{db.ref('simVeiculos').off();}catch(e){}
  _simListenersOn=false;
}
function _simVisivel(){return typeof _navStack!=='undefined'&&_navStack[_navStack.length-1]==='screenSimulacao';}
// Chamado quando rotas, preços ou placas mudam no Firebase
function simOnData(){if(_simVisivel())renderSimulacao();}

// ─── visibilidade do botão (barra inferior + sidebar web) ───
function simSyncNav(){
  const on=_simIsAdmin();
  const b=document.getElementById('bnavSimulacao');if(b)b.style.display=on?'':'none';
  const d=document.getElementById('dsbNavSim');if(d)d.style.display=on?'':'none';
}

// ─── navegação ───
function showSimulacao(){
  if(!_simIsAdmin()){showToast('Simulação disponível só para o admin','#c2410c');return;}
  simAttachListeners();
  _simView='list';
  navPush('screenSimulacao');
  renderSimulacao();
  updateBottomNav('Simulacao');
  const m=document.querySelector('#screenSimulacao .sim-main');if(m)m.scrollTop=0;
}
function bnavGoSimulacao(){
  const top=_navStack[_navStack.length-1];
  if(top==='screenSimulacao'){if(_simView!=='list'){_simView='list';renderSimulacao();}updateBottomNav('Simulacao');return;}
  if(top!=='screenHome'){window._homeInstant=true;try{showHome();}finally{window._homeInstant=false;}}
  showSimulacao();
}
function simOpenRoute(id){_simRouteId=id;_simView='plan';renderSimulacao();const m=document.querySelector('#screenSimulacao .sim-main');if(m)m.scrollTop=0;}
function simBack(){
  if(_simView==='plan'){_simView='list';renderSimulacao();return;}
  if(IS_DESKTOP()&&typeof dNavGo==='function'){dNavGo('rotas');return;}
  bnavGoRotas();
}
function simSetSearch(v){_simSearch=String(v||'');_simRenderRouteList();}

// ─── veículo selecionado / parâmetros ───
function _simVeicList(){return Object.entries(simVeiculos||{}).map(([k,v])=>Object.assign({_k:k},v)).sort((a,b)=>String(a.placa).localeCompare(String(b.placa)));}
function _simVeic(){
  const list=_simVeicList();
  if(!list.length)return null;
  return list.find(v=>v._k===_simCfg.placa)||list[0];
}
function _simParams(){
  const v=_simVeic();
  const tanque=v?_simNum(v.tanque):NaN;
  const reservaPad=v&&!isNaN(_simNum(v.reserva))?_simNum(v.reserva):80;
  const p={
    veic:v,
    tanque:!isNaN(_simNum(_simCfg.tanque))?_simNum(_simCfg.tanque):tanque,
    media:!isNaN(_simNum(_simCfg.media))?_simNum(_simCfg.media):(v?_simNum(v.media):NaN),
    reserva:!isNaN(_simNum(_simCfg.reserva))?_simNum(_simCfg.reserva):reservaPad,
  };
  p.saida=!isNaN(_simNum(_simCfg.saida))?_simNum(_simCfg.saida):(isNaN(p.tanque)?NaN:Math.round(p.tanque*0.25/10)*10);
  p.chegada=!isNaN(_simNum(_simCfg.chegada))?_simNum(_simCfg.chegada):p.reserva;
  return p;
}
function simPickPlaca(k){
  _simCfg.placa=k;
  // ao trocar de placa volta a usar tanque/média/reserva cadastrados
  delete _simCfg.tanque;delete _simCfg.media;delete _simCfg.reserva;delete _simCfg.saida;delete _simCfg.chegada;
  _simSaveCfg();renderSimulacao();
}
function simSetParam(campo,val){
  const n=_simNum(val);
  if(String(val).trim()===''||isNaN(n))delete _simCfg[campo];else _simCfg[campo]=n;
  _simSaveCfg();
  if(_simView==='plan')_simRenderPlanBody();
}
function simResetParams(){['tanque','media','reserva','saida','chegada'].forEach(k=>delete _simCfg[k]);_simSaveCfg();renderSimulacao();}
function simPickAlt(ordem,k){
  const r=routes.find(x=>x.id===_simRouteId);if(!r)return;
  (_simAlt[r.id]=_simAlt[r.id]||{})[ordem]=k;
  _simRenderPlanBody();
}

// ─── pontos de abastecimento da rota (em ordem de KM) ───
function _simStations(r){
  const paradas=(r.paradas||[]).slice().sort((a,b)=>(a.ordem||0)-(b.ordem||0));
  const destino=paradas.find(p=>p.tipo==='destino');
  let D=destino?_simKm(destino.km):NaN;
  if(isNaN(D))D=_simKm(r.distancia);
  const pick=_simAlt[r.id]||{};
  const st=[],semKm=[];
  paradas.forEach(p=>{
    if(p.tipo==='origem'||p.tipo==='destino')return;
    const usarB=p.alternativa&&pick[p.ordem]==='B';
    const o=usarB?p.alternativa:p;
    const km=_simKm(o.km);
    const pr=simGetPreco(o.nome);
    const item={ordem:p.ordem,nome:o.nome,cidade:o.cidade||'',cartao:o.cartao||p.cartao||'',km,
      preco:pr&&!isNaN(_simNum(pr.valor))?_simNum(pr.valor):NaN,precoData:pr?pr.data:0,
      litragem:o.litragem||p.litragem||'',temAlt:!!p.alternativa,alt:usarB?'B':'A',
      altNome:p.alternativa?(usarB?p.nome:p.alternativa.nome):''};
    if(isNaN(km))semKm.push(item);else st.push(item);
  });
  st.sort((a,b)=>a.km-b.km);
  return {st,semKm,D,origem:paradas.find(p=>p.tipo==='origem'),destino};
}

// ─── cálculo do plano ───
// Regra clássica do "problema do posto": em cada posto, se houver um mais barato
// ao alcance do tanque, abastece só o necessário para chegar nele com a reserva;
// se não houver, abastece o necessário para fechar a rota (ou completa o tanque).
// Posto sem preço cadastrado é tratado como o mais caro (só abastece se precisar).
function simCalcPlan(r,p){
  const {st,semKm,D,origem,destino}=_simStations(r);
  const C=p.tanque,m=p.media,R=p.reserva,Rd=p.chegada;
  const res={ok:false,erros:[],avisos:[],passos:[],D,st,semKm,origem,destino};
  if(!p.veic)res.erros.push('Cadastre uma placa para simular.');
  if(isNaN(C)||C<=0)res.erros.push('Informe o tamanho do tanque (L).');
  if(isNaN(m)||m<=0)res.erros.push('Informe a média do veículo (km/L).');
  if(isNaN(D)||D<=0)res.erros.push('A rota não tem o KM de chegada cadastrado.');
  if(isNaN(p.saida)||p.saida<0)res.erros.push('Informe o combustível na saída (L).');
  if(!isNaN(C)&&!isNaN(R)&&R>=C)res.erros.push('A reserva precisa ser menor que o tanque.');
  if(res.erros.length)return res;
  if(p.saida>C)res.avisos.push('Combustível na saída maior que o tanque — considerado tanque cheio.');
  semKm.forEach(s=>res.avisos.push(`“${s.nome}” está sem KM na rota e ficou fora do cálculo.`));

  const preco=s=>isNaN(s.preco)?Infinity:s.preco;
  const alcance=(C-R)*m; // km rodados com tanque cheio até a reserva
  const pts=st.filter(s=>s.km>=0&&s.km<D);
  st.filter(s=>s.km>=D).forEach(s=>res.avisos.push(`“${s.nome}” (KM ${s.km}) está depois do KM de chegada e ficou fora do cálculo.`));

  let fuel=Math.min(p.saida,C),kmAtual=0,litros=0,custo=0,litrosSemPreco=0;
  // trechos maiores que a autonomia
  const marcos=[0].concat(pts.map(s=>s.km),[D]);
  for(let i=1;i<marcos.length;i++){
    const gap=marcos[i]-marcos[i-1];
    if(gap>alcance+0.5){
      const de=i===1?'a origem':'“'+pts[i-2].nome+'”';
      const ate=i===marcos.length-1?'o destino':'“'+pts[i-1].nome+'”';
      res.avisos.push(`O trecho entre ${de} e ${ate} tem ${gap.toLocaleString('pt-BR')} km, mais que a autonomia (${Math.floor(alcance).toLocaleString('pt-BR')} km com tanque cheio até a reserva).`);
    }
  }

  pts.forEach((s,i)=>{
    const chegada=fuel-(s.km-kmAtual)/m;
    const lim=s.km+alcance;
    let alvo,motivo;
    const maisBarato=pts.slice(i+1).find(o=>o.km<=lim&&preco(o)<preco(s));
    if(maisBarato){
      alvo=(maisBarato.km-s.km)/m+R;
      motivo=isNaN(s.preco)
        ?`Sem preço cadastrado — abastece só para chegar em “${maisBarato.nome}” (KM ${maisBarato.km}).`
        :`“${maisBarato.nome}” (KM ${maisBarato.km}) é mais barato${isFinite(preco(maisBarato))?' ('+_simFmtP(maisBarato.preco)+')':''} — abastece só para chegar lá com a reserva.`;
    }else if(D<=lim){
      alvo=(D-s.km)/m+Rd;
      motivo=isNaN(s.preco)?'Sem preço cadastrado e sem posto mais barato à frente — abastece só o que falta para fechar a rota.':'Melhor preço daqui até o destino — abastece o necessário para fechar a rota.';
    }else{
      alvo=C;
      motivo=isNaN(s.preco)?'Sem preço cadastrado, mas não há posto mais barato ao alcance — completa o tanque.':'Melhor preço ao alcance do tanque — completa.';
    }
    const espaco=Math.max(0,C-Math.max(chegada,0));
    let compra=Math.max(0,alvo-Math.max(chegada,0));
    if(compra>0)compra=Math.min(espaco,Math.ceil(compra/10)*10); // arredonda para 10 L
    const completa=compra>0&&compra>=espaco-5;
    if(compra===0)motivo=chegada>=alvo?'O que já tem no tanque basta até o próximo ponto mais vantajoso.':motivo;
    const saida=Math.max(chegada,0)+compra;
    const passo={...s,chegada,compra,saida,completa,motivo,custo:isNaN(s.preco)?NaN:compra*s.preco,
      abaixoReserva:chegada<R-0.5,seco:chegada<0};
    if(passo.seco)res.avisos.push(`Chega em “${s.nome}” sem combustível (faltam ${_simFmtL(-chegada)}).`);
    litros+=compra;
    if(isNaN(s.preco))litrosSemPreco+=compra;else custo+=compra*s.preco;
    res.passos.push(passo);
    fuel=saida;kmAtual=s.km;
  });
  const chegadaFinal=fuel-(D-kmAtual)/m;
  if(chegadaFinal<0)res.avisos.push(`Chega no destino sem combustível (faltam ${_simFmtL(-chegadaFinal)}).`);
  else if(chegadaFinal<Rd-0.5)res.avisos.push(`Chega no destino com ${_simFmtL(chegadaFinal)}, abaixo dos ${_simFmtL(Rd)} pedidos.`);

  // economia: mesmos litros comprados pelo preço médio dos postos da rota
  const comPreco=pts.filter(s=>!isNaN(s.preco));
  const media=comPreco.length>=2?comPreco.reduce((a,s)=>a+s.preco,0)/comPreco.length:NaN;
  const litrosComPreco=litros-litrosSemPreco;
  res.ok=true;
  Object.assign(res,{litros,custo,litrosSemPreco,chegadaFinal,precoMedio:media,
    custoMedio:isNaN(media)?NaN:litrosComPreco*media,
    consumoTotal:D/m,alcance,postosSemPreco:pts.filter(s=>isNaN(s.preco)).length});
  res.economia=isNaN(res.custoMedio)?NaN:res.custoMedio-custo;
  return res;
}

// ─── render ───
const _SIM_SVG={
  back:'<i class="ti ti-chevron-left" aria-hidden="true"></i>',
  chev:'<i class="ti ti-chevron-right" aria-hidden="true"></i>'
};
function renderSimulacao(){
  const el=document.getElementById('simulacaoContent');if(!el)return;
  if(!_simIsAdmin()){el.innerHTML='';return;}
  const v=_simVeic();
  const nPrecos=Object.keys(simPrecos||{}).length;
  const isPlan=_simView==='plan'&&routes.some(r=>r.id===_simRouteId);
  if(!isPlan)_simView='list';
  const r=isPlan?routes.find(x=>x.id===_simRouteId):null;
  el.innerHTML=`<header class="sim-hero">
      <svg class="sim-hero-road" width="390" height="200" viewBox="0 0 390 200" aria-hidden="true"><path d="M250 200 L330 0" stroke="#2f2f2d" stroke-width="70"/><path d="M290 200 L370 0" stroke="#fe2627" stroke-width="3" stroke-dasharray="16 14"/></svg>
      <div class="sim-hero-row">
        <button class="sim-hero-back" onclick="simBack()" aria-label="Voltar">${_SIM_SVG.back}</button>
        <span class="sim-hero-kicker">SIMULAÇÃO · SÓ ADMIN (TESTE)</span>
      </div>
      <h1 class="sim-hero-title">${isPlan?_simE(r.nome):'Simulação de<br>abastecimento'}</h1>
      ${isPlan?`<div class="sim-hero-sub">Rota ${_simE(r.numero||'')} · ${_simE(r.estados||'')}</div>`:''}
      <div class="sim-hero-stats">
        <div class="sim-stat"><div class="sim-stat-n">${routes.length}</div><div class="sim-stat-l">ROTAS</div></div>
        <div class="sim-stat"><div class="sim-stat-n">${_simVeicList().length}</div><div class="sim-stat-l">PLACAS</div></div>
        <div class="sim-stat"><div class="sim-stat-n">${nPrecos}</div><div class="sim-stat-l">PREÇOS</div></div>
      </div>
    </header>
    <main class="sim-main">
      <section class="sim-veic">
        <div class="sim-sec-head"><span class="sim-sec-label">VEÍCULO</span><button class="sim-link" onclick="simShowVeiculos()"><i class="ti ti-truck" aria-hidden="true"></i>Gerenciar placas</button></div>
        ${_simVeicPicker(v)}
      </section>
      ${isPlan?`<div id="simPlan"></div>`:`<div class="sim-sec-head"><span class="sim-sec-label">ESCOLHA A ROTA</span><span class="sim-sec-n">${routes.length}</span></div>
      <label class="sim-search"><i class="ti ti-search" aria-hidden="true"></i><input type="search" placeholder="Buscar rota, cidade ou posto" aria-label="Buscar rota" autocomplete="off" value="${_simE(_simSearch)}" oninput="simSetSearch(this.value)"></label>
      <div id="simRouteList"></div>`}
    </main>`;
  if(isPlan)_simRenderPlan(r);else _simRenderRouteList();
  if(typeof _dSyncNav==='function'&&IS_DESKTOP())_dSyncNav();
}

function _simVeicPicker(v){
  const list=_simVeicList();
  if(!list.length)return `<button class="sim-empty-veic" onclick="simShowVeiculoForm()"><i class="ti ti-plus" aria-hidden="true"></i><span><strong>Cadastre a primeira placa</strong><br>placa, tamanho do tanque e média (km/L)</span></button>`;
  return `<div class="sim-placas" role="group" aria-label="Escolher placa">${list.map(x=>{
    const on=v&&x._k===v._k;
    return `<button type="button" class="sim-placa${on?' on':''}" aria-pressed="${on}" onclick="simPickPlaca('${_simE(x._k)}')"><span class="sim-placa-n">${_simE(x.placa)}</span><span class="sim-placa-d">${isNaN(_simNum(x.tanque))?'— L':_simE(x.tanque)+' L'} · ${isNaN(_simNum(x.media))?'—':String(x.media).replace('.',',')} km/L</span></button>`;
  }).join('')}</div>`;
}

function _simRenderRouteList(){
  const el=document.getElementById('simRouteList');if(!el)return;
  const q=_simNorm(_simSearch);
  const list=routes.map((r,i)=>({r,i}))
    .filter(({r})=>!q||_simNorm(typeof searchText==='function'?searchText(r):r.nome).includes(q))
    .sort((a,b)=>{const ra=typeof _regIdx==='function'?_regIdx(a.r.regiao||'Outras')-_regIdx(b.r.regiao||'Outras'):0;return ra||String(a.r.numero||'').localeCompare(String(b.r.numero||''),'pt-BR',{numeric:true});});
  if(!list.length){el.innerHTML=`<div class="sim-empty"><i class="ti ti-route-off" aria-hidden="true"></i><div>Nenhuma rota encontrada</div></div>`;return;}
  el.innerHTML=list.map(({r})=>{
    const {st}=_simStations(r);
    const comPreco=st.filter(s=>!isNaN(s.preco)).length;
    const pill=st.length===0?`<span class="sim-pill sim-pill--mut">Sem postos</span>`
      :comPreco===st.length?`<span class="sim-pill sim-pill--ok">Preços completos</span>`
      :`<span class="sim-pill sim-pill--warn">${comPreco}/${st.length} com preço</span>`;
    return `<div class="rcard hm-card sim-rcard" role="button" tabindex="0" onclick="simOpenRoute('${_simE(r.id)}')" onkeydown="if(event.key==='Enter')simOpenRoute('${_simE(r.id)}')">`
      +`<div class="rcard-uf hm-num"><span class="hm-num-lbl">ROTA</span><span class="hm-num-val">${_simE(r.numero)}</span></div>`
      +`<div class="rcard-info"><div class="rcard-nome">${_simE(r.nome)}</div><div class="rcard-detail">${_simE(r.estados||'')}${r.distancia?' · '+_simE(r.distancia):''}</div>`
      +`<div class="sim-rcard-meta"><span><i class="ti ti-gas-station" aria-hidden="true"></i>${st.length} posto${st.length!==1?'s':''}</span>${pill}</div></div>`
      +`<div class="rcard-arrow">${_SIM_SVG.chev}</div></div>`;
  }).join('');
}

function _simRenderPlan(r){
  const el=document.getElementById('simPlan');if(!el)return;
  const p=_simParams();
  const fld=(campo,label,val,suf,step)=>`<label class="sim-fld"><span>${label}</span><div class="sim-fld-in"><input type="text" inputmode="decimal" value="${isNaN(val)?'':String(Math.round(val*100)/100).replace('.',',')}" onchange="simSetParam('${campo}',this.value)" aria-label="${label}"><em>${suf}</em></div></label>`;
  el.innerHTML=`<section class="sim-params">
      <div class="sim-sec-head"><span class="sim-sec-label">PARÂMETROS DA SIMULAÇÃO</span><button class="sim-link" onclick="simResetParams()"><i class="ti ti-refresh" aria-hidden="true"></i>Restaurar</button></div>
      <div class="sim-fld-grid">
        ${fld('tanque','Tanque',p.tanque,'L')}
        ${fld('media','Média',p.media,'km/L')}
        ${fld('saida','Saída com',p.saida,'L')}
        ${fld('reserva','Reserva mínima',p.reserva,'L')}
        ${fld('chegada','Chegar no destino com',p.chegada,'L')}
      </div>
      <div class="sim-fld-hint">Os valores da placa vêm do cadastro. Alterar aqui vale só para esta simulação.</div>
    </section>
    <div id="simPlanBody"></div>`;
  _simRenderPlanBody();
}

function _simRenderPlanBody(){
  const el=document.getElementById('simPlanBody');if(!el)return;
  const r=routes.find(x=>x.id===_simRouteId);if(!r){el.innerHTML='';return;}
  const p=_simParams();
  const res=simCalcPlan(r,p);
  if(!res.ok){
    el.innerHTML=`<div class="sim-alert sim-alert--err"><i class="ti ti-alert-triangle" aria-hidden="true"></i><div>${res.erros.map(_simE).join('<br>')}</div></div>`;
    return;
  }
  const kpi=(n,l,cls)=>`<div class="sim-kpi${cls?' '+cls:''}"><div class="sim-kpi-n">${n}</div><div class="sim-kpi-l">${l}</div></div>`;
  let h=`<section class="sim-sum">
    <div class="sim-kpis">
      ${kpi(res.D.toLocaleString('pt-BR')+' km','DISTÂNCIA')}
      ${kpi(_simFmtL(res.consumoTotal),'CONSUMO PREVISTO')}
      ${kpi(_simFmtL(res.litros),'A ABASTECER')}
      ${kpi(res.custo>0||res.litrosSemPreco===0?_simFmtR(res.custo):'—','CUSTO DO PLANO'+(res.litrosSemPreco>0?' *':''))}
      ${isNaN(res.economia)?'':kpi(_simFmtR(res.economia),'ECONOMIA VS. MÉDIA',res.economia>=0?'sim-kpi--ok':'sim-kpi--warn')}
      ${kpi(_simFmtL(Math.max(res.chegadaFinal,0)),'CHEGA COM')}
    </div>
    ${res.litrosSemPreco>0?`<div class="sim-foot">* ${_simFmtL(res.litrosSemPreco)} em posto sem preço não entram no custo.</div>`:''}
    ${!isNaN(res.precoMedio)?`<div class="sim-foot">Economia comparada aos mesmos litros pelo preço médio dos postos da rota (${_simFmtP(res.precoMedio)}/L). Autonomia: ${Math.floor(res.alcance).toLocaleString('pt-BR')} km de tanque cheio até a reserva.</div>`:''}
  </section>`;
  if(res.avisos.length)h+=`<div class="sim-alert"><i class="ti ti-alert-triangle" aria-hidden="true"></i><div>${res.avisos.map(_simE).join('<br>')}</div></div>`;
  if(res.postosSemPreco>0)h+=`<div class="sim-alert sim-alert--info"><i class="ti ti-info-circle" aria-hidden="true"></i><div>${res.postosSemPreco} posto${res.postosSemPreco>1?'s':''} sem preço. Toque em “Preço” no posto para lançar e o plano é recalculado.</div></div>`;

  h+=`<div class="sim-sec-head"><span class="sim-sec-label">PLANO POR POSTO</span></div><ol class="sim-tl">`;
  const o=res.origem;
  h+=`<li class="sim-tl-item sim-tl-end"><span class="sim-tl-dot"><i class="ti ti-flag" aria-hidden="true"></i></span><div class="sim-tl-body"><div class="sim-tl-kick">KM 0 · SAÍDA</div><div class="sim-tl-nome">${_simE(o?o.nome:'Origem')}</div><div class="sim-tl-sub">Sai com ${_simFmtL(Math.min(p.saida,p.tanque))} no tanque</div></div></li>`;
  res.passos.forEach(s=>{
    const dias=_simDias(s.precoData);
    const precoHtml=isNaN(s.preco)
      ?`<span class="sim-preco sim-preco--none">Sem preço</span>`
      :`<span class="sim-preco${dias>_SIM_STALE_DIAS?' sim-preco--old':''}">${_simFmtP(s.preco)}/L<small>${s.precoData?'lançado em '+_simFmtData(s.precoData):''}</small></span>`;
    const acao=s.compra<=0?`<div class="sim-acao sim-acao--no"><i class="ti ti-circle-x" aria-hidden="true"></i>Não abastecer aqui</div>`
      :s.completa?`<div class="sim-acao sim-acao--full"><i class="ti ti-gas-station" aria-hidden="true"></i>Complete o tanque <b>(~${_simFmtL(s.compra)})</b></div>`
      :`<div class="sim-acao"><i class="ti ti-gas-station" aria-hidden="true"></i>Abasteça <b>${_simFmtL(s.compra)}</b></div>`;
    const alt=s.temAlt?`<div class="sim-seg" role="group" aria-label="Posto da parada"><button type="button" aria-pressed="${s.alt==='A'}" onclick="simPickAlt(${s.ordem},'A')">Opção A</button><button type="button" aria-pressed="${s.alt==='B'}" onclick="simPickAlt(${s.ordem},'B')">Opção B</button><span>${s.alt==='A'?'B':'A'}: ${_simE(s.altNome)}</span></div>`:'';
    const nEnc=encodeURIComponent(s.nome||'');
    h+=`<li class="sim-tl-item${s.compra>0?' sim-tl-buy':''}"><span class="sim-tl-dot">${_simE(s.ordem)}</span><div class="sim-tl-body sim-card">
      <div class="sim-card-top"><div><div class="sim-tl-kick">KM ${s.km.toLocaleString('pt-BR')}${s.cartao&&typeof getCartaoLabel==='function'?' · '+_simE(getCartaoLabel(s.cartao)):''}</div><div class="sim-tl-nome">${_simE(s.nome)}</div><div class="sim-tl-sub">${_simE(s.cidade)}</div></div>
      <button class="sim-preco-btn" onclick="simShowPrecoForm('${nEnc}')" aria-label="Lançar preço de ${_simE(s.nome)}"><i class="ti ti-currency-real" aria-hidden="true"></i>Preço</button></div>
      ${alt}
      <div class="sim-card-mid">${precoHtml}${acao}</div>
      <div class="sim-nums"><span>Chega com <b class="${s.abaixoReserva?'sim-red':''}">${_simFmtL(Math.max(s.chegada,0))}</b></span><span>Sai com <b>${_simFmtL(s.saida)}</b></span>${!isNaN(s.custo)&&s.compra>0?`<span>Custo <b>${_simFmtR(s.custo)}</b></span>`:''}</div>
      <div class="sim-motivo">${_simE(s.motivo)}</div>
      ${s.litragem?`<div class="sim-rotograma"><i class="ti ti-file-text" aria-hidden="true"></i>No rotograma: ${_simE(s.litragem)}</div>`:''}
    </div></li>`;
  });
  if(!res.passos.length)h+=`<li class="sim-tl-item"><span class="sim-tl-dot">–</span><div class="sim-tl-body"><div class="sim-tl-sub">Esta rota não tem postos com KM cadastrado.</div></div></li>`;
  const d=res.destino;
  h+=`<li class="sim-tl-item sim-tl-end"><span class="sim-tl-dot"><i class="ti ti-map-pin" aria-hidden="true"></i></span><div class="sim-tl-body"><div class="sim-tl-kick">KM ${res.D.toLocaleString('pt-BR')} · CHEGADA</div><div class="sim-tl-nome">${_simE(d?d.nome:'Destino')}</div><div class="sim-tl-sub">Chega com ${_simFmtL(Math.max(res.chegadaFinal,0))}</div></div></li></ol>`;
  el.innerHTML=h;
}

// ─── folha (bottom sheet) genérica ───
function _simSheet(titulo,corpo){
  closeSimSheet();
  const ov=document.createElement('div');
  ov.className='inf-sheet-ov sim-sheet-ov';
  ov.innerHTML=`<div class="inf-sheet" role="dialog" aria-modal="true" aria-label="${_simE(titulo)}"><div class="inf-sheet-grip"></div><div class="inf-sheet-head"><div class="inf-sheet-title">${_simE(titulo)}</div><button class="inf-sheet-x" onclick="closeSimSheet()" aria-label="Fechar"><i class="ti ti-x" aria-hidden="true"></i></button></div>${corpo}</div>`;
  ov.addEventListener('click',e=>{if(e.target===ov)closeSimSheet();});
  document.body.appendChild(ov);
  return ov;
}
function closeSimSheet(){document.querySelectorAll('.sim-sheet-ov').forEach(x=>x.remove());}
function _simErr(msg){const e=document.getElementById('simSheetErr');if(e)e.textContent=msg||'';}
function _simWriteErr(e){
  const pd=String(e&&(e.code||e.message)||'').toUpperCase().includes('PERMISSION');
  return pd?'Sem permissão para gravar. As regras do banco (precos/simVeiculos) ainda precisam ser publicadas: firebase deploy --only database':'Erro ao salvar: '+(e&&e.message||e);
}

// ─── preço do posto (usado na tela de Postos e na Simulação) ───
function simShowPrecoForm(nomeEnc){
  if(!_simIsAdmin())return;
  const nome=decodeURIComponent(nomeEnc||'');
  const atual=simGetPreco(nome);
  const val=atual&&!isNaN(_simNum(atual.valor))?String(atual.valor).replace('.',','):'';
  _simSheet('Preço do diesel',`<div class="sim-sheet-posto"><i class="ti ti-gas-station" aria-hidden="true"></i>${_simE(nome)}</div>
    ${atual?`<div class="sim-sheet-info">Último preço: <b>${_simFmtP(_simNum(atual.valor))}/L</b> · lançado em ${_simE(_simFmtData(atual.data))}</div>`:'<div class="sim-sheet-info">Nenhum preço lançado ainda.</div>'}
    <label class="inf-fld"><span>PREÇO DO LITRO (R$)</span><input id="simPrecoVal" type="text" inputmode="decimal" placeholder="Ex.: 6,19" value="${_simE(val)}" autocomplete="off"></label>
    <div class="sim-sheet-info">A data e a hora do lançamento são gravadas automaticamente.</div>
    <div class="inf-sheet-err" id="simSheetErr" role="alert"></div>
    <div class="sim-sheet-btns">${atual?`<button class="sim-sheet-del" onclick="simDeletePreco('${encodeURIComponent(nome)}')"><i class="ti ti-trash" aria-hidden="true"></i>Remover</button>`:''}<button class="inf-sheet-save" onclick="simSavePreco('${encodeURIComponent(nome)}')">SALVAR PREÇO</button></div>`);
  setTimeout(()=>{const i=document.getElementById('simPrecoVal');if(i){i.focus();i.select();}},80);
}
async function simSavePreco(nomeEnc){
  const nome=decodeURIComponent(nomeEnc||'');
  const v=_simNum(document.getElementById('simPrecoVal')?.value);
  if(isNaN(v)||v<=0||v>50){_simErr('Informe um preço válido (ex.: 6,19).');return;}
  if(!db){_simErr('Sem conexão com o banco.');return;}
  const u=firebase.auth().currentUser;
  const rec={nome:String(nome).slice(0,200),valor:Math.round(v*1000)/1000,data:Date.now(),por:String(u&&u.email||'admin').slice(0,100)};
  try{
    await db.ref('precos/'+simPostoKey(nome)).set(rec);
    closeSimSheet();
    showToast('✅ Preço salvo','#1f8a3d');
  }catch(e){_simErr(_simWriteErr(e));}
}
async function simDeletePreco(nomeEnc){
  const nome=decodeURIComponent(nomeEnc||'');
  if(!db)return;
  try{await db.ref('precos/'+simPostoKey(nome)).remove();closeSimSheet();showToast('Preço removido','#5a5856');}
  catch(e){_simErr(_simWriteErr(e));}
}
// Bloco de preço no card da tela de Postos (só admin)
function simPrecoPostoHTML(nome){
  if(!_simIsAdmin())return '';
  const pr=simGetPreco(nome);
  const nEnc=encodeURIComponent(nome||'');
  if(!pr||isNaN(_simNum(pr.valor)))return `<button class="sim-pst-preco sim-pst-preco--none" onclick="simShowPrecoForm('${nEnc}')"><i class="ti ti-currency-real" aria-hidden="true"></i><span>Lançar preço do diesel</span></button>`;
  const old=_simDias(pr.data)>_SIM_STALE_DIAS;
  return `<button class="sim-pst-preco${old?' sim-pst-preco--old':''}" onclick="simShowPrecoForm('${nEnc}')"><i class="ti ti-currency-real" aria-hidden="true"></i><span><b>${_simFmtP(_simNum(pr.valor))}/L</b><small>lançado em ${_simE(_simFmtData(pr.data))}${old?' · desatualizado':''}</small></span><i class="ti ti-pencil" aria-hidden="true"></i></button>`;
}

// ─── placas ───
function simShowVeiculos(){
  const list=_simVeicList();
  _simSheet('Placas',`${list.length?`<div class="sim-vlist">${list.map(v=>`<div class="sim-vrow"><div class="sim-vrow-txt"><div class="sim-placa-n">${_simE(v.placa)}</div><div class="sim-vrow-d">${_simE(v.modelo||'')}${v.modelo?' · ':''}${_simE(v.tanque)} L · ${String(v.media).replace('.',',')} km/L · reserva ${_simE(v.reserva||80)} L</div></div><button class="inf-del inf-edit" onclick="simShowVeiculoForm('${_simE(v._k)}')" aria-label="Editar ${_simE(v.placa)}"><i class="ti ti-pencil" aria-hidden="true"></i></button><button class="inf-del" onclick="simDeleteVeiculo('${_simE(v._k)}')" aria-label="Excluir ${_simE(v.placa)}"><i class="ti ti-trash" aria-hidden="true"></i></button></div>`).join('')}</div>`:'<div class="sim-sheet-info">Nenhuma placa cadastrada.</div>'}
    <div class="inf-sheet-err" id="simSheetErr" role="alert"></div>
    <button class="inf-sheet-save" onclick="simShowVeiculoForm()">+ NOVA PLACA</button>`);
}
function simShowVeiculoForm(k){
  const v=k?simVeiculos[k]:null;
  const f=(id,label,val,ph,mode)=>`<label class="inf-fld"><span>${label}</span><input id="${id}" type="text" ${mode?`inputmode="${mode}"`:''} placeholder="${ph}" value="${_simE(val==null?'':String(val).replace(/^(\d+)\.(\d+)$/,'$1,$2'))}" autocomplete="off"></label>`;
  _simSheet(v?'Editar placa':'Nova placa',
    f('simVPlaca','PLACA',v?v.placa:'','ABC-1D23')
    +f('simVModelo','MODELO (OPCIONAL)',v?v.modelo:'','Ex.: Scania R 450 6x2')
    +`<div class="sim-fld2">${f('simVTanque','TANQUE (L)',v?v.tanque:'','Ex.: 700','numeric')}${f('simVMedia','MÉDIA (KM/L)',v?v.media:'','Ex.: 2,45','decimal')}</div>`
    +f('simVReserva','RESERVA MÍNIMA (L)',v?v.reserva:80,'80','numeric')
    +`<div class="inf-sheet-err" id="simSheetErr" role="alert"></div><button class="inf-sheet-save" onclick="simSaveVeiculo('${_simE(k||'')}')">SALVAR PLACA</button>`);
}
async function simSaveVeiculo(oldK){
  const g=id=>(document.getElementById(id)?.value||'').trim();
  const placa=g('simVPlaca').toUpperCase();
  const k=_simPlacaKey(placa);
  const tanque=_simNum(g('simVTanque')),media=_simNum(g('simVMedia'));
  const reservaIn=g('simVReserva'),reserva=reservaIn?_simNum(reservaIn):80;
  if(k.length<7){_simErr('Informe a placa (ex.: ABC-1D23).');return;}
  if(isNaN(tanque)||tanque<50||tanque>3000){_simErr('Informe o tanque em litros (entre 50 e 3000).');return;}
  if(isNaN(media)||media<=0||media>10){_simErr('Informe a média em km/L (ex.: 2,45).');return;}
  if(isNaN(reserva)||reserva<0||reserva>=tanque){_simErr('A reserva precisa ser menor que o tanque.');return;}
  if(!db){_simErr('Sem conexão com o banco.');return;}
  const rec={placa:placa.slice(0,10),modelo:g('simVModelo').slice(0,80),tanque:Math.round(tanque),media:Math.round(media*100)/100,reserva:Math.round(reserva),ts:Date.now()};
  try{
    if(oldK&&oldK!==k)await db.ref('simVeiculos/'+oldK).remove();
    await db.ref('simVeiculos/'+k).set(rec);
    if(!_simCfg.placa||_simCfg.placa===oldK){_simCfg.placa=k;}
    ['tanque','media','reserva','saida','chegada'].forEach(c=>delete _simCfg[c]);
    _simSaveCfg();
    closeSimSheet();showToast('✅ Placa salva','#1f8a3d');
    renderSimulacao();
  }catch(e){_simErr(_simWriteErr(e));}
}
function simDeleteVeiculo(k){
  const v=simVeiculos[k];if(!v)return;
  _simSheet('Excluir placa?',`<div class="sim-sheet-info">A placa <b>${_simE(v.placa)}</b> será removida da simulação.</div><div class="inf-sheet-err" id="simSheetErr" role="alert"></div><div class="sim-sheet-btns"><button class="sim-sheet-del" onclick="simShowVeiculos()">Cancelar</button><button class="inf-sheet-save" onclick="simConfirmDeleteVeiculo('${_simE(k)}')">EXCLUIR</button></div>`);
}
async function simConfirmDeleteVeiculo(k){
  try{await db.ref('simVeiculos/'+k).remove();if(_simCfg.placa===k){delete _simCfg.placa;_simSaveCfg();}simShowVeiculos();}
  catch(e){_simErr(_simWriteErr(e));}
}
