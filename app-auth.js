// ═══ DRIVER AUTH ═══
async function doDriverRegister(){
  const nome=(document.getElementById('dRegNome')?.value||'').trim();
  const cpfRaw=cleanCPF(document.getElementById('dRegCPF')?.value||'');
  const pin=(document.getElementById('dRegPIN')?.value||'').trim();
  const pin2=(document.getElementById('dRegPIN2')?.value||'').trim();
  const errEl=document.getElementById('dRegError');
  const btn=document.querySelector('#dauthRegisterForm .dauth-btn');
  function showErr(msg){errEl.textContent=msg;errEl.style.display='block';setTimeout(()=>errEl.style.display='none',4000);}
  if(!nome){showErr('Informe o nome completo');return;}
  if(cpfRaw.length!==11){showErr('CPF inválido — digite os 11 dígitos');return;}
  if(pin.length!==4){showErr('PIN deve ter 4 dígitos');return;}
  if(pin!==pin2){showErr('Os PINs não coincidem');return;}
  if(!/^\d{4}$/.test(pin)){showErr('PIN deve conter apenas números');return;}
  if(btn){btn.disabled=true;btn.textContent='Aguarde...';}
  // ── USE_NEW_AUTH: cadastro via Cloud Function ────────────────────────────
  if(USE_NEW_AUTH){
    try{
      const fn=firebase.functions().httpsCallable('registerDriver');
      const result=await fn({nome,cpf:cpfRaw,pin});
      const {token}=result.data;
      await firebase.auth().signInWithCustomToken(token);
      showSuccessMessage(nome);
    }catch(err){
      const code=err.code||'';
      if(code==='functions/already-exists'){showErr('CPF já cadastrado. Faça login na aba Entrar.');}
      else if(code==='functions/invalid-argument'){showErr(err.message||'Dados inválidos.');}
      else{console.error('Erro no cadastro:',err);showErr('Erro ao criar conta: '+(err.message||'tente novamente'));}
    }finally{if(btn){btn.disabled=false;btn.textContent='CRIAR CONTA';}}
    return;
  }
  // ── Fluxo legado (SHA-256 client-side) ──────────────────────────────────
  try{
    if(!window.crypto||!window.crypto.subtle){
      const cpfHash=await sha256Fallback(cpfRaw);
      const existing=Object.values(drivers).find(d=>d.cpfHash===cpfHash);
      if(existing){showErr('CPF já cadastrado');return;}
      const pinHash=await sha256Fallback(pin);
      const id='drv_'+Date.now();
      const driver={id,nome,cpfHash,cpfEnc:btoa(cpfRaw),pinHash,bloqueado:false,criadoEm:Date.now(),ultimoAcesso:Date.now()};
      if(db)await db.ref('motoristas/'+id).set(driver);
      currentDriver=driver;
      localStorage.setItem('drv_session',JSON.stringify({id,nome,pinHash}));
      showHome();return;
    }
    const cpfHash=await sha256(cpfRaw);
    const existing=Object.values(drivers).find(d=>d.cpfHash===cpfHash);
    if(existing){showErr('CPF já cadastrado. Faça login na aba Entrar.');return;}
    const pinHash=await sha256(pin);
    const cpfEnc=await encryptCPF(cpfRaw);
    const id='drv_'+Date.now();
    const driver={id,nome,cpfHash,cpfEnc,pinHash,bloqueado:false,criadoEm:Date.now(),ultimoAcesso:Date.now()};
    drivers[id]=driver;
    localStorage.setItem('drivers_local',JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('drivers_local')||'{}'),{[id]:driver})));
    currentDriver=driver;
    localStorage.setItem('drv_session',JSON.stringify({id,nome,pinHash}));
    if(db){db.ref('motoristas/'+id).set(driver).catch(e=>console.warn('Firebase sync pending:',e));}
    showSuccessMessage(nome);
  }catch(err){
    console.error('Erro no cadastro:',err);
    showErr('Erro ao criar conta: '+(err.message||'tente novamente'));
  }finally{
    if(btn){btn.disabled=false;btn.textContent='CRIAR CONTA';}
  }
}

