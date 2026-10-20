// ═══ SEARCH ═══
function searchText(r){const p=[r.nome,r.estados,r.subtitulo,r.numero,r.regiao||''];for(const s of r.paradas)p.push(s.nome,s.cidade,s.cartao||'',s.razaoSocial||'');return p.join(' ')}





// ═══ RENDER ROUTE ═══
// ═══ ROTA ABERTA v2 (mockup aprovado 20/10/2026: cartões de posto recolhíveis + seletor A/B) ═══
function _rtE(s){return esc(String(s==null?'':s))}
function _rtBadge(c){const v=(typeof _HM_BADGE!=='undefined')?_HM_BADGE[c]:null;return v?`<span class="hm-badge ${v[0]}">${v[1]}</span>`:''}
function _rtBody(o){
  let h='';
  const fotos=typeof getFotosByNome==='function'?getFotosByNome(o.nome):[];
  if(fotos.length){
    const q="'";
    h+=`<div class="rt-photo"><img src="${fotos[0]}" loading="lazy" alt="Foto do posto ${_rtE(o.nome)}" onclick="showPostoFotoViewer(${q}${fotos[0]}${q})">${fotos.length>1?`<span class="rt-photo-n"><i class="ti ti-photo" aria-hidden="true"></i>${fotos.length} fotos</span>`:''}</div>`;
    if(fotos.length>1)h+=`<div class="rt-thumbs">${fotos.slice(1).map(u=>`<img src="${u}" loading="lazy" alt="Foto do posto" onclick="showPostoFotoViewer(${q}${u}${q})">`).join('')}</div>`;
  }
  const chips=[_rtBadge(o.cartao),o.vantagem?`<span class="rt-chip"><i class="ti ti-coin" aria-hidden="true"></i>${o.vantagem}</span>`:''].filter(Boolean).join('');
  if(chips)h+=`<div class="rt-chips">${chips}</div>`;
  const det=[];
  if(o.razaoSocial)det.push(`<div class="rt-det"><i class="ti ti-file-text" aria-hidden="true"></i>${o.razaoSocial}</div>`);
  if(o.detalhe)det.push(`<div class="rt-det"><i class="ti ti-road" aria-hidden="true"></i>${o.detalhe}</div>`);
  if(det.length)h+=`<div class="rt-dets">${det.join('')}</div>`;
  if(o.marcas&&o.marcas.length){
    h+=`<div class="rt-tbl"><div class="rt-tbl-h"><span>Marca</span><span>Litragem</span></div>`;
    for(const m of o.marcas){const z=String(m.litros||'').toLowerCase().includes('não');h+=`<div class="rt-tbl-r"><span class="b">${m.marca}</span><span class="${z?'z':'q'}">${m.litros}</span></div>`}
    h+=`</div>`;
  }
  if(o.nota)h+=`<div class="rt-note"><strong>Estratégia:</strong> ${o.nota}</div>`;
  if(o.link)h+=`<a class="rt-go" href="${o.link}" target="_blank" rel="noopener"><i class="ti ti-navigation" aria-hidden="true"></i>Como chegar</a>`;
  return h;
}
function _rtToggle(btn){const c=btn.closest('.rt-card');if(!c)return;const o=c.classList.toggle('open');btn.setAttribute('aria-expanded',o?'true':'false')}
function _rtPick(btn){
  const c=btn.closest('.rt-card');if(!c)return;const k=btn.dataset.k;
  c.querySelectorAll('.rt-seg button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.k===k?'true':'false'));
  c.querySelectorAll('.rt-opt').forEach(el=>{el.hidden=el.dataset.k!==k});
  const ob=c.querySelector('.rt-opt[data-k="'+k+'"]');
  if(ob){const n=c.querySelector('.rt-h-nome'),s=c.querySelector('.rt-h-sub');if(n)n.textContent=ob.dataset.nome||'';if(s)s.textContent=ob.dataset.sub||''}
}
function renderStop(p){
  const ip=p.tipo==='parcial',alt=p.alternativa;
  const sub=o=>[o.cidade,o.km?'KM '+o.km:''].filter(Boolean).join(' · ');
  const kick=`${p.ordem}º Abastecimento${ip?' · Parcial':''}${!alt&&p.km?' · KM '+p.km:''}`;
  const pill=alt?`<span class="rt-pill rt-pill-opt">2 opções</span>`:(p.litragem?`<span class="rt-pill">${p.litragem}</span>`:'');
  let body;
  if(alt){
    const opt=(o,k)=>`<div class="rt-opt" data-k="${k}" data-nome="${_rtE(o.nome)}" data-sub="${_rtE(sub(o))}"${k==='B'?' hidden':''}>${o.litragem?`<div class="rt-liters"><i class="ti ti-gas-station" aria-hidden="true"></i>${o.litragem}</div>`:''}${_rtBody(o)}</div>`;
    body=`<div class="rt-pick"><div class="rt-pick-l">Escolha 1 dos postos abaixo:</div><div class="rt-seg" role="group" aria-label="Opções de posto"><button type="button" data-k="A" aria-pressed="true" onclick="_rtPick(this)">Opção A</button><button type="button" data-k="B" aria-pressed="false" onclick="_rtPick(this)">Opção B</button></div></div>`+opt(p,'A')+opt(alt,'B');
  }else body=_rtBody(p);
  return `<li class="rt-item"><div class="rt-rail"><span class="rt-num${ip||alt?' p':''}">${_rtE(p.ordem)}</span><span class="rt-line"></span></div><div class="rt-main">`
    +`<div class="rt-card open${ip||alt?' p':''}"><button type="button" class="rt-head" aria-expanded="true" onclick="_rtToggle(this)">`
    +`<span class="rt-h-txt"><span class="rt-kick">${kick}</span><span class="rt-h-nome">${p.nome}</span><span class="rt-h-sub">${alt?sub(p):(p.cidade||'')}</span></span>${pill}<span class="rt-chev"><i class="ti ti-chevron-down" aria-hidden="true"></i></span></button>`
    +`<div class="rt-body">${body}</div></div></div></li>`;
}
function renderAlt(){return ''}

function _copyRouteInfo(btn){
  const txt=window._lastShareRaw||'';
  if(!txt)return;
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt).then(()=>{
      if(btn){_copyOk(btn);}
      else showToast('✅ Rotograma copiado!','#1f8a3d');
    }).catch(()=>_copyFallback(txt,btn));
  }else{_copyFallback(txt,btn);}
}

