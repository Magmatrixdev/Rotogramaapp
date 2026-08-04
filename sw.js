const CACHE='rotograma-v3';
const ASSETS=['./','./index.html','./manifest.json'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{if(e.request.url.includes('firebasedatabase')||e.request.url.includes('googleapis')||e.request.url.includes('openstreetmap')||e.request.url.includes('unpkg'))return;e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{const rc=res.clone();caches.open(CACHE).then(c=>c.put(e.request,rc));return res}).catch(()=>caches.match('./index.html'))))});
