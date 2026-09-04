// ═══ FIREBASE INIT ═══
function initFirebase(){
  _loadNotifsFromLocal();renderNotifBadge();
  try{
    firebase.initializeApp(FIREBASE_CONFIG);
    db=firebase.database();
    if(firebase.storage)storage=firebase.storage();

    // ═══ AUTH STATE ═══
    firebase.auth().onAuthStateChanged(async function(user){
      if(!USE_NEW_AUTH){
        // Legado: derruba qualquer sessão Firebase Auth que não seja do admin
        if(user&&!adminMode){firebase.auth().signOut().catch(()=>{});}
        return;
      }
      // ── USE_NEW_AUTH = true ────────────────────────────────────────────
      if(!user){
        // Sessão encerrada — limpa motorista; admin gerencia próprio estado
        if(!adminMode)currentDriver=null;
        return;
      }
      // Verifica claim admin — forceRefresh=true garante que claims atualizados
      // (setados via Admin SDK/Cloud Function) sejam refletidos mesmo em sessões ativas
      const tok=await user.getIdTokenResult(true).catch(()=>null);
      if(tok?.claims?.admin){
        adminMode=true; // já setado em doAdminLogin, mas garante aqui
        return;
      }
      // ── Motorista autenticado via custom token ─────────────────────────
      currentDriver={uid:user.uid,nome:user.displayName||''};
      if(db){
        // Ouve apenas o próprio nó — não acessa a coleção inteira
        db.ref('motoristas/'+user.uid).on('value',snap=>{
          const d=snap.val();
          if(d)currentDriver={uid:user.uid,...d};
        });
      }
      // Navega para home se ainda estiver na tela de login
      if(!_navStack.length||_navStack[_navStack.length-1]==='screenDriverLogin'){showHome();}
    });

    // ═══ VERIFICAÇÃO DE VERSÃO (força update em iOS e todos os devices) ═══
    db.ref('config/appVersion').once('value').then(snap=>{
      const remoteVersion=snap.val();
      if(remoteVersion===null||remoteVersion<APP_VERSION){
        // Só escreve se autenticado — regras exigem auth para escrever /config
        const u=firebase.auth().currentUser;
        if(u){db.ref('config/appVersion').set(APP_VERSION).catch(()=>{});}
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
      if(data&&Array.isArray(data)){routes=data;firebaseReady=true;localStorage.setItem('rotogramas_cache',JSON.stringify(routes));setSyncStatus('on','Sincronizado');if(!isEditing)renderHome();if(typeof renderPostosList==='function'&&document.getElementById('screenPostos')?.classList.contains('active'))renderPostosList();_handleDeepLink();if(typeof _restoreDesktopIfNeeded==='function')_restoreDesktopIfNeeded();}
      else if(!data&&firebase.auth().currentUser){db.ref('rotogramas').set(DEFAULTS).then(()=>{routes=DEFAULTS;firebaseReady=true;setSyncStatus('on','Sincronizado');renderHome()}).catch(()=>{})}
    },err=>{setSyncStatus('err','Erro Firebase — dados locais');loadLocal()});

    db.ref('motoristas').on('value',snap=>{
      // USE_NEW_AUTH: motoristas não-admin não têm acesso à coleção inteira
      if(USE_NEW_AUTH&&!adminMode)return;
      const fbData=snap.val()||{};
      const localPending=JSON.parse(localStorage.getItem('drivers_local')||'{}');
      drivers={...fbData};
      Object.values(localPending).forEach(d=>{if(!fbData[d.id]){db.ref('motoristas/'+d.id).set(d).then(()=>{const lp=JSON.parse(localStorage.getItem('drivers_local')||'{}');delete lp[d.id];localStorage.setItem('drivers_local',JSON.stringify(lp));}).catch(()=>{});}else{const lp=JSON.parse(localStorage.getItem('drivers_local')||'{}');delete lp[d.id];localStorage.setItem('drivers_local',JSON.stringify(lp));}});
      drivers={...fbData,...localPending};
      if(adminMode)renderDriverManager();renderMonitoring();renderBI();
    });

    db.ref('viagens').on('value',snap=>{const d=snap.val();viagens=d||{};checkActiveTrip();renderMonitoring();renderBI();});
    db.ref('posicoes').on('value',snap=>{const d=snap.val();posicoes=d||{};updateMonitorMap();renderMonitoring();});
    db.ref('postos').on('value',snap=>{postosAvulsos=snap.val()||{};if(typeof renderPostosList==='function')renderPostosList();});

    // ═══ NOTIFICATIONS LISTENER ═══
    const _notifListenerStart=Date.now();
    db.ref('notifications').limitToLast(30).on('value',snap=>{
      const d=snap.val();
      const fbNotifs=d?Object.entries(d).map(([k,v])=>({id:k,type:v.tipo??v.type,route:v.titulo??v.route,msg:v.mensagem??v.msg,ts:v.ts})).sort((a,b)=>(b.ts||0)-(a.ts||0)):[];
      // IDs já conhecidos antes de mesclar (para detectar entradas realmente novas)
      const prevIds=new Set(notifications.filter(n=>!n._local).map(n=>n.id));
      const localOnly=notifications.filter(n=>n._local&&!fbNotifs.some(fb=>Math.abs((fb.ts||0)-(n.ts||0))<5000));
      notifications=[...localOnly,...fbNotifs].sort((a,b)=>(b.ts||0)-(a.ts||0));
      _syncNotifsToLocal();renderNotifBadge();
      if(notifPanelOpen)renderNotifList();
      // Mostrar notificação nativa para itens novos e recentes (criados após o listener iniciar)
      if(typeof _maybeShowNative==='function'){
        fbNotifs.forEach(n=>{
          if(!prevIds.has(n.id)&&(n.ts||0)>_notifListenerStart)_maybeShowNative(n);
        });
      }
    },err=>{console.warn('Notif listener err:',err);});

  }catch(e){setSyncStatus('err','Erro Firebase');loadLocal();}
}

function saveToFirebase(){if(db&&firebaseReady){db.ref('rotogramas').set(routes).then(()=>setSyncStatus('on','Salvo e sincronizado')).catch(()=>setSyncStatus('err','Erro ao salvar'))}else{localStorage.setItem('rotogramas_data',JSON.stringify(routes))}}

function loadLocal(){const c=localStorage.getItem('rotogramas_cache'),m=localStorage.getItem('rotogramas_data'),s=c||m;if(s){try{routes=JSON.parse(s);renderHome();return}catch(e){}}routes=JSON.parse(JSON.stringify(DEFAULTS));renderHome();}

function setSyncStatus(t,txt){const el=document.getElementById('syncBar');if(!el)return;el.className='sync-bar'+(t==='on'?'':t==='off'?' off':' err');el.textContent=(t==='on'?'🟢':t==='off'?'🟡':'🔴')+' '+txt;if(IS_DESKTOP())setTimeout(dUpdateTopbar,50);}





