/**
 * GOLPE — Service Worker
 * Estratégia: cache-first para assets estáticos, network-first para HTML.
 * NÃO intercepta Socket.IO (WebSocket) — vai sempre para rede.
 */

const CACHE = 'golpe-v1';

// ── Install: skipWaiting para ativar imediatamente ────────────────────────────
self.addEventListener('install', () => self.skipWaiting());

// ── Activate: remove caches antigos ──────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Nunca interceptar socket.io ou origens externas (server API, CDN de fontes etc.)
  if (url.hostname !== self.location.hostname) return;
  if (url.pathname.startsWith('/socket.io')) return;

  // Assets com hash Vite (/assets/...) — cache-first com atualização em background
  if (url.pathname.startsWith('/assets/') ||
      /\.(js|css|woff2?|png|jpg|jpeg|svg|ico|webp|gif)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(cached => {
        const network = fetch(req).then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()));
          return res;
        });
        return cached || network;
      })
    );
    return;
  }

  // HTML e rotas da SPA — network-first (garante versão atualizada)
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()));
        return res;
      })
      .catch(() => caches.match(req).then(c => c || caches.match('/')))
  );
});
