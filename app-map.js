// ═══ MAPBOX GL JS — carregamento dinâmico ═══
let _mapboxLoaded=false;

function loadMapboxGL(){
  return new Promise((resolve,reject)=>{
    if(typeof mapboxgl!=='undefined'){_mapboxLoaded=true;resolve();return;}
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.css';
    document.head.appendChild(link);
    const script=document.createElement('script');
    script.src='https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.js';
    script.onload=()=>{_mapboxLoaded=true;console.log('Mapbox GL JS carregado');resolve();};
    script.onerror=(e)=>{console.error('Falha ao carregar Mapbox GL JS',e);reject(new Error('Mapbox load failed'));};
    document.head.appendChild(script);
  });
}

// Converte [lat,lng] → Mapbox [lng,lat]
const ll=([lat,lng])=>[lng,lat];

// Rota um único segmento (A→B) via Mapbox Directions API
async function _mbSegment(from, to){
  const url='https://api.mapbox.com/directions/v5/mapbox/driving/'
    +from[1]+','+from[0]+';'+to[1]+','+to[0]
    +'?overview=full&geometries=geojson&steps=false&access_token='+MAPBOX_TOKEN;
  try{
    const ctrl=new AbortController();
    const tid=setTimeout(()=>ctrl.abort(),25000);
    const r=await fetch(url,{signal:ctrl.signal});
    clearTimeout(tid);
    if(!r.ok)return null;
    const d=await r.json();
    if(d.code==='Ok'&&d.routes[0]){
      return d.routes[0].geometry.coordinates.map(c=>[c[1],c[0]]);
    }
    console.warn('Mapbox Directions segmento:',d.code,d.message);
  }catch(e){console.warn('Mapbox Directions segmento erro:',e.message);}
  return null;
}

// Rota completa: tenta de uma vez, senão segmento por segmento
async function fetchOSRMRoute(points){
  const valid=points.filter(p=>p&&Array.isArray(p)&&p[0]!==undefined&&p[1]!==undefined);
  if(valid.length<2)return null;

  if(valid.length<=25){
    try{
      const coords=valid.map(p=>p[1]+','+p[0]).join(';');
      const url='https://api.mapbox.com/directions/v5/mapbox/driving/'+coords
        +'?overview=full&geometries=geojson&steps=false&access_token='+MAPBOX_TOKEN;
      const ctrl=new AbortController();
      const tid=setTimeout(()=>ctrl.abort(),20000);
      const r=await fetch(url,{signal:ctrl.signal});
      clearTimeout(tid);
      if(r.ok){
        const d=await r.json();
        if(d.code==='Ok'&&d.routes[0]){
          console.log('Mapbox Directions OK, pontos:',d.routes[0].geometry.coordinates.length);
          return d.routes[0].geometry.coordinates.map(c=>[c[1],c[0]]);
        }
        console.warn('Mapbox Directions:',d.code);
      }
    }catch(e){console.warn('Mapbox Directions erro:',e.message);}
  }

  // Fallback: segmento por segmento
  console.log('Directions: tentando segmento a segmento...');
  let fullRoute=[];
  for(let i=0;i<valid.length-1;i++){
    const seg=await _mbSegment(valid[i],valid[i+1]);
    if(seg){
      fullRoute=fullRoute.concat(i===0?seg:seg.slice(1));
    }else{
      if(fullRoute.length===0||fullRoute[fullRoute.length-1]!==valid[i])fullRoute.push(valid[i]);
      fullRoute.push(valid[i+1]);
    }
  }
  return fullRoute.length>=2?fullRoute:null;
}

// Cache de geocodificação
function _geoCache(){try{return JSON.parse(localStorage.getItem('_geocache')||'{}');}catch(e){return {};}}
function _saveGeoCache(k,v){try{const c=_geoCache();c[k]=v;localStorage.setItem('_geocache',JSON.stringify(c));}catch(e){}}

