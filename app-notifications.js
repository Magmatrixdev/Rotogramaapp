// ═══ NOTIFICATION SYSTEM ═══

// ─── Controle de notificações nativas já exibidas ───
function _shownNativeIds(){try{return JSON.parse(localStorage.getItem('notif_native_shown')||'[]')}catch(e){return[]}}
function _markNativeShown(id){
  if(!id)return;
  try{const a=_shownNativeIds();if(!a.includes(id)){a.push(id);if(a.length>200)a.splice(0,a.length-200);localStorage.setItem('notif_native_shown',JSON.stringify(a));}}catch(e){}
}
function _maybeShowNative(notif){
  if(!notif||!notif.id)return;
  if(_shownNativeIds().includes(notif.id))return;
  _markNativeShown(notif.id);
  if(!('serviceWorker' in navigator)||Notification.permission!=='granted')return;
  const body=(notif.route||'')+': '+(notif.msg||'');
  navigator.serviceWorker.ready.then(reg=>{
    reg.showNotification('Rotogramas — Confiança',{
      body,icon:'./icon-192.png',badge:'./icon-192.png',
      tag:'rot-'+notif.id,data:{type:notif.type}
    });
  }).catch(()=>{});
}

// ═══ LIDAS POR USUÁRIO ═══
// Fonte da verdade: Firebase /notifRead/{uid}. O localStorage (chave por uid) é só
// cache para o contador funcionar offline. Assim a leitura sobrevive a logout/login,
// troca de aparelho, navegador x PWA e reinstalação do app.
let _remoteReadIds=new Set(), _notifReadSynced=false;
function _notifUid(){try{return (typeof firebase!=='undefined'&&firebase.auth().currentUser?.uid)||null}catch(e){return null}}
function _readKey(){const u=_notifUid();return u?'notif_read_'+u:'notif_read'}
function _getReadIds(){
  let a=[];
  try{
    const k=_readKey();let raw=localStorage.getItem(k);
    // Migração única: aproveita as lidas antigas (chave compartilhada) no 1º login do usuário
    if(raw===null&&k!=='notif_read'){raw=localStorage.getItem('notif_read');if(raw!==null)localStorage.setItem(k,raw);}
    a=JSON.parse(raw||'[]');
  }catch(e){a=[];}
  if(_remoteReadIds.size){const s=new Set(a);_remoteReadIds.forEach(i=>s.add(i));a=[...s];}
  return a;
}
function _saveReadIds(ids){try{localStorage.setItem(_readKey(),JSON.stringify(ids.slice(-300)))}catch(e){}}
function _pushReadRemote(ids){
  const u=_notifUid();if(!db||!u||!ids||!ids.length)return;
  const upd={},now=Date.now();
  ids.forEach(id=>{id=String(id||'');if(id&&!id.startsWith('local_')&&!/[.#$\[\]\/]/.test(id)&&!_remoteReadIds.has(id))upd[id]=now;});
  if(!Object.keys(upd).length)return;
  Object.keys(upd).forEach(id=>_remoteReadIds.add(id));
  db.ref('notifRead/'+u).update(upd).catch(e=>console.warn('notifRead save err:',e));
}
// Chamado pelo listener de /notifRead/{uid} (app-firebase.js)
function _onRemoteRead(obj){
  _remoteReadIds=new Set(Object.keys(obj||{}));
  if(!_notifReadSynced){
    _notifReadSynced=true;
    // Sobe o que foi lido neste aparelho e ainda não está no Firebase (ex.: lido offline)
    let local=[];try{local=JSON.parse(localStorage.getItem(_readKey())||'[]')}catch(e){}
    _pushReadRemote(local);
  }
  renderNotifBadge();if(notifPanelOpen)renderNotifList();
}
function _resetRemoteRead(){_remoteReadIds=new Set();_notifReadSynced=false;}
function _syncNotifsToLocal(){try{localStorage.setItem('notif_cache',JSON.stringify(notifications))}catch(e){}}
function _loadNotifsFromLocal(){try{notifications=JSON.parse(localStorage.getItem('notif_cache')||'[]')}catch(e){notifications=[];}}
function _unreadCount(){const read=_getReadIds();return notifications.filter(n=>!read.includes(n.id)).length}

let _lastBadgeCount=null;
function renderNotifBadge(){
  const badge=document.getElementById('notifBadge');if(!badge)return;
  const c=_unreadCount();
  const txt=c>99?'99+':String(c);
  const cls='notif-badge'+(c>0?' show':'');
  const aria=c>0?('Avisos, '+(c>99?'mais de 99':c)+(c===1?' não lido':' não lidos')):'Avisos';
  const grew=_lastBadgeCount!==null&&c>_lastBadgeCount;
  _lastBadgeCount=c;
  [['notifBell','notifBadge'],['dtbNotifBtn','dtbBadge']].forEach(([bId,bdId])=>{
    const b=document.getElementById(bdId);if(b){b.textContent=txt;b.className=cls;}
    const btn=document.getElementById(bId);if(!btn)return;
    btn.classList.toggle('has-unread',c>0);
    btn.setAttribute('aria-label',aria);
    if(grew&&c>0){
      btn.classList.remove('nb-new');void btn.offsetWidth;btn.classList.add('nb-new');
      clearTimeout(btn._nbT);btn._nbT=setTimeout(()=>btn.classList.remove('nb-new'),3000);
    }
  });
  if(notifPanelOpen)_renderNotifHead();
}

function toggleNotifPanel(){
  // Solicitar permissão via gesto do usuário — funciona no Android Chrome
  if('Notification' in window&&Notification.permission==='default'){
    Notification.requestPermission().then(p=>{if(p==='granted'){showToast('Notificações ativadas! 🔔','#1a7f37');if(typeof initPushMessaging==='function')initPushMessaging();}});
  }
  notifPanelOpen=!notifPanelOpen;
  const panel=document.getElementById('notifPanel');
  if(!panel)return;
  if(IS_DESKTOP()){
    const topbar=document.getElementById('dTopbar');
    if(topbar&&!topbar.contains(panel))topbar.appendChild(panel);
    if(notifPanelOpen){
      panel.style.cssText='display:block;position:absolute;top:64px;right:8px;width:380px;max-height:600px;overflow-y:auto;z-index:9999;border-radius:20px;box-shadow:0 18px 48px rgba(0,0,0,.35);background:#fff;animation:notifSlide .22s ease-out';
      renderNotifList();
    }else{
      panel.style.display='none';
    }
    return;
  }
  if(notifPanelOpen){
    panel.style.display='';
    panel.className='notif-panel open';
    renderNotifList();
  }else{
    panel.className='notif-panel';
    panel.style.display='';
  }
}

// ─── Caixa de avisos v2 ───
let _notifFilter='all';
const _NTF_SVG={
  edit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4"/><path d="M13.5 6.5l4 4"/></svg>',
  route:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 19a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/><path d="M19 7a2 2 0 1 0 0 -4a2 2 0 0 0 0 4z"/><path d="M11 19h5.5a3.5 3.5 0 0 0 0 -7h-8a3.5 3.5 0 0 1 0 -7h4.5"/></svg>',
  posto:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 11h1a2 2 0 0 1 2 2v3a1.5 1.5 0 0 0 3 0v-7l-3 -3"/><path d="M4 20v-14a2 2 0 0 1 2 -2h6a2 2 0 0 1 2 2v14"/><path d="M3 20l12 0"/><path d="M18 7v1a1 1 0 0 0 1 1h1"/><path d="M4 11l10 0"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10"/></svg>',
  checks:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 12l5 5l10 -10"/><path d="M2 12l5 5m5 -5l5 -5"/></svg>'
};
// Separa "Posto adicionado: Posto X - BR-135" em ação + detalhe e define o tipo visual
function _notifParts(n){
  const msg=String(n.msg||'');
  const i=msg.indexOf(':');
  const action=(i>0?msg.slice(0,i):msg).trim();
  const detail=i>0?msg.slice(i+1).trim().replace(/\s+-\s+/g,' · '):'';
  const a=action.toLowerCase();
  let kind='edit';
  if(a.startsWith('posto adicionado'))kind='add';
  else if(a.startsWith('posto removido'))kind='rem';
  else if(n.type==='new'||a.startsWith('nova rota'))kind='route';
  else if(n.type==='alert')kind='rem';
  return {action:action||'Atualização',detail,kind};
}
function _notifGroup(ts){
  const d=Date.now()-(ts||0);
  if(d<86400000)return 'Hoje';
  if(d<7*86400000)return 'Últimos 7 dias';
  if(d<30*86400000)return 'Últimos 30 dias';
  return 'Mais antigos';
}
function setNotifFilter(f){_notifFilter=f;renderNotifList();}
function _renderNotifHead(){
  const head=document.getElementById('notifHead');if(!head)return;
  const c=_unreadCount();
  head.innerHTML=`<div class="ntf-top">
      <div class="ntf-title-wrap"><span class="ntf-title">Avisos</span>${c>0?`<span class="ntf-chip">${c>99?'99+':c} ${c===1?'novo':'novos'}</span>`:''}</div>
      <button class="ntf-readall" ${c>0?'':'disabled'} onclick="event.stopPropagation();markAllNotifRead()">${_NTF_SVG.checks}Marcar tudo como lido</button>
    </div>
    <div class="ntf-tabs" role="tablist">
      <button role="tab" aria-selected="${_notifFilter==='all'}" class="ntf-tab${_notifFilter==='all'?' on':''}" onclick="event.stopPropagation();setNotifFilter('all')">Todos</button>
      <button role="tab" aria-selected="${_notifFilter==='unread'}" class="ntf-tab${_notifFilter==='unread'?' on':''}" onclick="event.stopPropagation();setNotifFilter('unread')">Não lidos · ${c}</button>
    </div>`;
}
function renderNotifList(){
  _renderNotifHead();
  const el=document.getElementById('notifList');if(!el)return;
  const read=_getReadIds();
  const list=notifications.filter(n=>_notifFilter==='all'||!read.includes(n.id));
  if(list.length===0){
    el.innerHTML=notifications.length===0
      ?`<div class="ntf-empty"><div class="ntf-empty-ic ntf-k-edit">${_NTF_SVG.edit}</div><strong>Nenhum aviso ainda</strong><span>Você será avisado quando uma rota ou posto mudar.</span></div>`
      :`<div class="ntf-empty"><div class="ntf-empty-ic ntf-k-add">${_NTF_SVG.check}</div><strong>Tudo em dia</strong><span>Nenhum aviso pendente.</span></div>`;
    return;
  }
  let h='',lastGroup='';
  list.forEach(n=>{
    const g=_notifGroup(n.ts);
    if(g!==lastGroup){h+=`<div class="ntf-group">${g}</div>`;lastGroup=g;}
    const isRead=read.includes(n.id);
    const p=_notifParts(n);
    const icon=p.kind==='add'||p.kind==='rem'?_NTF_SVG.posto:p.kind==='route'?_NTF_SVG.route:_NTF_SVG.edit;
    const sign=p.kind==='add'?'+':p.kind==='rem'?'−':'';
    const route=n.route||'';
    const ago=_timeAgo(n.ts);
    const aria=route+': '+p.action+(p.detail?', '+p.detail:'')+(ago?', '+ago:'')+(isRead?'':', não lido');
    h+=`<button class="ntf-item${isRead?'':' unread'}" aria-label="${esc(aria)}" onclick="event.stopPropagation();markNotifRead('${n.id}')">
      <span class="ntf-ic ntf-k-${p.kind}">${icon}${sign?'<span class="ntf-sign"></span>':''}</span>
      <span class="ntf-body">
        <span class="ntf-route" title="${esc(route)}">${esc(route)}</span>
        <span class="ntf-action">${esc(p.action)}</span>
        ${p.detail?`<span class="ntf-detail">${esc(p.detail)}</span>`:''}
        <span class="ntf-time">${esc(ago)}</span>
      </span>
      ${isRead?'':'<span class="ntf-dot"></span>'}
    </button>`;
  });
  el.innerHTML=h;
}

function markNotifRead(id){
  const read=_getReadIds();
  if(!read.includes(id)){read.push(id);_saveReadIds(read);}
  _pushReadRemote([id]);
  renderNotifBadge();renderNotifList();
}

function markAllNotifRead(){
  const ids=notifications.map(n=>n.id);
  _saveReadIds([...new Set([..._getReadIds(),...ids])]);
  _pushReadRemote(ids);
  renderNotifBadge();renderNotifList();
}

function pushNotification(type,routeName,msg){
  const ts=Date.now();
  const localId='local_'+ts+'_'+Math.random().toString(36).slice(2,8);
  const notif={id:localId,_local:true,type:type,route:routeName,msg:msg,ts:ts};
  // 1) Atualizar imediatamente o array local (independente do Firebase)
  notifications.unshift(notif);
  _syncNotifsToLocal();
  renderNotifBadge();
  if(notifPanelOpen)renderNotifList();
  // 2) Salvar no Firebase em paralelo
  if(db&&firebaseReady){
    db.ref('notifications').push({tipo:type,titulo:routeName,mensagem:msg,ts:ts})
      .then(ref=>{
        const idx=notifications.findIndex(n=>n.id===localId);
        if(idx>=0){notifications[idx]={...notifications[idx],id:ref.key,_local:false};}
        _syncNotifsToLocal();
        _markNativeShown(ref.key); // evita notificação duplicada quando o listener do Firebase disparar
        db.ref('notifications').once('value',snap=>{
          const all=snap.val();if(!all)return;
          const entries=Object.entries(all).sort((a,b)=>(a[1].ts||0)-(b[1].ts||0));
          if(entries.length>50){const upd={};entries.slice(0,entries.length-50).forEach(([k])=>upd[k]=null);db.ref('notifications').update(upd);}
        });
      })
      .catch(()=>{});
  }
  // 3) Push notification nativa via SW (no dispositivo que criou a notificação)
  _maybeShowNative({id:localId,type,route:routeName,msg,ts});
}

function requestNotifPermission(){
  if(!('Notification' in window))return;
  if(Notification.permission==='default'){
    Notification.requestPermission().then(p=>{
      if(p==='granted'){showToast('Notificações ativadas!','#1a7f37');if(typeof initPushMessaging==='function')initPushMessaging();}
    });
  } else if(Notification.permission==='granted'){
    if(typeof initPushMessaging==='function')initPushMessaging();
  }
}

// Fecha o painel ao clicar fora
document.addEventListener('click',e=>{
  if(!notifPanelOpen)return;
  const panel=document.getElementById('notifPanel');
  const bell=document.getElementById('notifBell');
  const dtbBell=document.getElementById('dtbNotifBtn');
  if(panel&&!panel.contains(e.target)&&!bell?.contains(e.target)&&!dtbBell?.contains(e.target)){
    notifPanelOpen=false;
    panel.className='notif-panel';
    if(IS_DESKTOP()) panel.style.display='none';
  }
});

// ═══ FCM — PUSH COM O APP FECHADO ═══
// Obtém o token FCM deste aparelho e salva em /fcmTokens/{uid}/{chave}.
// A Cloud Function onNotificationCreated lê esse nó e envia o push.
let _fcmInitDone=false;
async function initPushMessaging(){
  if(_fcmInitDone)return;
  if(!('serviceWorker' in navigator))return;
  if(!('Notification' in window)||Notification.permission!=='granted')return;
  if(typeof firebase==='undefined'||!firebase.messaging)return;
  try{ if(firebase.messaging.isSupported&&!firebase.messaging.isSupported())return; }catch(e){return;}
  const user=firebase.auth().currentUser;
  if(!user||!db)return;
  _fcmInitDone=true;
  try{
    const reg=await navigator.serviceWorker.ready;
    const messaging=firebase.messaging();
    const token=await messaging.getToken({vapidKey:VAPID_KEY,serviceWorkerRegistration:reg});
    if(!token){_fcmInitDone=false;return;}
    // Chave estável por aparelho: últimos 32 chars do token, sem caracteres
    // proibidos em chaves do Realtime Database
    const chave=token.slice(-32).replace(/[.#$/\[\]]/g,'_');
    await db.ref('fcmTokens/'+user.uid+'/'+chave).set({
      token:token,
      ts:Date.now(),
      plataforma:(navigator.userAgent||'').slice(0,200)
    });
    // App em primeiro plano: o listener de /notifications já exibe o aviso,
    // então aqui não fazemos nada para não duplicar.
    messaging.onMessage(()=>{});
  }catch(e){
    _fcmInitDone=false;
    console.warn('FCM indisponível:',e&&e.message);
  }
}

// ═══ CHAMADA DE CLOUD FUNCTIONS À PROVA DE FALHA DO PUSH ═══
// O SDK de Functions tenta anexar o token FCM em toda chamada. Sem um SW
// registrado no Messaging, ele procura /firebase-messaging-sw.js na RAIZ do
// domínio (404 no GitHub Pages) e a chamada falha antes de chegar ao servidor
// — era isso que aparecia como "CPF ou PIN incorretos" depois de ativar
// notificações / instalar a PWA. Aqui: (1) registramos o Messaging com o SW do
// app; (2) se ainda assim der erro de messaging, chamamos via HTTPS direto.
const _FN_BASE='https://us-central1-rotogramas-confianca.cloudfunctions.net/';
let _fcmPrimed=false;
async function _primeMessagingForCallables(){
  if(_fcmPrimed)return;
  try{
    if(!('serviceWorker' in navigator)||!('Notification' in window)||Notification.permission!=='granted')return;
    if(typeof firebase==='undefined'||!firebase.messaging)return;
    const reg=await Promise.race([navigator.serviceWorker.ready,new Promise(r=>setTimeout(()=>r(null),3000))]);
    if(!reg)return;
    await Promise.race([firebase.messaging().getToken({vapidKey:VAPID_KEY,serviceWorkerRegistration:reg}),new Promise(r=>setTimeout(r,5000))]);
    _fcmPrimed=true;
  }catch(e){console.warn('FCM prime:',e&&e.code);}
}
async function _callFnHttp(name,data){
  const headers={'Content-Type':'application/json'};
  const u=firebase.auth().currentUser;
  if(u){try{headers.Authorization='Bearer '+await u.getIdToken();}catch(e){}}
  let res,body;
  try{res=await fetch(_FN_BASE+name,{method:'POST',headers,body:JSON.stringify({data:data==null?null:data})});body=await res.json().catch(()=>({}));}
  catch(e){const er=new Error('Sem conexão com o servidor. Verifique sua internet.');er.code='functions/unavailable';throw er;}
  if(body&&body.error){const er=new Error(body.error.message||'Erro');er.code='functions/'+String(body.error.status||'internal').toLowerCase().replace(/_/g,'-');er.details=body.error.details;throw er;}
  if(!res.ok){const er=new Error('Erro '+res.status);er.code='functions/internal';throw er;}
  return {data:body.result};
}
function _callFn(name){
  return async function(data){
    await _primeMessagingForCallables();
    try{return await firebase.functions().httpsCallable(name)(data);}
    catch(e){
      if(String((e&&e.code)||'').startsWith('messaging/')){console.warn('Callable via HTTPS (falha FCM):',e.code);return _callFnHttp(name,data);}
      throw e;
    }
  };
}