async function doDriverLogin(){
  const cpfRaw=cleanCPF(document.getElementById('dLoginCPF')?.value||'');
  const pin=(document.getElementById('dLoginPIN')?.value||'').trim();
  const errEl=document.getElementById('dLoginError');
  const btn=document.querySelector('#dauthLoginForm .dauth-btn');
  function showErr(msg){errEl.textContent=msg||'CPF ou PIN incorretos';errEl.style.display='block';setTimeout(()=>errEl.style.display='none',4000);}
  if(cpfRaw.length!==11){showErr('CPF inválido — digite os 11 dígitos');return;}
  if(pin.length!==4){showErr('PIN deve ter 4 dígitos');return;}
  if(btn){btn.disabled=true;btn.textContent='Verificando...';}
  // ── USE_NEW_AUTH: login via Cloud Function ───────────────────────────────
  if(USE_NEW_AUTH){
    try{
      const fn=firebase.functions().httpsCallable('loginDriver');
      const result=await fn({cpf:cpfRaw,pin});
      const {token,pinResetRequired}=result.data;
      await firebase.auth().signInWithCustomToken(token);
      if(pinResetRequired){showForcedPINChangeModal(pin);}
      else{showHome();}
    }catch(err){
      const code=err.code||'';
      if(code==='functions/resource-exhausted'){showErr(err.message||'Muitas tentativas. Aguarde e tente novamente.');}
      else if(code==='functions/permission-denied'){showErr('Conta bloqueada. Contate o administrador.');}
      else{showErr('CPF ou PIN incorretos');}
    }finally{if(btn){btn.disabled=false;btn.textContent='ENTRAR';}}
    return;
  }
  // ── Fluxo legado (SHA-256 client-side) ──────────────────────────────────
  try{
    const hashFn=(!window.crypto||!window.crypto.subtle)?sha256Fallback:sha256;
    const cpfHash=await hashFn(cpfRaw);
    const pinHash=await hashFn(pin);
    const driver=Object.values(drivers).find(d=>d.cpfHash===cpfHash&&d.pinHash===pinHash);
    if(!driver){showErr('CPF ou PIN incorretos');return;}
    if(driver.bloqueado){showErr('Conta bloqueada. Contate o administrador.');return;}
    currentDriver=driver;
    if(db)db.ref('motoristas/'+driver.id+'/ultimoAcesso').set(Date.now());
    if(document.getElementById('saveCreds')?.checked){localStorage.setItem('drv_session',JSON.stringify({id:driver.id,nome:driver.nome,pinHash}));}
    showHome();
  }catch(err){
    console.error('Erro no login:',err);
    showErr('Erro ao entrar: '+(err.message||'tente novamente'));
  }finally{
    if(btn){btn.disabled=false;btn.textContent='ENTRAR';}
  }
}

function loadDriverSession(){
  try{
    const s=JSON.parse(localStorage.getItem('drv_session'));
    if(!s||!s.id)return false;
    currentDriver={id:s.id,nome:s.nome,pinHash:s.pinHash,_fromSession:true};
    return true;
  }catch(e){return false;}
}

function verifyDriverSession(){
  if(!currentDriver||!currentDriver._fromSession)return;
  const d=drivers[currentDriver.id];
  if(!d&&Object.keys(drivers).length===0){
    setTimeout(verifyDriverSession,1500);
    return;
  }
  if(!d||d.bloqueado||d.pinHash!==currentDriver.pinHash){
    currentDriver=null;localStorage.removeItem('drv_session');showDriverLogin();return;
  }
  currentDriver=d;
}

function logoutDriver(){
  currentDriver=null;adminMode=false;
  localStorage.removeItem('drv_session');
  firebase.auth().signOut().catch(()=>{});
  if(typeof hideBottomNav==='function')hideBottomNav();
  navReset('screenDriverLogin');
}

