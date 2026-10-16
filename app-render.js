// ═══ SEARCH ═══
function searchText(r){const p=[r.nome,r.estados,r.subtitulo,r.numero,r.regiao||''];for(const s of r.paradas)p.push(s.nome,s.cidade,s.cartao||'',s.razaoSocial||'');return p.join(' ')}





// ═══ RENDER ROUTE ═══
function renderStop(p){
  const ip=p.tipo==='parcial';
  const hasAlt=!!p.alternativa;
  const nodeCls=[ip?'parcial':'',hasAlt?'choice':''].filter(Boolean).join(' ');
  const choiceTag=hasAlt?'<div class="choice-tag">\ud83d\udd00 2 op\u00e7\u00f5es \u2014 escolha 1</div>':'';
  let d='';
  if(p.litragem)d+=`<div class="scard-detail">⛽ <strong>${p.litragem}</strong></div>`;
  if(p.razaoSocial)d+=`<div class="scard-detail">📋 ${p.razaoSocial}</div>`;
  if(p.vantagem)d+=`<div class="scard-detail">💰 ${p.vantagem}</div>`;
  if(p.detalhe)d+=`<div class="scard-detail">🛣️ ${p.detalhe}</div>`;
  let note=p.nota?`<div class="scard-note"><strong>Estratégia:</strong> ${p.nota}</div>`:'';
  let bt='';
  if(p.marcas&&p.marcas.length){
    bt='<table class="brand-tbl"><thead><tr><th>Marca</th><th>Litragem</th></tr></thead><tbody>';
    for(const m of p.marcas){bt+=`<tr><td class="bname">${m.marca}</td><td class="${m.litros.toLowerCase().includes('não')?'bqty zero':'bqty'}">${m.litros}</td></tr>`}
    bt+='</tbody></table>';
  }
  let link=p.link?`<a class="rota-link" href="${p.link}" target="_blank" style="margin:12px 14px 14px;border-radius:10px">📍 ABRIR LOCALIZAÇÃO NO MAPS</a>`:'';
  const fotos=typeof getFotosByNome==='function'?getFotosByNome(p.nome):[];
  if(fotos.length>0){
    const q="'";
    const extra=fotos.length>1?`<div class="posto-fotos-strip">${fotos.slice(1).map(u=>`<img class="posto-foto-thumb" src="${u}" onclick="showPostoFotoViewer(${q}${u}${q})" loading="lazy" alt="Foto do posto">`).join('')}</div>`:'';
    const lbl=ip?`${p.ordem}º Parcial`:`${p.ordem}º Abast.`;
    const heroHtml=`<div class="posto-hero"><img class="posto-hero-img" src="${fotos[0]}" loading="lazy" alt="${p.nome}" onclick="showPostoFotoViewer(${q}${fotos[0]}${q})"><div class="posto-hero-overlay"></div><div class="posto-hero-badge-row"><span class="scard-brand-name" style="color:#fff;background:rgba(0,0,0,.45);padding:3px 8px;border-radius:20px;font-size:10px">${lbl}</span></div><div class="posto-hero-name">${p.nome}</div></div>`;
    return `<div class="stop"><div class="stop-node ${nodeCls}"><div class="stop-node-dot"></div></div><div class="stop-km ${nodeCls}">KM ${p.km}</div><div class="scard ${hasAlt?'choice':''}">${heroHtml}<div class="scard-body">${choiceTag}<div class="scard-cidade">${p.cidade}</div>${d?`<div class="scard-details">${d}</div>`:''}${bt}<div class="badge-row">${cartaoBadge(p.cartao)}</div>${note}</div>${extra}${link}</div></div>`;
  }
  return `<div class="stop"><div class="stop-node ${nodeCls}"><div class="stop-node-dot"></div></div><div class="stop-km ${nodeCls}">KM ${p.km}</div><div class="scard ${hasAlt?'choice':''}"><div class="scard-body">${choiceTag}<div class="scard-brand-row"><div class="scard-brand-dot" style="background:${ip?'#e8a020':'#fe2627'}"></div><span class="scard-brand-name">${ip?p.ordem+'º Abast. · Parcial':p.ordem+'º Abastecimento'}</span></div><div class="scard-nome">${p.nome}</div><div class="scard-cidade">${p.cidade}</div>${d?`<div class="scard-details">${d}</div>`:''}${bt}<div class="badge-row">${cartaoBadge(p.cartao)}</div>${note}</div>${link}</div></div>`;
}
function renderAlt(a){let d=a.litragem?`<div class="scard-details"><div class="scard-detail">⛽ <strong>${a.litragem}</strong></div></div>`:'';let n=a.nota?`<div class="scard-note"><strong>Estratégia:</strong> ${a.nota}</div>`:'';let l=a.link?`<a class="rota-link" href="${a.link}" target="_blank" style="margin:12px 14px 14px;border-radius:10px">📍 ABRIR LOCALIZAÇÃO NO MAPS</a>`:'';return `<div class="ou-div"><div class="ou-line"></div><div class="ou-pill">OU</div><div class="ou-line"></div></div><div class="stop"><div class="stop-node parcial"><div class="stop-node-dot"></div></div><div class="stop-km parcial">KM ${a.km}</div><div class="scard dashed choice"><div class="scard-body"><div class="scard-brand-row"><div class="scard-brand-dot" style="background:#e8a020"></div><span class="scard-brand-name">Opção B</span></div><div class="scard-nome">${a.nome}</div><div class="scard-cidade">${a.cidade}</div>${d}<div class="badge-row">${cartaoBadge(a.cartao)}</div>${n}</div>${l}</div></div>`}

