const CACHE = 'rotograma-v12';
const STATIC = [
  './manifest.json',
  './icon-192.png',
  './icon-192-maskable.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

// ═══ FIREBASE CLOUD MESSAGING (push com o app fechado) ═══
// Envolvido em try/catch: se o dispositivo estiver offline no momento em que o
// SW inicia, o importScripts falha — sem o catch isso quebraria TODO o Service
// Worker (cache e fetch inclusive), deixando o app sem funcionamento offline.
try {
  importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');
  firebase.initializeApp({
    apiKey: 'AIzaSyAbYd2RulYeBr-_IQ8G4ccmzxKf8gAjLPQ',
    authDomain: 'rotogramas-confianca.firebaseapp.com',
    databaseURL: 'https://rotogramas-confianca-default-rtdb.firebaseio.com',
    projectId: 'rotogramas-confianca',
    storageBucket: 'rotogramas-confianca.firebasestorage.app',
    messagingSenderId: '156398881281',
    appId: '1:156398881281:web:a67f3e2ee02b969ab78e00'
  });
  firebase.messaging().onBackgroundMessage(payload => {
    const d = payload.data || {};
    const titulo = d.titulo || 'Rotogramas — Confiança';
    const corpo = d.mensagem || '';
    // Mesmo esquema de tag usado por _maybeShowNative no app: se a mesma
    // notificação chegar pelos dois caminhos, o navegador substitui em vez
    // de empilhar duas.
    return self.registration.showNotification(titulo, {
      body: corpo,
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: 'rot-' + (d.id || Date.now()),
      renotify: true,
      data: { tipo: d.tipo || '', rota: d.rota || '', id: d.id || '' }
    });
  });
} catch (e) {
  // Sem FCM nesta sessão do SW — cache e offline seguem funcionando normalmente
}

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data?.type === 'CLEAR_CACHE') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Requisições externas (Firebase, Mapbox, CDNs): passam direto
  if (url.origin !== self.location.origin) return;

  // HTML, raiz, sw.js: NÃO interceptar — browser busca direto do servidor
  // Isso garante que atualizações do index.html chegam sempre
  const p = url.pathname;
  if (
    p.endsWith('.html') ||
    p.includes('sw.js') ||
    p === '/' ||
    p.endsWith('/')
  ) {
    return; // sem respondWith = comportamento padrão do browser
  }

  // JS e CSS: network-first (sempre tenta buscar a versão mais nova;
  // só cai pro cache se estiver offline). Evita ficar preso em versão
  // antiga de app-*.js mesmo depois de bump de APP_VERSION + hard refresh,
  // já que o Service Worker intercepta o fetch antes do cache HTTP do navegador.
  if (p.endsWith('.js') || p.endsWith('.css')) {
    e.respondWith(
      fetch(e.request).then(res => {
        caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() =>
        caches.match(e.request).then(cached => cached || new Response('Offline', { status: 503, statusText: 'Service Unavailable' }))
      )
    );
    return;
  }

  // Ícones e manifest: cache-first (raramente mudam, prioriza uso offline)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      });
    }).catch(() => new Response('Offline', { status: 503, statusText: 'Service Unavailable' }))
  );
});

// Notification click: foca ou abre o app, indo direto para a rota do aviso
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const rota = e.notification.data?.rota || '';
  const alvo = rota ? './#rota=' + encodeURIComponent(rota) : './';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      if (clients.length > 0) {
        const c = clients[0];
        if (rota && 'navigate' in c) return c.navigate(alvo).then(w => w && w.focus()).catch(() => c.focus());
        return c.focus();
      }
      return self.clients.openWindow(alvo);
    })
  );
});