async function geocodeCity(nome){
  const key=nome.toLowerCase().replace(/[\s\-—]+/g,'_').replace(/[^a-z0-9_]/g,'').slice(0,40);
  const cache=_geoCache();
  if(cache[key])return cache[key];
  try{
    const q=encodeURIComponent(nome.split('—')[0].split('–')[0].trim()+', Brasil');
    const url='https://nominatim.openstreetmap.org/search?q='+q+'&format=json&limit=1&countrycodes=br';
    const ctrl=new AbortController();const tid=setTimeout(()=>ctrl.abort(),8000);
    const r=await fetch(url,{signal:ctrl.signal,headers:{'Accept':'application/json'}});
    clearTimeout(tid);
    const d=await r.json();
    if(d[0]){const c=[parseFloat(d[0].lat),parseFloat(d[0].lon)];_saveGeoCache(key,c);return c;}
  }catch(e){console.warn('Geocode:',e.message);}
  return null;
}

async function getCoordsForRoute(route){
  if(ROUTE_COORDS[route.id]){
    const rc=ROUTE_COORDS[route.id];
    const fuelStops=route.paradas.filter(p=>p.tipo!=='origem'&&p.tipo!=='destino');
    if(rc.stops.length<fuelStops.length){
      const newStops=[...rc.stops];
      for(let i=rc.stops.length;i<fuelStops.length;i++){
        const c=await geocodeCity(fuelStops[i].cidade||fuelStops[i].nome);
        newStops.push(c||rc.orig);
        if(i<fuelStops.length-1)await new Promise(r=>setTimeout(r,600));
      }
      return{orig:rc.orig,stops:newStops,dest:rc.dest};
    }
    return rc;
  }
  const orig=route.paradas.find(p=>p.tipo==='origem');
  const dest=route.paradas.find(p=>p.tipo==='destino');
  const fuelStops=route.paradas.filter(p=>p.tipo!=='origem'&&p.tipo!=='destino');
  const origC=orig?await geocodeCity(orig.nome):null;
  if(!origC)return null;
  await new Promise(r=>setTimeout(r,600));
  const destC=dest?await geocodeCity(dest.nome):null;
  if(!destC)return null;
  const stopCoords=[];
  for(const s of fuelStops){
    await new Promise(r=>setTimeout(r,600));
    const c=await geocodeCity(s.cidade||s.nome);
    if(c)stopCoords.push(c);
  }
  return{orig:origC,stops:stopCoords,dest:destC};
}

function makeStopEl(isDone,isNext,num){
  const el=document.createElement('div');
  if(isDone){
    el.innerHTML='<div style="width:28px;height:28px;background:#1f8a3d;border:3px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(31,138,61,.5);cursor:pointer">✓</div>';
  }else if(isNext){
    el.innerHTML='<div style="position:relative"><div style="width:34px;height:34px;background:#e8a020;border:3px solid #fff;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 3px 10px rgba(232,160,32,.6);cursor:pointer">⛽</div><div style="position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);background:#e8a020;color:#fff;font-family:Barlow Condensed,sans-serif;font-weight:700;font-size:9px;padding:2px 6px;border-radius:4px;white-space:nowrap">PRÓXIMO</div></div>';
  }else{
    el.innerHTML='<div style="width:26px;height:26px;background:#fff;border:2.5px solid #b0aea9;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:Barlow Condensed,sans-serif;font-weight:700;font-size:12px;color:#9a9894;box-shadow:0 2px 5px rgba(0,0,0,.15);cursor:pointer">'+num+'</div>';
  }
  return el;
}