function _copyOk(btn){if(btn._cpT)return;const o=btn.innerHTML;btn.innerHTML='<i class="ti ti-check" aria-hidden="true"></i>Copiado';btn.classList.add('ok');btn._cpT=setTimeout(()=>{btn.innerHTML=o;btn.classList.remove('ok');btn._cpT=null},2000);}

function _copyFallback(txt,btn){
  const ta=document.createElement('textarea');
  ta.value=txt;ta.style.cssText='position:fixed;opacity:0';
  document.body.appendChild(ta);ta.focus();ta.select();
  try{document.execCommand('copy');if(btn){_copyOk(btn);}else showToast('✅ Rotograma copiado!','#1f8a3d');}
  catch(e){showToast('❌ Erro ao copiar','#fe2627');}
  ta.remove();
}

function _routeShareRaw(r,stops){
  const appUrl=location.origin+location.pathname+'#rota='+encodeURIComponent(r.id);
  const _stopsList=stops.map((p,i)=>{const c=p.cartao?` [${p.cartao.toUpperCase()}]`:'';return `${i+1}. ${p.nome} — ${p.cidade}${p.km?' (KM '+p.km+')':''}${c}`;}).join('\n');
  return `🚛 Rotograma: ${r.nome}\n📍 ${r.estados}\n📏 ${r.distancia||''} · ${r.tempo||''}\n⛽ ${stops.length} postos de abastecimento\n\n${_stopsList}\n\nAbra a rota: ${appUrl}`;
}

function _routeTimeline(r){const orig=r.paradas.find(p=>p.tipo==='origem'),dest=r.paradas.find(p=>p.tipo==='destino');
  let h=`<ol class="rt-tl" aria-label="Paradas da rota">`;
  if(orig)h+=`<li class="rt-item"><div class="rt-rail"><span class="rt-dot o"></span><span class="rt-line"></span></div><div class="rt-main rt-end"><div class="rt-kick">Origem · KM 0</div><div class="rt-end-n">${orig.nome}</div>${orig.cidade?`<div class="rt-end-s">${orig.cidade}</div>`:''}${orig.detalhe?`<div class="rt-end-s"><i class="ti ti-road" aria-hidden="true"></i> ${orig.detalhe}</div>`:''}</div></li>`;
  for(const p of r.paradas){if(p.tipo==='origem'||p.tipo==='destino')continue;h+=renderStop(p)}
  if(dest)h+=`<li class="rt-item"><div class="rt-rail"><span class="rt-dot d"><i class="ti ti-check" aria-hidden="true"></i></span></div><div class="rt-main rt-end"><div class="rt-kick">Chegada${r.distancia?' · '+r.distancia:''}</div><div class="rt-end-n">${dest.nome}</div>${dest.cidade&&dest.cidade!==dest.nome?`<div class="rt-end-s">${dest.cidade}</div>`:''}</div></li>`;
  return h+`</ol>`}

