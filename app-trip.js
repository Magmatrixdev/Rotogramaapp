// ═══ TRIP MANAGEMENT ═══
async function startTrip(){
  if(!currentDriver){showToast('Faça login como motorista primeiro');return;}
  if(currentRouteIdx<0){showToast('Selecione uma rota primeiro');return;}
  const route=routes[currentRouteIdx];
  const id='vgm_'+Date.now();
  const trip={id,motoristaId:currentDriver.id,motoristaNome:currentDriver.nome,rotaId:route.id,rotaNome:route.nome,status:'em_viagem',iniciadaEm:Date.now(),finalizadaEm:null,postosConfirmados:[],distanciaPercorrida:0};
  currentTrip=trip;
  tripStartTs=trip.iniciadaEm;
  updateActiveTripBanner();
  showMapLive();
  if(db){db.ref('viagens/'+id).set(trip).catch(e=>console.warn('Trip save pending:',e));}
  startTripTimer();
}

async function promptEndTrip(){
  const ov=document.createElement('div');ov.className='confirm-overlay';
  ov.innerHTML=`<div class="confirm-box"><h3>Encerrar viagem?</h3><p>A viagem será finalizada e o mapa desativado.</p><div class="btns"><button style="background:#eae8e3;color:#1c1c1c" onclick="this.closest('.confirm-overlay').remove()">Cancelar</button><button style="background:#fe2627;color:#fff" onclick="endTrip();this.closest('.confirm-overlay').remove()">Encerrar</button></div></div>`;
  document.body.appendChild(ov);
}

async function endTrip(){
  if(!currentTrip)return;
  stopTracking();stopTripTimer();
  const tripId=currentTrip.id;
  const driverId=currentDriver?.id;
  if(viagens[tripId])viagens[tripId].status='finalizada';
  _justEndedTripId=tripId;
  currentTrip=null;tripStartTs=null;
  updateActiveTripBanner();
  navPop(()=>{renderHome();});
  if(db&&tripId){
    const fin=Date.now();
    db.ref('viagens/'+tripId).update({status:'finalizada',finalizadaEm:fin})
      .then(()=>{setTimeout(()=>{if(_justEndedTripId===tripId)_justEndedTripId=null;},5000);})
      .catch(()=>{});
    if(driverId)db.ref('posicoes/'+driverId).remove().catch(()=>{});
  }
}

async function confirmFuelStop(){
  if(!currentTrip||!currentDriver)return;
  const route=routes[currentRouteIdx];if(!route)return;
  const stops=route.paradas.filter(p=>p.tipo!=='origem'&&p.tipo!=='destino');
  const confirmed=currentTrip.postosConfirmados||[];
  const nextIdx=confirmed.length;
  if(nextIdx>=stops.length)return;
  const newConfirmed=[...confirmed,nextIdx];
  currentTrip.postosConfirmados=newConfirmed;
  updateNextStopUI();
  document.getElementById('btnFuelConfirm')?.classList.remove('show');
  showToast('✅ Abastecimento confirmado!','#1a7a3c');
  if(db)db.ref('viagens/'+currentTrip.id+'/postosConfirmados').set(newConfirmed).catch(()=>{});
  setTimeout(()=>{initDriverMap();},100);
}

function checkActiveTrip(){
  if(!currentDriver)return;
  const active=Object.values(viagens).find(v=>
    v.motoristaId===currentDriver.id &&
    v.status==='em_viagem' &&
    v.id!==_justEndedTripId
  );
  if(active&&!currentTrip){
    currentTrip=active;tripStartTs=active.iniciadaEm;
    const ri=routes.findIndex(r=>r.id===active.rotaId);
    if(ri>=0)currentRouteIdx=ri;
    updateActiveTripBanner();
    if(!tripTimerInterval)startTripTimer();
  }else if(!active&&!_justEndedTripId){
    if(currentTrip){currentTrip=null;tripStartTs=null;stopTripTimer();updateActiveTripBanner();}
  }
}

function updateActiveTripBanner(){
  const banner=document.getElementById('activeTripBanner');
  const txt=document.getElementById('activeTripBannerTxt');
  if(banner&&currentTrip){txt.textContent='Em viagem: '+currentTrip.rotaNome;banner.classList.add('show');}
  else if(banner){banner.classList.remove('show');}
}

// ═══ GEOLOCATION ═══
function startTracking(){
  if(!navigator.geolocation)return;
  if(geoWatchId)navigator.geolocation.clearWatch(geoWatchId);
  geoWatchId=navigator.geolocation.watchPosition(pos=>{handlePosition(pos.coords.latitude,pos.coords.longitude);},{enableHighAccuracy:true,maximumAge:15000,timeout:15000});
}

function stopTracking(){if(geoWatchId){navigator.geolocation.clearWatch(geoWatchId);geoWatchId=null;}}

async function handlePosition(lat,lng){
  updateDriverMarkerPos(lat,lng);
  updateNextStopUI(lat,lng);
  if(currentTrip&&currentDriver&&db){
    const route=routes[currentRouteIdx];
    const pos={lat,lng,timestamp:Date.now(),motoristaId:currentDriver.id,motoristaNome:currentDriver.nome,rotaNome:route?route.nome:'',viagemId:currentTrip.id};
    db.ref('posicoes/'+currentDriver.id).set(pos);
    if(route){
      const coords=ROUTE_COORDS[route.id];
      if(coords?.orig){
        const [oLat,oLng]=coords.orig;
        const dist=calcDistance(oLat,oLng,lat,lng);
        currentTrip.distanciaPercorrida=Math.round(dist);
        db.ref('viagens/'+currentTrip.id+'/distanciaPercorrida').set(Math.round(dist));
        updateSVGProgress();
      }
    }
  }
}