async function initDriverMap(){
  if(_mbMap){try{_mbMap.remove();}catch(e){}_mbMap=null;_mbTruckMarker=null;_mbStopMarkers=[];}
  _routeGeometry=[];_routeLayerDone=null;_routeLayerRest=null;

  const el=document.getElementById('driverMapEl');
  if(!el)return;

  function showMapStatus(msg, color='#1a6fb5'){
    let s=document.getElementById('mapStatus');
    if(!s){s=document.createElement('div');s.id='mapStatus';
      s.style.cssText='position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;font-family:Barlow,sans-serif;font-size:13px;z-index:50;pointer-events:none;padding:20px;text-align:center';
      el.appendChild(s);}
    s.style.color=color;
    s.innerHTML='<span style="font-size:28px">🗺️</span><span>'+msg+'</span><span style="font-size:10px;opacity:.6">W:'+el.offsetWidth+' H:'+el.offsetHeight+'</span>';
  }
  showMapStatus('Iniciando mapa...');

  try{
    if(typeof mapboxgl==='undefined'){
      showMapStatus('⏳ Mapbox ainda carregando... (tentando novamente)','#e8a020');
      setTimeout(initDriverMap,1000);return;
    }
    let supported=false;
    try{supported=mapboxgl.supported();}catch(e){showMapStatus('❌ mapboxgl.supported() erro: '+e.message,'#fe2627');return;}
    if(!supported){showMapStatus('❌ WebGL não suportado neste dispositivo','#fe2627');return;}

    const route=currentRouteIdx>=0?routes[currentRouteIdx]:null;
    if(!route){showMapStatus('❌ Rota não encontrada. idx='+currentRouteIdx,'#fe2627');return;}

    showMapStatus('🔍 Localizando coordenadas da rota...');
    const coords=await getCoordsForRoute(route);
    if(!coords){showMapStatus('❌ Não foi possível obter coordenadas para: '+route.nome+'<br>Verifique sua conexão.','#fe2627');return;}
    const fuelStops=route.paradas.filter(p=>p.tipo!=='origem'&&p.tipo!=='destino');
    const confirmed=currentTrip?.postosConfirmados||[];

    mapboxgl.accessToken=MAPBOX_TOKEN;

    const _allWpts=[coords.orig,...(coords.stops||[]).filter(Boolean),coords.dest];
    const _initBounds=new mapboxgl.LngLatBounds();
    _allWpts.forEach(p=>_initBounds.extend(ll(p)));

    try{
      _mbMap=new mapboxgl.Map({
        container:el,
        style:'mapbox://styles/mapbox/streets-v12',
        bounds:_initBounds,
        fitBoundsOptions:{padding:60,maxZoom:11,duration:0},
        attributionControl:false,
        logoPosition:'bottom-left',
        failIfMajorPerformanceCaveat:false,
      });
    }catch(e){
      showMapStatus('❌ Erro ao iniciar mapa:<br>'+e.message,'#fe2627');
      console.error('Mapbox init error:',e);
      return;
    }
    if(!_mbMap){showMapStatus('❌ Mapa não criado','#fe2627');return;}

    _mbMap.on('error',e=>{
      console.error('Mapbox error:',e);
      showMapStatus('❌ Erro Mapbox: '+(e.error?.message||e.message||JSON.stringify(e)),'#fe2627');
    });
    _mbMap.on('style.load',()=>{ const s=document.getElementById('mapStatus');if(s)s.remove(); });
    _mbMap.addControl(new mapboxgl.NavigationControl({showCompass:false}),'top-right');

    coords.stops.forEach((c,i)=>{
      const s=fuelStops[i];
      const isDone=confirmed.includes(i),isNext=i===confirmed.length;
      const markerEl=makeStopEl(isDone,isNext,i+1);
      const mk=new mapboxgl.Marker(markerEl).setLngLat(ll(c)).addTo(_mbMap);
      if(s)mk.setPopup(new mapboxgl.Popup({offset:20}).setHTML('<b>'+s.nome+'</b><br>'+s.cidade+'<br><small>'+(s.litragem||'')+'</small>'));
      _mbStopMarkers.push(mk);
    });

    const origEl=document.createElement('div');
    origEl.innerHTML='<div style="width:26px;height:26px;background:#262625;border:2.5px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,.4)">🏠</div>';
    new mapboxgl.Marker(origEl).setLngLat(ll(coords.orig)).addTo(_mbMap);

    const destEl=document.createElement('div');
    destEl.innerHTML='<div style="width:26px;height:26px;background:#262625;border:2.5px solid #fff;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,.4)">🏁</div>';
    new mapboxgl.Marker(destEl).setLngLat(ll(coords.dest)).addTo(_mbMap);

    const truckEl=document.createElement('div');
    truckEl.innerHTML='<div style="width:36px;height:36px;background:#1a6fb5;border:3px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 3px 14px rgba(26,111,181,.65)">🚛</div><div style="position:absolute;bottom:-20px;left:50%;transform:translateX(-50%);background:#1a6fb5;color:#fff;font-family:Barlow Condensed,sans-serif;font-weight:700;font-size:9px;padding:2px 6px;border-radius:4px;white-space:nowrap">Você</div>';
    _mbTruckMarker=new mapboxgl.Marker(truckEl).setLngLat(ll(coords.orig)).addTo(_mbMap);

    setTimeout(()=>{if(_mbMap)_mbMap.resize();},100);
    setTimeout(()=>{if(_mbMap)_mbMap.resize();},500);

    _mbMap.on('load',async()=>{
      if(_mbMap)_mbMap.resize();
      const waypoints=[coords.orig,...coords.stops.filter(Boolean),coords.dest];
      const provisCoords=waypoints.map(p=>ll(p));

      _mbMap.addSource('route-casing',{type:'geojson',data:{type:'Feature',geometry:{type:'LineString',coordinates:provisCoords}}});
      _mbMap.addLayer({id:'route-casing',type:'line',source:'route-casing',paint:{'line-color':'#0d4a1a','line-width':9,'line-opacity':.4,'line-cap':'round','line-join':'round'}});
      _mbMap.addSource('route-done',{type:'geojson',data:{type:'Feature',geometry:{type:'LineString',coordinates:provisCoords.slice(0,1).concat([provisCoords[0]])}}});
      _mbMap.addLayer({id:'route-done',type:'line',source:'route-done',paint:{'line-color':'#1f8a3d','line-width':6,'line-opacity':.95,'line-cap':'round','line-join':'round'}});
      _mbMap.addSource('route-rest',{type:'geojson',data:{type:'Feature',geometry:{type:'LineString',coordinates:provisCoords}}});
      _mbMap.addLayer({id:'route-rest',type:'line',source:'route-rest',paint:{'line-color':'#4a90d9','line-width':6,'line-opacity':.9,'line-dasharray':[2.5,1.5],'line-cap':'round','line-join':'round'}});

      const loadEl=document.createElement('div');
      loadEl.id='mapLoader';
      loadEl.style.cssText='position:fixed;bottom:38%;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.75);color:#fff;padding:10px 16px;border-radius:10px;font-family:Barlow,sans-serif;font-size:12px;z-index:9999;pointer-events:none;text-align:center;min-width:200px';
      loadEl.innerHTML='🛣️ Calculando rota pelas estradas...<br><small style="opacity:.7">'+waypoints.length+' pontos na rota</small>';
      document.body.appendChild(loadEl);

      let geom=await fetchOSRMRoute(waypoints);
      document.getElementById('mapLoader')?.remove();

      if(!geom||geom.length<2){
        geom=waypoints;
        showToast('⚠️ Sem acesso ao serviço de rotas — rota estimada','#e8a020');
      }
      _routeGeometry=geom;

      const progress=calcGPSProgress();
      const splitIdx=Math.min(Math.floor(progress*(geom.length-1)),geom.length-2)||0;
      const mbDone=geom.slice(0,splitIdx+1).map(p=>ll(p));
      const mbRest=geom.slice(splitIdx).map(p=>ll(p));

      const allCoords=geom.map(p=>ll(p));
      _mbMap.getSource('route-casing')?.setData({type:'Feature',geometry:{type:'LineString',coordinates:allCoords}});
      _mbMap.getSource('route-done')?.setData({type:'Feature',geometry:{type:'LineString',coordinates:mbDone.length>1?mbDone:[mbDone[0],mbDone[0]]}});
      _mbMap.getSource('route-rest')?.setData({type:'Feature',geometry:{type:'LineString',coordinates:mbRest.length>1?mbRest:[mbRest[0],mbRest[0]]}});

      const bounds=new mapboxgl.LngLatBounds();
      geom.forEach(p=>bounds.extend(ll(p)));
      _mbMap.fitBounds(bounds,{padding:60,maxZoom:11,duration:800});

      if(splitIdx>0&&geom[splitIdx])_mbTruckMarker.setLngLat(ll(geom[splitIdx]));
    });

    if(navigator.geolocation){
      navigator.geolocation.getCurrentPosition(pos=>{
        updateDriverMarkerPos(pos.coords.latitude,pos.coords.longitude);
      },()=>{},{enableHighAccuracy:true,timeout:10000});
    }

  }catch(err){
    const s=document.getElementById('mapStatus');
    if(s)s.innerHTML='<span style="font-size:28px">🗺️</span><span style="color:#fe2627">❌ ERRO: '+err.message+'</span>';
    console.error('initDriverMap error:',err);
  }
}

