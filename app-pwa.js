// ═══ FORCE CLEAN RELOAD (limpa SW cache e recarrega) ═══
async function _forceCleanReload(){
  try{
    const keys=await caches.keys();
    await Promise.all(keys.map(k=>caches.delete(k)));
    const reg=await navigator.serviceWorker?.getRegistration();
    if(reg){await reg.update().catch(()=>{});}
  }catch(e){}
  location.reload();
}

// ═══ INSTALL PWA (Android + iOS) ═══
let dp=null;
const _isStandalone=window.navigator.standalone===true||window.matchMedia('(display-mode:standalone)').matches;
const _isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&'ontouchend' in document);
const _isAndroid=/Android/.test(navigator.userAgent);

window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();
  dp=e;
  const b=document.getElementById('installBanner');
  const ib=document.getElementById('installBtn');
  if(b){
    b.querySelector('p').innerHTML='Instale o <b>Rotogramas</b> no celular';
    if(ib){ib.style.display='';ib.textContent='Instalar';}
    b.classList.add('show');
  }
});

document.getElementById('installBtn')?.addEventListener('click',async()=>{
  if(dp){
    dp.prompt();
    const r=await dp.userChoice;
    dp=null;
    document.getElementById('installBanner').classList.remove('show');
    if(r.outcome==='accepted')localStorage.setItem('_pwaInstalled','1');
  } else if(_isAndroid){
    alert('Toque nos 3 pontos \u22ee no canto superior e escolha "Instalar aplicativo" ou "Adicionar à tela inicial"');
  }
});

document.getElementById('installDismiss')?.addEventListener('click',()=>{
  document.getElementById('installBanner').classList.remove('show');
  sessionStorage.setItem('_installDismissed','1');
});

(function(){
  if(_isStandalone)return;
  if(localStorage.getItem('_pwaInstalled')==='1')return;
  if(sessionStorage.getItem('_installDismissed')==='1')return;
  const b=document.getElementById('installBanner');
  if(!b)return;
  const ib=document.getElementById('installBtn');
  if(_isIOS){
    b.querySelector('p').innerHTML='Instale o app: toque em <b style="font-size:17px">\u2399</b> e depois <b>"Adicionar \u00e0 Tela de In\u00edcio"</b>';
    if(ib)ib.style.display='none';
    b.classList.add('show');
  } else if(_isAndroid){
    setTimeout(()=>{
      if(dp)return;
      b.querySelector('p').innerHTML='Instale o <b>Rotogramas</b>: toque em <b>\u22ee</b> e <b>"Instalar aplicativo"</b>';
      if(ib){ib.textContent='OK, entendi';ib.style.display='';}
      b.classList.add('show');
    },2000);
  }
})();

// ═══ SERVICE WORKER ═══
function showUpdateBanner(reg){
  document.querySelector('.update-banner')?.remove();
  const b=document.createElement('div');
  b.className='update-banner';
  b.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a7a3c;color:#fff;padding:13px 20px;border-radius:14px;font-family:Barlow Condensed,sans-serif;font-weight:700;font-size:14px;z-index:9999;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,.35);white-space:nowrap;display:flex;align-items:center;gap:8px;animation:slideUpIn .3s ease';
  b.innerHTML='🔄 <span>Nova versão disponível — toque para atualizar</span>';
  b.onclick=()=>{
    if(reg?.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'});
    else location.reload();
  };
  document.body.appendChild(b);
}

if('serviceWorker' in navigator){
  let _swRefreshing=false;
  navigator.serviceWorker.register('./sw.js?v=11').then(reg=>{
    reg.addEventListener('updatefound',()=>{
      const newWorker=reg.installing;
      newWorker.addEventListener('statechange',()=>{
        if(newWorker.state==='installed'&&navigator.serviceWorker.controller){
          showUpdateBanner(reg);
        }
      });
    });
    if(reg.waiting&&navigator.serviceWorker.controller){
      showUpdateBanner(reg);
    }
  }).catch(()=>{});
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(!_swRefreshing){_swRefreshing=true;location.reload();}
  });
}

// ═══ VERIFICAÇÃO AO VOLTAR AO APP (iOS: visibilitychange) ═══
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'&&db){
    db.ref('config/appVersion').once('value').then(snap=>{
      const v=snap.val();
      if(v&&v>APP_VERSION){
        console.log('🔄 Update ao voltar:',v);
        _forceCleanReload();
      }
    }).catch(()=>{});
    navigator.serviceWorker?.getRegistration().then(reg=>{if(reg)reg.update().catch(()=>{});});
  }
});
