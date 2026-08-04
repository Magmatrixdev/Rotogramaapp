const CACHE = 'rotograma-v4';
const STATIC = [
  './manifest.json',
  './icon-192.png',
  './icon-192-maskable.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

// Instala: cacheia só os assets estáticos (ícones, manifest)
// index.html é sempre buscado da rede (network-first)
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

// Ativa: deleta caches antigos e assume controle imediatamente
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Mensagem do app para forçar atualização (skip waiting)
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Serviços externos — deixa passar sem cache
  const external = ['firebasedatabase', 'googleapis', 'gstatic', 'unpkg', 'openstreetmap', 'tile.', 'cartocdn', 'fonts.'];
  if (external.some(h => url.hostname.includes(h) || url.href.includes(h))) return;

  // index.html — SEMPRE tenta buscar da rede primeiro (network-first)
  // Garante que updates cheguem imediatamente
  if (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/')) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then(res => {
          // Salva cópia nova no cache
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => caches.match('./index.html')) // offline: usa cache
    );
    return;
  }

  // Outros assets locais (ícones etc) — cache-first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      });
    }).catch(() => caches.match('./index.html'))
  );
});
