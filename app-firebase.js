// ═══ FIREBASE INIT ═══
function initFirebase(){
  _loadNotifsFromLocal();renderNotifBadge();
  try{
    firebase.initializeApp(FIREBASE_CONFIG);
    db=firebase.database();

    // ═══ VERIFICAÇÃO DE VERSÃO (força update em iOS e todos os devices) ═══
    db.ref('config/appVersion').once('value').then(snap=>{
      const remoteVersion=snap.val();
      if(remoteVersion===null){
        db.ref('config/appVersion').set(APP_VERSION);
      } else if(remoteVersion>APP_VERSION){
        console.log('🔄 Nova versão detectada:',remoteVersion,'> local:',APP_VERSION);
        _forceCleanReload();
      }
    }).catch(()=>{});

    // Listener em tempo real: se admin mudar a versão, todos os apps abertos atualizam
    db.ref('config/appVersion').on('value',snap=>{
      const v=snap.val();
      if(v&&v>APP_VERSION){
        console.log('🔄 Update ao vivo:',v);
        _forceCleanReload();
      }
    });

    db.ref('rotogramas').on('value',snap=>{
      const data=snap.val();
      if(data&&Array.isArray(data)){routes=data;firebaseReady=true;localStorage.setItem('rotogramas_cache',JSON.stringify(routes));setSyncStatus('on','Sincronizado');if(!isEditing)renderHome();_handleDeepLink()}
      else if(!data){db.ref('rotogramas').set(DEFAULTS).then(()=>{routes=DEFAULTS;firebaseReady=true;setSyncStatus('on','Sincronizado');renderHome()})}
    },err=>{setSyncStatus('err','Erro Firebase — dados locais');loadLocal()});

    db.ref('motoristas').on('value',snap=>{
      const fbData=snap.val()||{};
      const localPending=JSON.parse(localStorage.getItem('drivers_local')||'{}');
      drivers={...fbData};
      Object.values(localPending).forEach(d=>{if(!fbData[d.id]){db.ref('motoristas/'+d.id).set(d).then(()=>{const lp=JSON.parse(localStorage.getItem('drivers_local')||'{}');delete lp[d.id];localStorage.setItem('drivers_local',JSON.stringify(lp));}).catch(()=>{});}else{const lp=JSON.parse(localStorage.getItem('drivers_local')||'{}');delete lp[d.id];localStorage.setItem('drivers_local',JSON.stringify(lp));}});
      drivers={...fbData,...localPending};
      if(adminMode)renderDriverManager();renderMonitoring();renderBI();
    });

    db.ref('viagens').on('value',snap=>{const d=snap.val();viagens=d||{};checkActiveTrip();renderMonitoring();renderBI();});
    db.ref('posicoes').on('value',snap=>{const d=snap.val();posicoes=d||{};updateMonitorMap();renderMonitoring();});

    // ═══ NOTIFICATIONS LISTENER ═══
    db.ref('notifications').limitToLast(30).on('value',snap=>{
      const d=snap.val();
      const fbNotifs=d?Object.entries(d).map(([k,v])=>({id:k,...v})).sort((a,b)=>(b.ts||0)-(a.ts||0)):[];
      const localOnly=notifications.filter(n=>n._local&&!fbNotifs.some(fb=>Math.abs((fb.ts||0)-(n.ts||0))<5000));
      notifications=[...localOnly,...fbNotifs].sort((a,b)=>(b.ts||0)-(a.ts||0));
      _syncNotifsToLocal();renderNotifBadge();
      if(notifPanelOpen)renderNotifList();
    },err=>{console.warn('Notif listener err:',err);});

  }catch(e){setSyncStatus('err','Erro Firebase');loadLocal();}
}

function saveToFirebase(){if(db&&firebaseReady){db.ref('rotogramas').set(routes).then(()=>setSyncStatus('on','Salvo e sincronizado')).catch(()=>setSyncStatus('err','Erro ao salvar'))}else{localStorage.setItem('rotogramas_data',JSON.stringify(routes))}}

function loadLocal(){const c=localStorage.getItem('rotogramas_cache'),m=localStorage.getItem('rotogramas_data'),s=c||m;if(s){try{routes=JSON.parse(s);renderHome();return}catch(e){}}routes=JSON.parse(JSON.stringify(DEFAULTS));renderHome();}

function setSyncStatus(t,txt){const el=document.getElementById('syncBar');if(!el)return;el.className='sync-bar'+(t==='on'?'':t==='off'?' off':' err');el.textContent=(t==='on'?'🟢':t==='off'?'🟡':'🔴')+' '+txt;if(IS_DESKTOP())setTimeout(dUpdateTopbar,50);}