function _rtShare(){const t=window._lastShareRaw||'';if(navigator.share){navigator.share({title:'Rotograma',text:t}).catch(()=>{})}else _copyRouteInfo(null)}

function renderRoute(r){const orig=r.paradas.find(p=>p.tipo==='origem'),dest=r.paradas.find(p=>p.tipo==='destino'),stops=r.paradas.filter(p=>p.tipo!=='origem'&&p.tipo!=='destino');const oc=(orig?orig.nome:'').split('—')[0].trim()||'—',dc=(dest?dest.nome:'').split('—')[0].trim()||'—';
  window._lastShareRaw=_routeShareRaw(r,stops);
  const wa='https://wa.me/?text='+encodeURIComponent(window._lastShareRaw);
  const nP=stops.length;
  const badges=(typeof _routeCards==='function'?_routeCards(r):[]).map(_rtBadge).join('');
  const stat=(l,v,c)=>`<div class="rt-stat"><span class="l">${l}</span><span class="v${c?' '+c:''}">${v}</span></div>`;
  let h=`<div class="rt-wrap"><header class="rt-hero">`
    +`<div class="rt-top"><button type="button" class="rt-ib" onclick="navPop(renderHome)" aria-label="Voltar para rotas"><i class="ti ti-chevron-left" aria-hidden="true"></i></button><div class="rt-crumb">Rotas${r.regiao?' · '+_rtE(r.regiao):''}</div><button type="button" class="rt-ib" onclick="_rtShare()" aria-label="Compartilhar rota"><i class="ti ti-share" aria-hidden="true"></i></button></div>`
    +`<div class="rt-id"><div class="dd-num"><span>ROTA</span><b>${_rtE(r.numero)}</b></div><div class="rt-id-txt"><h1 class="rt-title">${_rtE(oc)} <span>→</span> ${_rtE(dc)}</h1>${r.estados?`<div class="rt-sub">${_rtE(r.estados)}</div>`:''}</div></div>`
    +`<div class="rt-stats">${stat('Distância',_rtE(r.distancia||'—'))}${stat('Estimado',_rtE(r.tempo||'—'))}${stat('Postos',nP,'red')}</div>`
    +(badges?`<div class="rt-cards"><span class="l">Cartão</span>${badges}</div>`:'')
    +`<div class="rt-acts">`+(r.linkRota?`<a class="rt-maps" href="${r.linkRota}" target="_blank" rel="noopener"><i class="ti ti-map-2" aria-hidden="true"></i>Ver rota completa no Maps</a>`:'')
    +`<div class="rt-acts2"><a class="rt-sec" href="${wa}" target="_blank" rel="noopener"><i class="ti ti-brand-whatsapp" aria-hidden="true"></i>WhatsApp</a><button type="button" class="rt-sec rt-copy" onclick="_copyRouteInfo(this)"><i class="ti ti-copy" aria-hidden="true"></i>Copiar</button></div></div>`
    +`</header><div class="rt-content">`;
  if(r.observacao)h+=`<div class="dd-alert"><i class="ti ti-alert-triangle" aria-hidden="true"></i><div><div class="rt-al-k">Aviso desta rota</div>${r.observacao}</div></div>`;
  if(r.retorno)h+=`<div class="dd-alert dd-ret"><i class="ti ti-refresh" aria-hidden="true"></i><div><div class="rt-al-k">Retorno</div>${r.retorno}</div></div>`;
  h+=`<div class="rt-sec-head"><h2>Roteiro</h2><span>${nP+2} paradas</span></div>`+_routeTimeline(r);
  h+=`<section class="hm-support" aria-label="Suporte de abastecimento"><div><div class="hm-sup-tit">PROBLEMA NO ABASTECIMENTO?</div><div class="hm-sup-sub">Fale com a equipe no WhatsApp</div></div><div class="hm-sup-btns"><a class="hm-sup-btn primary" href="https://wa.me/5562998780792" target="_blank" rel="noopener">${_HM_SVG.chat}<span><span class="hm-sup-name">Pedro</span><span class="hm-sup-when">Seg a Sex</span></span></a><a class="hm-sup-btn" href="https://wa.me/556299220160" target="_blank" rel="noopener">${_HM_SVG.chat}<span><span class="hm-sup-name">Ismael</span><span class="hm-sup-when">Sáb e Dom</span></span></a></div></section>`;
  return h+`</div></div>`}

