// ═══ INIT ═══
// Script está no fim do body: DOM já está pronto, não precisa esperar DOMContentLoaded
(function initApp(){
  document.getElementById('searchInput')?.addEventListener('input',e=>filterRoutes(e.target.value));
  if(loadDriverSession()){
    navReset('screenHome',()=>renderHome());
  }else{
    navReset('screenDriverLogin');
  }
})();

window.addEventListener('online',()=>{document.getElementById('offlineToast').classList.remove('show');setSyncStatus('on','Reconectado')});
window.addEventListener('offline',()=>{const t=document.getElementById('offlineToast');t.classList.add('show');setTimeout(()=>t.classList.remove('show'),4000);setSyncStatus('off','Sem conexão — modo offline')});

initFirebase();
