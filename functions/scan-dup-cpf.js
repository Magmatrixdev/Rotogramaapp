// scan-dup-cpf.js — SOMENTE LEITURA. Não altera nada no banco.
// Lista motoristas com CPF (cpfHmac) duplicado e registros sem cpfHmac.
// Uso: coloque na mesma pasta do service-account.json e rode:  node scan-dup-cpf.js
const admin = require('firebase-admin');
const serviceAccount = require('C:/Users/user/Desktop/service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://rotogramas-confianca-default-rtdb.firebaseio.com',
});

(async () => {
  const snap = await admin.database().ref('motoristas').once('value');
  const motoristas = snap.val() || {};
  const porHmac = {};
  const semHmac = [];

  for (const [uid, d] of Object.entries(motoristas)) {
    const h = d && d.cpfHmac;
    if (!h) { semHmac.push({ uid, nome: (d && d.nome) || '(sem nome)' }); continue; }
    (porHmac[h] = porHmac[h] || []).push({
      uid,
      nome: d.nome || '(sem nome)',
      temPinSalt: !!d.pinSalt,          // sem pinSalt = hash legado, login novo falha
      bloqueado: !!d.bloqueado,
      ultimoAcesso: d.ultimoAcesso || 0,
    });
  }

  const dups = Object.entries(porHmac).filter(([, arr]) => arr.length > 1);

  console.log('Total de motoristas:', Object.keys(motoristas).length);
  console.log('\n===== CPFs DUPLICADOS (mesmo cpfHmac em 2+ nós) =====');
  if (!dups.length) {
    console.log('Nenhum. 👍');
  } else {
    for (const [h, arr] of dups) {
      console.log('\ncpfHmac ...' + h.slice(-8) + '  (' + arr.length + ' registros):');
      arr.forEach((r) => console.log(
        '   uid=' + r.uid +
        ' | nome=' + r.nome +
        ' | pinSalt=' + (r.temPinSalt ? 'sim' : 'NÃO(legado)') +
        ' | bloqueado=' + r.bloqueado +
        ' | ultimoAcesso=' + (r.ultimoAcesso ? new Date(r.ultimoAcesso).toLocaleString('pt-BR') : 'nunca')
      ));
    }
    console.log('\n👉 Para cada grupo: mantenha o nó com pinSalt=sim e ultimoAcesso mais recente;');
    console.log('   apague os demais pelo app (Admin → Motoristas → Excluir).');
  }

  console.log('\n===== REGISTROS SEM cpfHmac (login nunca acha → "CPF não cadastrado") =====');
  if (!semHmac.length) console.log('Nenhum. 👍');
  else semHmac.forEach((r) => console.log('   uid=' + r.uid + ' | nome=' + r.nome));

  process.exit(0);
})().catch((e) => { console.error('Erro:', e.message); process.exit(1); });
