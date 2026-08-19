// ═══ CRYPTO ═══
async function getCryptoKey(){
  if(_cryptoKey)return _cryptoKey;
  const raw=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('rotograma-confianca-2026'));
  _cryptoKey=await crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['encrypt','decrypt']);
  return _cryptoKey;
}

async function encryptCPF(cpf){
  const key=await getCryptoKey();
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const enc=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(cpf));
  const combined=new Uint8Array(iv.length+enc.byteLength);
  combined.set(iv);combined.set(new Uint8Array(enc),iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decryptCPF(encStr){
  try{
    const combined=Uint8Array.from(atob(encStr),c=>c.charCodeAt(0));
    const key=await getCryptoKey();
    const dec=await crypto.subtle.decrypt({name:'AES-GCM',iv:combined.slice(0,12)},key,combined.slice(12));
    return new TextDecoder().decode(dec);
  }catch(e){return '***.***.***-**';}
}

async function sha256(str){
  const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

// Fallback SHA256 simples para contexto HTTP (sem crypto.subtle)
async function sha256Fallback(str){
  let hash=0;for(let i=0;i<str.length;i++){hash=((hash<<5)-hash+str.charCodeAt(i))|0;}
  return Math.abs(hash).toString(16).padStart(8,'0')+str.length.toString(16);
}

function fmtCPF(el){
  let v=el.value.replace(/\D/g,'').slice(0,11);
  if(v.length>9)v=v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/,'$1.$2.$3-$4');
  else if(v.length>6)v=v.replace(/(\d{3})(\d{3})(\d{1,3})/,'$1.$2.$3');
  else if(v.length>3)v=v.replace(/(\d{3})(\d{1,3})/,'$1.$2');
  el.value=v;
}

function cleanCPF(cpf){return cpf.replace(/\D/g,'');}
