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

function _getReadIds(){try{return JSON.parse(localStorage.getItem('notif_read')||'[]')}catch(e){return[]}}
function _saveReadIds(ids){localStorage.setItem('notif_read',JSON.stringify(ids))}
function _syncNotifsToLocal(){try{localStorage.setItem('notif_cache',JSON.stringify(notifications))}catch(e){}}
function _loadNotifsFromLocal(){try{notifications=JSON.parse(localStorage.getItem('notif_cache')||'[]')}catch(e){notifications=[];}}
function _unreadCount(){const read=_getReadIds();return notifications.filter(n=>!read.includes(n.id)).length}

function renderNotifBadge(){
  const badge=document.getElementById('notifBadge');if(!badge)return;
  const c=_unreadCount();
  badge.textContent=c>99?'99+':c;
  badge.className='notif-badge'+(c>0?' show':'');
  const db2=document.getElementById('dtbBadge');
  if(db2){db2.textContent=badge.textContent;db2.className=badge.className;}
}

function toggleNotifPanel(){
  // Solicitar permissão via gesto do usuário — funciona no Android Chrome
  if('Notification' in window&&Notification.permission==='default'){
    Notification.requestPermission().then(p=>{if(p==='granted')showToast('Notificações ativadas! 🔔','#1a7f37');});
  }
  notifPanelOpen=!notifPanelOpen;
  const panel=document.getElementById('notifPanel');
  if(!panel)return;
  if(IS_DESKTOP()){
    const topbar=document.getElementById('dTopbar');
    if(topbar&&!topbar.contains(panel))topbar.appendChild(panel);
    if(notifPanelOpen){
      panel.style.cssText='display:block;position:absolute;top:52px;right:8px;width:320px;max-height:400px;overflow-y:auto;z-index:9999;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.35);background:#fff;animation:notifSlide .22s ease-out';
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

function renderNotifList(){
  const el=document.getElementById('notifList');if(!el)return;
  if(notifications.length===0){el.innerHTML='<div class="notif-empty">🔔<br>Nenhuma notificação ainda</div>';return;}
  const read=_getReadIds();
  let h='';
  notifications.forEach(n=>{
    const isRead=read.includes(n.id);
    const icon=n.type==='new'?'📍':n.type==='edit'?'✏️':'⛽';
    const iconCls=n.type==='new'?'notif-icon-new':n.type==='edit'?'notif-icon-edit':'notif-icon-alert';
    const ago=_timeAgo(n.ts);
    h+=`<div class="notif-item${isRead?'':' unread'}" onclick="event.stopPropagation();markNotifRead('${n.id}')">
      <div class="notif-dot${isRead?' read':''}"></div>
      <div class="notif-icon ${iconCls}">${icon}</div>
      <div style="flex:1;min-width:0">
        <div class="notif-text"><strong>${esc(n.route||'')}</strong> — ${esc(n.msg||'')}</div>
        <div class="notif-time">${ago}</div>
      </div></div>`;
  });
  el.innerHTML=h;
}

function markNotifRead(id){
  const read=_getReadIds();
  if(!read.includes(id)){read.push(id);_saveReadIds(read);}
  renderNotifBadge();renderNotifList();
}

function markAllNotifRead(){
  const ids=notifications.map(n=>n.id);_saveReadIds(ids);
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
    db.ref('notifications').push({type:type,route:routeName,msg:msg,ts:ts})
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
      if(p==='granted')showToast('Notificações ativadas!','#1a7f37');
    });
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

