// ═══ INIT ═══
// Script está no fim do body: DOM já está pronto, não precisa esperar DOMContentLoaded
(function initApp(){
  document.getElementById('searchInput')?.addEventListener('input',e=>filterRoutes(e.target.value));
  if(typeof USE_NEW_AUTH!=='undefined'&&USE_NEW_AUTH){
    // Firebase Auth restaura a sessão de forma assíncrona (onAuthStateChanged).
    // Se há sinal de sessão recente e não-ociosa, já mostra a home (evita piscar
    // a tela de login); o onAuthStateChanged confirma ou corrige em seguida.
    const _hasRecent=(typeof _authIsIdle==='function')&&localStorage.getItem('last_activity')&&!_authIsIdle();
    if(_hasRecent){
      navReset('screenHome',()=>{renderHome();if(typeof updateBottomNav==='function')updateBottomNav('Rotas');});
    }else{
      navReset('screenDriverLogin');
    }
  }else if(loadDriverSession()){
    navReset('screenHome',()=>{renderHome();if(typeof updateBottomNav==='function')updateBottomNav('Rotas');});
  }else{
    navReset('screenDriverLogin');
  }
})();

window.addEventListener('online',()=>{document.getElementById('offlineToast').classList.remove('show');setSyncStatus('on','Reconectado')});
window.addEventListener('offline',()=>{const t=document.getElementById('offlineToast');t.classList.add('show');setTimeout(()=>t.classList.remove('show'),4000);setSyncStatus('off','Sem conexão — modo offline')});

initFirebase();