function promptLogout(){
  const ov=document.createElement('div');ov.className='confirm-overlay';
  ov.innerHTML=`<div class="confirm-box"><h3>Sair do app?</h3><p>Você precisará fazer login novamente na próxima vez.</p><div class="btns"><button style="background:#eae8e3;color:#1c1c1c;flex:1;padding:12px;border-radius:10px;border:none;font-weight:700;cursor:pointer" onclick="this.closest('.confirm-overlay').remove()">Cancelar</button><button style="background:#fe2627;color:#fff;flex:1;padding:12px;border-radius:10px;border:none;font-weight:700;cursor:pointer" onclick="logoutDriver();this.closest('.confirm-overlay').remove()">Sair</button></div></div>`;
  document.body.appendChild(ov);
}

function logoutAdmin(){
  adminMode=false;
  firebase.auth().signOut().catch(()=>{});
  if(typeof hideBottomNav==='function')hideBottomNav();
  navReset('screenDriverLogin');
}

function promptLogoutAdmin(){
  const ov=document.createElement('div');ov.className='confirm-overlay';
  ov.innerHTML=`<div class="confirm-box"><h3>Sair do modo admin?</h3><p>Você precisará fazer login novamente para acessar o painel.</p><div class="btns"><button style="background:#eae8e3;color:#1c1c1c;flex:1;padding:12px;border-radius:10px;border:none;font-weight:700;cursor:pointer" onclick="this.closest('.confirm-overlay').remove()">Cancelar</button><button style="background:#fe2627;color:#fff;flex:1;padding:12px;border-radius:10px;border:none;font-weight:700;cursor:pointer" onclick="logoutAdmin();this.closest('.confirm-overlay').remove()">Sair</button></div></div>`;
  document.body.appendChild(ov);
}