function updateNextStopUI(lat,lng){
  if(!currentTrip||currentRouteIdx<0)return;
  const route=routes[currentRouteIdx];if(!route)return;
  const stops=route.paradas.filter(p=>p.tipo!=='origem'&&p.tipo!=='destino');
  const confirmed=currentTrip.postosConfirmados||[];
  const nextIdx=confirmed.length;
  const nameEl=document.getElementById('nextStopName');
  const cityEl=document.getElementById('nextStopCity');
  const distEl=document.getElementById('nextStopDist');
  const confirmBtn=document.getElementById('btnFuelConfirm');
  if(nextIdx>=stops.length){
    if(nameEl)nameEl.textContent='Todos os postos confirmados ✓';
    if(cityEl)cityEl.textContent='';
    if(distEl)distEl.textContent='';
    if(confirmBtn)confirmBtn.classList.remove('show');
  }else{
    const next=stops[nextIdx];
    if(nameEl)nameEl.textContent=next.nome;
    if(cityEl)cityEl.textContent=next.cidade;
    const coords=ROUTE_COORDS[route.id];
    const stopCoord=coords?.stops[nextIdx];
    if(lat&&lng&&stopCoord){
      const dist=calcDistance(lat,lng,stopCoord[0],stopCoord[1]);
      const distTxt=dist<1?Math.round(dist*1000)+'m':'≅ '+Math.round(dist)+'km';
      const hrs=dist/80;const hh=Math.floor(hrs);const mm=Math.round((hrs-hh)*60);
      const timeTxt=hh>0?`~${hh}h${String(mm).padStart(2,'0')}m`:`~${mm}min`;
      if(distEl)distEl.innerHTML='⏱ '+distTxt+' · '+timeTxt+' de distância';
      if(confirmBtn){if(dist<0.5)confirmBtn.classList.add('show');else confirmBtn.classList.remove('show');}
      _updateRouteColors(lat,lng);
    }else if(lat&&lng){
      if(distEl)distEl.innerHTML='⏱ KM '+next.km+' da rota';
    }else{
      if(distEl)distEl.innerHTML='⏱ KM '+next.km+' da rota';
    }
  }
  const listEl=document.getElementById('stopsList');
  if(listEl){
    let h='';
    stops.forEach((s,i)=>{
      const isDone=confirmed.includes(i);
      const isNext=i===nextIdx;
      let numHtml;
      if(isDone)numHtml='<div class="maplive-stop-num done">✓</div>';
      else if(isNext)numHtml='<div class="maplive-stop-num next">⛽</div>';
      else numHtml=`<div class="maplive-stop-num todo">${i+1}</div>`;
      h+=`<div class="maplive-stop-row">
        ${numHtml}
        <div class="maplive-stop-info">
          <div class="maplive-stop-name ${isDone?'done':''}">${s.nome}</div>
          <div class="maplive-stop-city">${s.cidade}</div>
        </div>
        <div class="maplive-stop-km">KM ${s.km}</div>
      </div>`;
    });
    listEl.innerHTML=h;
  }
}

// ═══ TRIP TIMER ═══
function startTripTimer(){
  if(tripTimerInterval)clearInterval(tripTimerInterval);
  tripTimerInterval=setInterval(updateTripStats,1000);
  updateTripStats();
}

function stopTripTimer(){if(tripTimerInterval){clearInterval(tripTimerInterval);tripTimerInterval=null;}}

function updateTripStats(){
  if(!tripStartTs)return;
  const elapsed=Math.floor((Date.now()-tripStartTs)/1000);
  const h=Math.floor(elapsed/3600),m=Math.floor((elapsed%3600)/60),s=elapsed%60;
  const timeStr=h>0?h+'h'+String(m).padStart(2,'0')+'m':String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
  const el=document.getElementById('tsElapsed');if(el)el.textContent=timeStr;
  if(currentTrip){
    const dist=currentTrip.distanciaPercorrida;
    const percEl=document.getElementById('tsPerc');if(percEl)percEl.textContent=dist?Math.round(dist)+'km':'—';
    const route=currentRouteIdx>=0?routes[currentRouteIdx]:null;
    const restEl=document.getElementById('tsRest');
    if(restEl&&route){const total=parseInt((route.distancia||'0').replace(/[^0-9]/g,''));if(total&&dist)restEl.textContent=Math.max(0,total-Math.round(dist))+'km';else restEl.textContent=route.distancia||'—';}
  }
}

// ═══ showRoute — intercept desktop/mobile ═══
function showRoute(i){
  if(IS_DESKTOP()&&(_navStack.length<=1||_navStack[_navStack.length-1]==='screenHome')){
    dShowRouteDetail(i);return;
  }
  const r=routes[i];currentRouteIdx=i;
  _navPushOrig('screenRoute',()=>{
    document.getElementById('routeContent').innerHTML=renderRoute(r);
    const bar=document.getElementById('driverTripBar');const btn=document.getElementById('btnStartTrip');
    if(bar&&currentDriver){bar.classList.add('show');if(currentTrip&&currentTrip.rotaId===r.id){btn.textContent='🗺️ Ver Mapa ao Vivo';btn.style.background='#1a6fb5';btn.onclick=showMapLive;btn.disabled=false;}else if(currentTrip){btn.textContent='🚛 Em outra viagem';btn.style.background='#9a9894';btn.disabled=true;}else{btn.textContent='🚛 Iniciar Viagem';btn.style.background='#1a7a3c';btn.onclick=startTrip;btn.disabled=false;}}else if(bar){bar.classList.remove('show');}
  });
}