// ═══ RENDER HOME (layout aprovado v63: header escuro, chips de região, destaque de informativo, cards com cartões) ═══
var _homeRegion='all',_homeCard='all';
const _HM_SVG={
  dist:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h7a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h7"/></svg>',
  clock:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  pump:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 22V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v17"/><path d="M3 22h13"/><path d="M7 8h5"/><path d="M15 12h2a2 2 0 0 1 2 2v3a1.5 1.5 0 0 0 3 0V9l-3-3"/></svg>',
  chev:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>',
  mega:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M16 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  chat:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l1.9-5.3A8.5 8.5 0 1 1 21 11.5z"/></svg>'
};
const _HM_BADGE={truckpag:['hm-b-truck','TruckPag'],shell:['hm-b-shell','Shell'],shell_expers:['hm-b-shell','Shell Expers'],redefrota:['hm-b-frota','Rede Frota'],compra_antecipada:['hm-b-ant','Antecipada']};
function _homeRegionNow(){return IS_DESKTOP()?(typeof _dActiveRegion!=='undefined'?_dActiveRegion:'all'):_homeRegion;}
function _regIdx(g){const i=REGION_ORDER.indexOf(g);return i<0?99:i;}
function _routeCards(r){const s=[];const add=c=>{if(c&&_HM_BADGE[c]&&s.indexOf(c)<0)s.push(c)};(r.paradas||[]).forEach(p=>{if(p.tipo==='origem'||p.tipo==='destino')return;add(p.cartao);if(p.alternativa)add(p.alternativa.cartao)});return s;}

function filterRoutes(q){
  if(q==null){const i=document.getElementById('searchInput');q=i?i.value:'';}
  const cards=document.querySelectorAll('#routeList .rcard'),nr=document.getElementById('noResults'),cl=document.getElementById('searchClear');
  const n=norm(q.trim()),terms=n?n.split(/\s+/):[],reg=_homeRegionNow();
  if(cl)cl.classList.toggle('vis',!!n);
  let vis=0;
  const card=IS_DESKTOP()?_homeCard:'all';
  cards.forEach(c=>{const m=terms.every(x=>(c.dataset.search||'').includes(x))&&(reg==='all'||c.dataset.region===reg)&&(card==='all'||(' '+(c.dataset.cards||'')+' ').includes(' '+card+' '));c.style.display=m?'':'none';if(m)vis++});
  if(nr)nr.style.display=vis?'none':'block';
  const t=document.getElementById('homeSectionTitle'),ct=document.getElementById('homeSectionCount');
  if(t)t.textContent=n?'Resultados da busca':(reg==='all'?'Todas as rotas':reg);
  if(ct)ct.textContent=vis+(vis===1?' rota':' rotas');
  if(IS_DESKTOP()&&typeof dRenderListHead==='function')dRenderListHead();
}

function clearSearch(){const i=document.getElementById('searchInput');i.value='';filterRoutes('');i.focus()}

function setHomeCard(c){_homeCard=c;renderHomeCardFilter();filterRoutes();}
function renderHomeCardFilter(){
  const el=document.getElementById('homeCardFilter');if(!el)return;
  const used=[];routes.forEach(r=>_routeCards(r).forEach(c=>{if(used.indexOf(c)<0)used.push(c)}));
  if(_homeCard!=='all'&&used.indexOf(_homeCard)<0)_homeCard='all';
  if(used.length<2){el.innerHTML='';return;}
  const b=(id,l)=>{const on=_homeCard===id;return `<button type="button" class="hm-cf${on?' on':''}" aria-pressed="${on}" onclick="setHomeCard('${id}')">${l}</button>`};
  el.innerHTML=b('all','Todos')+used.map(c=>b(c,_HM_BADGE[c][1])).join('');
}

function setHomeRegion(r){_homeRegion=r;renderHomeChips();filterRoutes();}

function renderHomeChips(){
  const el=document.getElementById('homeRegionChips');if(!el)return;
  const counts={};routes.forEach(r=>{const g=r.regiao||'Outras';counts[g]=(counts[g]||0)+1});
  const regs=Object.keys(counts).sort((a,b)=>_regIdx(a)-_regIdx(b));
  if(_homeRegion!=='all'&&!counts[_homeRegion])_homeRegion='all';
  const chip=(id,label,n)=>{const on=_homeRegion===id;return `<button type="button" role="tab" aria-selected="${on}" class="hm-chip${on?' on':''}" onclick="setHomeRegion('${esc(id)}')">${esc(label)}<span class="hm-chip-ct">${n}</span></button>`};
  el.innerHTML=chip('all','Todas',routes.length)+regs.map(g=>chip(g,g,counts[g])).join('');
}