// ═══ TROCA FORÇADA DE PIN (pinResetRequired = true) ═══
function showForcedPINChangeModal(pinAtual){
  document.querySelector('.forced-pin-overlay')?.remove();
  const ov=document.createElement('div');ov.className='forced-pin-overlay confirm-overlay';
  ov.innerHTML=`<div class="confirm-box" style="max-width:340px;text-align:left">
    <h3 style="margin-bottom:8px">Troque seu PIN</h3>
    <p style="font-size:13px;color:#9a9894;margin-bottom:16px;font-family:'Barlow',sans-serif">Por segurança, você precisa definir um novo PIN antes de continuar.</p>
    <div class="login-field"><label>Novo PIN (4 dígitos)</label><input type="password" id="fpPINNovo" placeholder="&bull;&bull;&bull;&bull;" maxlength="4" inputmode="numeric" style="width:100%;padding:12px;border:1.5px solid #e4e2dd;border-radius:10px;font-family:'Barlow',sans-serif;font-size:14px;outline:none"></div>
    <div class="login-field" style="margin-top:10px"><label>Confirmar novo PIN</label><input type="password" id="fpPINNovo2" placeholder="&bull;&bull;&bull;&bull;" maxlength="4" inputmode="numeric" style="width:100%;padding:12px;border:1.5px solid #e4e2dd;border-radius:10px;font-family:'Barlow',sans-serif;font-size:14px;outline:none"></div>
    <div class="login-error" id="fpError" style="display:none;margin-top:8px"></div>
    <div class="btns" style="margin-top:16px">
      <button id="fpSaveBtn" style="background:#fe2627;color:#fff;flex:1;padding:12px;border-radius:10px;border:none;font-weight:700;cursor:pointer;font-family:'Barlow',sans-serif" onclick="doForcedPINChange(this.dataset.pin)" data-pin="${pinAtual}">SALVAR NOVO PIN</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  setTimeout(()=>document.getElementById('fpPINNovo')?.focus(),100);
}

async function doForcedPINChange(pinAtual){
  const pinNovo=(document.getElementById('fpPINNovo')?.value||'').trim();
  const pinNovo2=(document.getElementById('fpPINNovo2')?.value||'').trim();
  const errEl=document.getElementById('fpError');
  const btn=document.getElementById('fpSaveBtn');
  function showErr(msg){errEl.textContent=msg;errEl.style.display='block';setTimeout(()=>errEl.style.display='none',4000);}
  if(!/^\d{4}$/.test(pinNovo)){showErr('PIN deve ter 4 digitos numericos');return;}
  if(pinNovo!==pinNovo2){showErr('Os PINs nao coincidem');return;}
  if(pinNovo===pinAtual){showErr('O novo PIN deve ser diferente do atual');return;}
  if(btn){btn.disabled=true;btn.textContent='Salvando...';}
  try{
    const fn=firebase.functions().httpsCallable('changePIN');
    await fn({pinAtual,pinNovo});
    document.querySelector('.forced-pin-overlay')?.remove();
    showHome();
  }catch(err){
    showErr(err.message||'Erro ao salvar PIN. Tente novamente.');
  }finally{if(btn){btn.disabled=false;btn.textContent='SALVAR NOVO PIN';}}
}

function switchAuthTab(tab){
  const isLogin=tab==='login';
  document.getElementById('tabLoginBtn').classList.toggle('active',isLogin);
  document.getElementById('tabRegisterBtn').classList.toggle('active',!isLogin);
  document.getElementById('dauthLoginForm').style.display=isLogin?'block':'none';
  document.getElementById('dauthRegisterForm').style.display=isLogin?'none':'block';
}

// ═══ ADMIN LOGIN ═══
function showAdminLogin(){
  document.querySelector('.login-overlay')?.remove();
  const ov=document.createElement('div');ov.className='login-overlay';
  ov.innerHTML=`<div class="login-box"><div class="login-logo"><div class="lb"><span>C</span></div><span class="lt">CONFIANÇA</span></div><div class="login-title">Área Restrita</div><div class="login-sub">Credenciais de administrador</div><div class="login-field"><label>Usuário</label><input type="text" id="loginUser" placeholder="Usuário" autocomplete="off"></div><div class="login-field"><label>Senha</label><input type="password" id="loginPass" placeholder="Senha"></div><button class="login-btn" onclick="doAdminLogin()">ENTRAR</button><div class="login-error" id="loginError">Usuário ou senha incorretos</div><button class="login-cancel" onclick="this.closest('.login-overlay').remove()">Cancelar</button></div>`;
  document.body.appendChild(ov);setTimeout(()=>document.getElementById('loginUser')?.focus(),100);
  ov.addEventListener('keydown',e=>{if(e.key==='Enter')doAdminLogin();});
}

async function doAdminLogin(){
  const u=(document.getElementById('loginUser')?.value||'').trim();
  const p=(document.getElementById('loginPass')?.value||'').trim();
  const btn=document.querySelector('.login-btn');
  const errEl=document.getElementById('loginError');
  if(!u||!p){if(errEl){errEl.textContent='Preencha usuário e senha';errEl.style.display='block';setTimeout(()=>errEl.style.display='none',3000);}return;}
  if(btn){btn.disabled=true;btn.textContent='Aguarde...';}
  try{
    adminMode=true; // Seta ANTES do signIn para evitar race com onAuthStateChanged
    await firebase.auth().signInWithEmailAndPassword(u,p);
    document.querySelector('.login-overlay')?.remove();
    if(typeof hideBottomNav==='function')hideBottomNav();
    renderAdmin();
    // Guard: onAuthStateChanged pode ter feito navPush('screenAdmin') antes desta
    // continuação (race condition com Firebase SDK). Só empurra se ainda não estiver na pilha.
    if(!_navStack.includes('screenAdmin')){
      navPush('screenAdmin');
    }
  }catch(err){
    adminMode=false; // Reseta se o login falhou
    console.error('Admin login error:',err);
    if(errEl){errEl.textContent='Usuário ou senha incorretos';errEl.style.display='block';setTimeout(()=>errEl.style.display='none',3000);}
  }finally{
    if(btn){btn.disabled=false;btn.textContent='ENTRAR';}
  }
}