function _copyRouteInfo(btn){
  const txt=window._lastShareRaw||'';
  if(!txt)return;
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt).then(()=>{
      if(btn){btn.innerHTML='✅ COPIADO';setTimeout(()=>btn.innerHTML='📋 COPIAR',2000);}
      else showToast('✅ Rotograma copiado!','#1f8a3d');
    }).catch(()=>_copyFallback(txt,btn));
  }else{_copyFallback(txt,btn);}
}

function _copyFallback(txt,btn){
  const ta=document.createElement('textarea');
  ta.value=txt;ta.style.cssText='position:fixed;opacity:0';
  document.body.appendChild(ta);ta.focus();ta.select();
  try{document.execCommand('copy');if(btn){btn.innerHTML='✅ COPIADO';setTimeout(()=>btn.innerHTML='📋 COPIAR',2000);}else showToast('✅ Rotograma copiado!','#1f8a3d');}
  catch(e){showToast('❌ Erro ao copiar','#fe2627');}
  ta.remove();
}

function renderRoute(r){const orig=r.paradas.find(p=>p.tipo==='origem'),dest=r.paradas.find(p=>p.tipo==='destino'),stops=r.paradas.filter(p=>p.tipo!=='origem'&&p.tipo!=='destino');const oc=(orig?orig.nome:'').split('—')[0].trim(),dc=(dest?dest.nome:'').split('—')[0].trim();
  let h=`<div class="roto-top"><button class="back-btn" onclick="navPop(renderHome)">‹</button><div class="roto-header"><div class="roto-route-row"><div class="roto-chip"><div class="city">${oc}</div><div class="lbl">ORIGEM</div></div><span class="roto-arrow">→</span><div class="roto-chip"><div class="city">${dc}</div><div class="lbl">DESTINO</div></div></div><div class="roto-stats"><div class="roto-stat"><div class="val">${r.distancia||'—'}</div><div class="lbl">DISTÂNCIA</div></div><div class="roto-stat"><div class="val">${r.tempo||'—'}</div><div class="lbl">ESTIMADO</div></div><div class="roto-stat"><div class="val red">${stops.length}</div><div class="lbl">POSTOS</div></div></div>`;
  if(r.linkRota)h+=`<a class="rota-link" href="${r.linkRota}" target="_blank">📍 VER ROTA COMPLETA NO MAPS</a>`;
  const appUrl=location.origin+location.pathname+'#rota='+encodeURIComponent(r.id);
  const _stopsList=stops.map((p,i)=>{const c=p.cartao?` [${p.cartao.toUpperCase()}]`:'';return `${i+1}. ${p.nome} — ${p.cidade}${p.km?' (KM '+p.km+')':''}${c}`;}).join('\n');
  window._lastShareRaw=`🚛 Rotograma: ${r.nome}\n📍 ${r.estados}\n📏 ${r.distancia||''} · ${r.tempo||''}\n⛽ ${stops.length} postos de abastecimento\n\n${_stopsList}\n\nAbra a rota: ${appUrl}`;
  const shareRaw=window._lastShareRaw;
  const shareText=encodeURIComponent(shareRaw);
  h+=`<div style="display:flex;gap:8px;margin-top:10px"><a class="share-btn" style="flex:1;margin:0" href="https://wa.me/?text=${shareText}" target="_blank">📤 WHATSAPP</a><button class="share-btn" style="flex:1;margin:0;background:#3a3a3a;border:none;cursor:pointer;color:#fff" onclick="_copyRouteInfo(this)">📋 COPIAR</button></div>`;
  h+=`</div></div>`;
  if(r.observacao)h+=`<div class="alert-banner"><span class="alert-icon">⚠️</span><div class="alert-content"><div class="alert-label">Aviso desta rota</div><div class="alert-text">${r.observacao}</div></div></div>`;
  h+=`<div class="emergency-bar"><div class="emergency-title">Contato de emergência — Abastecimento</div><div class="emergency-btns"><a class="emergency-btn whatsapp" href="https://wa.me/5562998780792" target="_blank">💬<div class="emergency-btn-info"><span class="emergency-btn-name">Pedro</span><span class="emergency-btn-sub">Seg a Sex</span></div></a><a class="emergency-btn whatsapp" href="https://wa.me/556299220160" target="_blank">💬<div class="emergency-btn-info"><span class="emergency-btn-name">Ismael</span><span class="emergency-btn-sub">Sáb e Dom</span></div></a></div></div>`;
  if(r.retorno)h+=`<div class="return-tag" style="margin:12px 20px 0"><span class="return-tag-icon">🔄</span><span class="return-tag-text">${r.retorno}</span></div>`;
  h+=`<div class="roto-scroll"><div class="timeline-wrap"><div class="timeline-line"></div><div class="timeline-stops">`;
  if(orig){let od=orig.detalhe?`<div class="scard-details"><div class="scard-detail">🛣️ ${orig.detalhe}</div></div>`:'';h+=`<div class="stop"><div class="stop-node"><div class="stop-node-dot"></div></div><div class="stop-km">KM 0</div><div class="scard"><div class="scard-body"><div class="scard-brand-row"><div class="scard-brand-dot" style="background:#1c1c1c"></div><span class="scard-brand-name">Origem</span></div><div class="scard-nome">${orig.nome}</div><div class="scard-cidade">${orig.cidade}</div>${od}</div></div></div>`}
  for(const p of r.paradas){if(p.tipo==='origem'||p.tipo==='destino')continue;h+=renderStop(p);if(p.alternativa)h+=renderAlt(p.alternativa)}
  if(dest)h+=`<div class="dest-stop"><div class="stop-node dest"><div class="stop-node-dot"></div></div><div class="dest-nome">Chegada · ${dc}</div></div>`;
  return h+`</div></div></div>`}

