const CACHE = 'rotograma-v10';
const STATIC = [
  './manifest.json',
  './icon-192.png',
  './icon-192-maskable.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

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

  // Ícones e manifest: cache-first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      });
    }).catch(() => null)
  );
});

// Notification click: foca ou abre o app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      if (clients.length > 0) return clients[0].focus();
      return self.clients.openWindow('./');
    })
  );
});