function calcGPSProgress(){
  if(!currentTrip)return 0;
  const dist=currentTrip.distanciaPercorrida||0;
  const route=currentRouteIdx>=0?routes[currentRouteIdx]:null;
  if(!route)return 0;
  const m=route.distancia?.match?.(/[\d.]+/);
  if(!m)return 0;
  const total=parseFloat(m[0].replace('.',''))||1;
  return Math.max(0,Math.min(1,dist/total));
}

function updateDriverMarkerPos(lat,lng){
  if(!_mbMap||!_mbTruckMarker)return;
  _mbTruckMarker.setLngLat([lng,lat]);
  _mbMap.easeTo({center:[lng,lat],duration:800});
  _updateRouteColors(lat,lng);
}

function _updateRouteColors(lat,lng){
  if(!_routeGeometry.length||!_mbMap||!_mbMap.getSource('route-done'))return;
  let minD=Infinity,closeIdx=0;
  _routeGeometry.forEach((p,i)=>{const d=calcDistance(lat,lng,p[0],p[1]);if(d<minD){minD=d;closeIdx=i;}});
  const mbDone=_routeGeometry.slice(0,closeIdx+1).map(p=>ll(p));
  const mbRest=_routeGeometry.slice(closeIdx).map(p=>ll(p));
  try{
    _mbMap.getSource('route-casing')?.setData({type:'Feature',geometry:{type:'LineString',coordinates:_routeGeometry.map(p=>ll(p))}});
    _mbMap.getSource('route-done')?.setData({type:'Feature',geometry:{type:'LineString',coordinates:mbDone.length>1?mbDone:[mbDone[0],mbDone[0]]}});
    _mbMap.getSource('route-rest')?.setData({type:'Feature',geometry:{type:'LineString',coordinates:mbRest.length>1?mbRest:[mbRest[0],mbRest[0]]}});
  }catch(e){}
}