function renderHomeInf(){
  const el=document.getElementById('homeInfHighlight');if(!el)return;
  const list=typeof _infList==='function'?_infList():[];
  if(!list.length){el.innerHTML='';return;}
  const it=list[0];
  const sub=[it.regiao,it.formaPagamento].filter(Boolean).map(esc).join(' · ');
  el.innerHTML=`<button type="button" class="hm-inf" onclick="bnavGoInformativos()"><span class="hm-inf-ic">${_HM_SVG.mega}</span><span class="hm-inf-txt"><span class="hm-inf-lbl">ÚLTIMO INFORMATIVO</span><span class="hm-inf-tit">${esc(it.posto||'Informativo')}</span>${sub?`<span class="hm-inf-sub">${sub}</span>`:''}</span><span class="hm-inf-chev">${_HM_SVG.chev}</span></button>`;
}

function renderHome(){
  const el=document.getElementById('routeList');if(!el)return;
  const list=routes.map((r,i)=>({r,i})).sort((a,b)=>{const d=_regIdx(a.r.regiao||'Outras')-_regIdx(b.r.regiao||'Outras');return d||String(a.r.numero||'').localeCompare(String(b.r.numero||''),'pt-BR',{numeric:true})});
  let h='';
  for(const{r,i}of list){
    const stops=r.paradas.filter(p=>p.tipo!=='origem'&&p.tipo!=='destino').length;
    const badges=_routeCards(r).map(c=>`<span class="hm-badge ${_HM_BADGE[c][0]}">${_HM_BADGE[c][1]}</span>`).join('');
    h+=`<div class="rcard hm-card" role="button" tabindex="0" data-search="${norm(searchText(r))}" data-region="${r.regiao||'Outras'}" data-cards="${_routeCards(r).join(' ')}" data-route-idx="${i}" onclick="showRoute(${i})">`
      +`<div class="rcard-uf hm-num"><span class="hm-num-lbl">ROTA</span><span class="hm-num-val">${r.numero}</span></div>`
      +`<div class="rcard-info"><div class="rcard-nome">${r.nome}</div><div class="rcard-detail">${r.estados||''}</div>`
      +`<div class="hm-stats">${r.distancia?`<span>${_HM_SVG.dist}${r.distancia}</span>`:''}${r.tempo?`<span>${_HM_SVG.clock}${r.tempo}</span>`:''}<span class="hm-postos">${_HM_SVG.pump}${stops} posto${stops!==1?'s':''}</span></div>`
      +(badges?`<div class="hm-badges">${badges}</div>`:'')
      +`</div><div class="rcard-arrow">${_HM_SVG.chev}</div></div>`;
  }
  h+='<div class="no-results" id="noResults"><span>🔍</span>Nenhuma rota encontrada</div>';
  h+=`<section class="hm-support" aria-label="Suporte de abastecimento"><div><div class="hm-sup-tit">PRECISA DE AJUDA?</div><div class="hm-sup-sub">Suporte de abastecimento no WhatsApp</div></div><div class="hm-sup-btns"><a class="hm-sup-btn primary" href="https://wa.me/5562998780792" target="_blank" rel="noopener">${_HM_SVG.chat}<span><span class="hm-sup-name">Pedro</span><span class="hm-sup-when">Seg a Sex</span></span></a><a class="hm-sup-btn" href="https://wa.me/556299220160" target="_blank" rel="noopener">${_HM_SVG.chat}<span><span class="hm-sup-name">Ismael</span><span class="hm-sup-when">Sáb e Dom</span></span></a></div></section>`;
  el.innerHTML=h;
  document.getElementById('routeCountText').textContent=`${routes.length} rotas ativas`;
  renderHomeChips();renderHomeCardFilter();renderHomeInf();filterRoutes();
  verifyDriverSession();
  const logoutBtn=document.getElementById('logoutBtn');const greeting=document.getElementById('driverGreeting');
  if(logoutBtn){logoutBtn.classList.add('show');}
  if(greeting){if(currentDriver){greeting.textContent='Olá, '+currentDriver.nome.split(' ')[0]+'!';}else if(adminMode){greeting.textContent='Modo administrador';}else{greeting.textContent='';}}
  if(IS_DESKTOP()){
    dUpdateSidebar();dUpdateTopbar();
    document.querySelectorAll('#dSidebar .dsb-item[data-region]').forEach(it=>it.classList.toggle('active',it.dataset.region===(_dActiveRegion||'all')));
    if(typeof dRestoreSelection==='function')dRestoreSelection();
  }
}
