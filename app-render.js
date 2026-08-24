// ═══ SEARCH ═══
function searchText(r){const p=[r.nome,r.estados,r.subtitulo,r.numero,r.regiao||''];for(const s of r.paradas)p.push(s.nome,s.cidade,s.cartao||'',s.razaoSocial||'');return p.join(' ')}

function filterRoutes(q){const cards=document.querySelectorAll('.rcard'),regs=document.querySelectorAll('.region'),nr=document.getElementById('noResults'),cl=document.getElementById('searchClear');const n=norm(q.trim());if(!n){cards.forEach(c=>c.style.display='');regs.forEach(r=>r.style.display='');nr.style.display='none';cl.classList.remove('vis');return}cl.classList.add('vis');const terms=n.split(/\s+/);let vis=0;cards.forEach(c=>{const m=terms.every(x=>(c.dataset.search||'').includes(x));c.style.display=m?'':'none';if(m)vis++});regs.forEach(r=>{r.style.display=[...r.querySelectorAll('.rcard')].some(c=>c.style.display!=='none')?'':'none'});nr.style.display=vis?'none':'block'}

function clearSearch(){const i=document.getElementById('searchInput');i.value='';filterRoutes('');i.focus()}

// ═══ RENDER ROUTE ═══
function renderStop(p){
  const ip=p.tipo==='parcial';
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
    return `<div class="stop"><div class="stop-node ${ip?'parcial':''}"><div class="stop-node-dot"></div></div><div class="stop-km ${ip?'parcial':''}">KM ${p.km}</div><div class="scard">${heroHtml}<div class="scard-body"><div class="scard-cidade">${p.cidade}</div>${d?`<div class="scard-details">${d}</div>`:''}${bt}<div class="badge-row">${cartaoBadge(p.cartao)}</div>${note}</div>${extra}${link}</div></div>`;
  }
  return `<div class="stop"><div class="stop-node ${ip?'parcial':''}"><div class="stop-node-dot"></div></div><div class="stop-km ${ip?'parcial':''}">KM ${p.km}</div><div class="scard"><div class="scard-body"><div class="scard-brand-row"><div class="scard-brand-dot" style="background:${ip?'#e8a020':'#fe2627'}"></div><span class="scard-brand-name">${ip?p.ordem+' Abast. · Parcial':p.ordem+' Abastecimento'}</span></div><div class="scard-nome">${p.nome}</div><div class="scard-cidade">${p.cidade}</div>${d?`<div class="scard-details">${d}</div>`:''}${bt}<div class="badge-row">${cartaoBadge(p.cartao)}</div>${note}</div>${link}</div></div>`;
}
function renderAlt(a){let d=a.litragem?`<div class="scard-details"><div class="scard-detail">⛽ <strong>${a.litragem}</strong></div></div>`:'';let n=a.nota?`<div class="scard-note"><strong>Estratégia:</strong> ${a.nota}</div>`:'';let l=a.link?`<a class="rota-link" href="${a.link}" target="_blank" style="margin:12px 14px 14px;border-radius:10px">📍 ABRIR LOCALIZAÇÃO NO MAPS</a>`:'';return `<div class="ou-div"><div class="ou-line"></div><div class="ou-pill">OU</div><div class="ou-line"></div></div><div class="stop"><div class="stop-node parcial"><div class="stop-node-dot"></div></div><div class="stop-km parcial">KM ${a.km}</div><div class="scard dashed"><div class="scard-body"><div class="scard-brand-row"><div class="scard-brand-dot" style="background:#e8a020"></div><span class="scard-brand-name">Opção B</span></div><div class="scard-nome">${a.nome}</div><div class="scard-cidade">${a.cidade}</div>${d}<div class="badge-row">${cartaoBadge(a.cartao)}</div>${n}</div>${l}</div></div>`}

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
  h+=`<div class="emergency-bar"><div class="emergency-title">Contato de emergência — Abastecimento</div><div class="emergency-btns"><a class="emergency-btn whatsapp" href="https://wa.me/5562998780792" target="_blank">💬<div class="emergency-btn-info"><span class="emergency-btn-name">Pedro</span><span class="emergency-btn-sub">Seg a Sex</span></div></a><a class="emergency-btn whatsapp" href="https://wa.me/5562999943443" target="_blank">💬<div class="emergency-btn-info"><span class="emergency-btn-name">Maria</span><span class="emergency-btn-sub">Sáb e Dom</span></div></a></div></div>`;
  if(r.retorno)h+=`<div class="return-tag" style="margin:12px 20px 0"><span class="return-tag-icon">🔄</span><span class="return-tag-text">${r.retorno}</span></div>`;
  h+=`<div class="roto-scroll"><div class="timeline-wrap"><div class="timeline-line"></div><div class="timeline-stops">`;
  if(orig){let od=orig.detalhe?`<div class="scard-details"><div class="scard-detail">🛣️ ${orig.detalhe}</div></div>`:'';h+=`<div class="stop"><div class="stop-node"><div class="stop-node-dot"></div></div><div class="stop-km">KM 0</div><div class="scard"><div class="scard-body"><div class="scard-brand-row"><div class="scard-brand-dot" style="background:#1c1c1c"></div><span class="scard-brand-name">Origem</span></div><div class="scard-nome">${orig.nome}</div><div class="scard-cidade">${orig.cidade}</div>${od}</div></div></div>`}
  for(const p of r.paradas){if(p.tipo==='origem'||p.tipo==='destino')continue;h+=renderStop(p);if(p.alternativa)h+=renderAlt(p.alternativa)}
  if(dest)h+=`<div class="dest-stop"><div class="stop-node dest"><div class="stop-node-dot"></div></div><div class="dest-nome">Chegada · ${dc}</div></div>`;
  return h+`</div></div></div>`}

// ═══ RENDER HOME ═══
function renderHome(){
  const el=document.getElementById('routeList');if(!el)return;
  const rm={};routes.forEach((r,i)=>{const g=r.regiao||'Outras';if(!rm[g])rm[g]=[];rm[g].push({r,i})});
  const sorted=Object.keys(rm).sort((a,b)=>{const ia=REGION_ORDER.indexOf(a),ib=REGION_ORDER.indexOf(b);return(ia<0?99:ia)-(ib<0?99:ib)});
  let h='';
  for(const reg of sorted){const items=rm[reg];
    h+=`<div class="region"><div class="region-hd"><span class="region-bar"></span><span class="region-name">${reg}</span><span class="region-count">${items.length}</span><span class="region-line"></span></div>`;
    for(const{r,i}of items){const stops=r.paradas.filter(p=>p.tipo!=='origem'&&p.tipo!=='destino').length;
      h+=`<div class="rcard" data-search="${norm(searchText(r))}" data-region="${r.regiao||'Outras'}" data-route-idx="${i}" onclick="showRoute(${i})"><div class="rcard-uf">${r.numero}</div><div class="rcard-info"><div class="rcard-nome">${r.nome}</div><div class="rcard-detail">${r.estados}</div><div class="rcard-stats"><span>${r.distancia||''}</span><span class="dot">·</span><span>${r.tempo||''}</span><span class="dot">·</span><span class="red">⛽ ${stops} posto${stops!==1?'s':''}</span></div></div><div class="rcard-arrow">›</div></div>`}
    h+='</div>'}
  h+='<div class="no-results" id="noResults"><span>🔍</span>Nenhuma rota encontrada</div>';
  el.innerHTML=h;
  document.getElementById('routeCountText').textContent=`${routes.length} rotas ativas · toque para abrir`;
  const inp=document.getElementById('searchInput');if(inp&&inp.value.trim())filterRoutes(inp.value);
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

