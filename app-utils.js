// ═══ UTILS ═══

function esc(s){return(s||'').replace(/"/g,'&quot;').replace(/</g,'&lt;')}

function norm(s){return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}

function calcDistance(lat1,lon1,lat2,lon2){
  const R=6371;const dLat=(lat2-lat1)*Math.PI/180;const dLon=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function _timeAgo(ts){
  if(!ts)return'';
  const diff=Math.floor((Date.now()-ts)/1000);
  if(diff<60)return'Agora';
  if(diff<3600)return'Há '+Math.floor(diff/60)+' min';
  if(diff<86400)return'Há '+Math.floor(diff/3600)+'h';
  if(diff<172800)return'Ontem';
  return'Há '+Math.floor(diff/86400)+' dias';
}

function cartaoBadge(c){const m={truckpag:['badge-truckpag','TRUCKPAG'],shell:['badge-shell','SHELL'],shell_expers:['badge-shell','SHELL EXPERS'],redefrota:['badge-truckpag','REDE FROTA'],compra_antecipada:['badge-compra_antecipada','COMPRA ANTECIPADA']};const v=m[c];return v?`<span class="badge-cartao ${v[0]}">${v[1]}</span>`:''}

// ═══ TOAST & SUCCESS ═══
function showToast(msg,color){
  const t=document.createElement('div');t.className='offline-toast';
  if(color)t.style.background=color;
  t.textContent=msg;t.style.display='block';document.body.appendChild(t);
  setTimeout(()=>t.remove(),3500);
}

function showSuccessMessage(nome){
  const ov=document.createElement('div');
  ov.style.cssText='position:fixed;inset:0;background:#1a7a3c;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;animation:fadeInSuccess .3s ease';
  ov.innerHTML=`
    <div style="font-size:64px;margin-bottom:16px">✅</div>
    <div style="font-family:Barlow Condensed,sans-serif;font-weight:700;font-size:26px;color:#fff;text-transform:uppercase">Cadastro realizado!</div>
    <div style="font-family:Barlow,sans-serif;font-size:15px;color:rgba(255,255,255,.8);margin-top:8px">Bem-vindo, ${nome.split(' ')[0]}!</div>
    <div style="font-family:Barlow,sans-serif;font-size:13px;color:rgba(255,255,255,.6);margin-top:24px">Entrando no app...</div>`;
  document.body.appendChild(ov);
  setTimeout(()=>{ov.remove();navReset('screenHome',()=>renderHome());},2000);
}