function updateSVGProgress(){
  if(_mbTruckMarker&&_mbMap){
    const p=_mbTruckMarker.getLngLat();
    if(p)_updateRouteColors(p.lat,p.lng);
  }
}

function svgZoomIn(){if(_mbMap)_mbMap.zoomIn();}
function svgZoomOut(){if(_mbMap)_mbMap.zoomOut();}

// ═══ MAPA MONITOR (Mapbox GL JS) ═══
function initMonitorMap(){
  if(monitorMapInit)return;
  const el=document.getElementById('monitorMapEl');if(!el)return;
  if(typeof mapboxgl==='undefined'){setTimeout(initMonitorMap,800);return;}
  mapboxgl.accessToken=MAPBOX_TOKEN;
  monitorMap=new mapboxgl.Map({
    container:el,
    style:'mapbox://styles/mapbox/streets-v12',
    center:[-47.93,-15.77],
    zoom:4,
    attributionControl:false,
  });
  monitorMap.addControl(new mapboxgl.NavigationControl({showCompass:false}),'top-right');
  monitorMapInit=true;
  monitorMap.on('load',()=>updateMonitorMap());
}

function updateMonitorMap(){
  if(!monitorMap||!monitorMapInit)return;
  Object.values(monitorMarkers).forEach(m=>m.remove());
  monitorMarkers={};
  Object.values(posicoes).forEach(p=>{
    if(!p.lat||!p.lng)return;
    const el=document.createElement('div');
    el.innerHTML='<div style="background:#1a6fb5;color:#fff;font-family:Barlow Condensed,sans-serif;font-size:11px;font-weight:700;padding:5px 8px;border-radius:9px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.3)">🚛 '+p.motoristaNome.split(' ')[0]+'</div>';
    const mk=new mapboxgl.Marker(el).setLngLat([p.lng,p.lat]).addTo(monitorMap);
    mk.setPopup(new mapboxgl.Popup({offset:20}).setHTML('<b>'+p.motoristaNome+'</b><br>'+p.rotaNome+'<br><small>'+new Date(p.timestamp).toLocaleTimeString('pt-BR')+'</small>'));
    monitorMarkers[p.motoristaId]=mk;
  });
}
