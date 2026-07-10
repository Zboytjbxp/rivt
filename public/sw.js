const CACHE = 'rivt-v5-2026-07-09-preview-recovery';
const OFFLINE_DOCUMENT = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RIVT needs a connection</title><style>body{margin:0;display:grid;min-height:100vh;place-items:center;padding:24px;box-sizing:border-box;background:#ff4b00;color:#0b0b0b;font:16px/1.45 Arial,sans-serif}main{width:min(100%,380px)}h1{margin:10px 0;font-size:34px;line-height:1}strong{letter-spacing:.12em}</style></head><body><main><strong>RIVT</strong><h1>Connect to open RIVT.</h1><p>This app update needs a connection before it can open safely. Your server-backed account and records are not affected.</p></main></body></html>`;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .catch(() => new Response(OFFLINE_DOCUMENT, {
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
          status: 503,
        }))
    );
    return;
  }
  if (!url.pathname.startsWith('/assets/')) return;
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request).then((response) => {
      if (response.ok && response.type === 'basic') {
        const clone = response.clone();
        void caches.open(CACHE).then((cache) => cache.put(e.request, clone));
      }
      return response;
    }))
  );
});

// Push notification handler
self.addEventListener('push', e => {
  let data = { title: 'RIVT', body: 'You have a new notification.' };
  try {
    if (e.data) data = { title: 'RIVT', ...e.data.json() };
  } catch {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/rivt-maskable-icon-192.png',
      badge: '/rivt-favicon-192.png',
      tag: data.tag || 'rivt-push',
      data: data.url ? { url: data.url } : undefined,
    })
  );
});

// Notification click handler
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin));
      if (existing) {
        if ('navigate' in existing) return existing.navigate(url).then(c => c?.focus());
        return existing.focus();
      }
      return clients.openWindow(url);
    })
  );
});
