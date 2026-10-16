const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const sa = require('./serviceAccountKey.json');

initializeApp({ credential: cert(sa) });

getAuth().getUserByEmail('pedrosgj@gmail.com')
  .then(user => {
    console.log('UID:', user.uid);
    return getAuth().setCustomUserClaims(user.uid, { admin: true });
  })
  .then(() => { console.log('Claim admin:true setado!'); process.exit(0); })
  .catch(e => { console.error('Erro:', e.message); process.exit(1); });