// ═══ RENDER HOME (layout aprovado v63: header escuro, chips de região, destaque de informativo, cards com cartões) ═══
var _homeRegion='all';
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
  cards.forEach(c=>{const m=terms.every(x=>(c.dataset.search||'').includes(x))&&(reg==='all'||c.dataset.region===reg);c.style.display=m?'':'none';if(m)vis++});
  if(nr)nr.style.display=vis?'none':'block';
  const t=document.getElementById('homeSectionTitle'),ct=document.getElementById('homeSectionCount');
  if(t)t.textContent=n?'Resultados da busca':(reg==='all'?'Todas as rotas':reg);
  if(ct)ct.textContent=vis+(vis===1?' rota':' rotas');
}

function clearSearch(){const i=document.getElementById('searchInput');i.value='';filterRoutes('');i.focus()}

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
    h+=`<div class="rcard hm-card" role="button" tabindex="0" data-search="${norm(searchText(r))}" data-region="${r.regiao||'Outras'}" data-route-idx="${i}" onclick="showRoute(${i})">`
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
  renderHomeChips();renderHomeInf();filterRoutes();
  verifyDriverSession();checkActiveTrip();updateActiveTripBanner();
  const logoutBtn=document.getElementById('logoutBtn');const greeting=document.getElementById('driverGreeting');
  if(logoutBtn){logoutBtn.classList.add('show');}
  if(greeting){if(currentDriver){greeting.textContent='Olá, '+currentDriver.nome.split(' ')[0]+'!';}else if(adminMode){greeting.textContent='Modo administrador';}else{greeting.textContent='';}}
  if(IS_DESKTOP()){
    dUpdateSidebar();dUpdateTopbar();
    if(_dActiveRegion&&_dActiveRegion!=='all'){
      const activeItem=document.querySelector(`.dsb-item[data-region="${_dActiveRegion}"]`);
      if(activeItem)dSidebarFilter(activeItem,_dActiveRegion);
    }
  }
}
