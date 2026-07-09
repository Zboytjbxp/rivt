const CACHE = 'rivt-v4-2026-07-08';
const PRECACHE = ['/', '/index.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)));
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
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then(res => {
        if (res.ok && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(e.request);
        if (cached) return cached;
        if (e.request.mode === 'navigate') return caches.match('/index.html');
        return Response.error();
      })
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
