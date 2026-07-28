const BUILD_ID = new URL(self.location.href).searchParams.get('build') || 'development';
const CACHE = `rivt-assets-${BUILD_ID.replace(/[^a-z0-9_-]+/gi, '-').slice(-72)}`;
const OFFLINE_DOCUMENT = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RIVT needs a connection</title><style>body{margin:0;display:grid;min-height:100vh;place-items:center;padding:24px;box-sizing:border-box;background:#ff4b00;color:#0b0b0b;font:16px/1.45 Arial,sans-serif}main{width:min(100%,380px)}h1{margin:10px 0;font-size:34px;line-height:1}strong{letter-spacing:.12em}</style></head><body><main><strong>RIVT</strong><h1>Connect to open RIVT.</h1><p>This app update needs a connection before it can open safely. Your server-backed account and records are not affected.</p></main></body></html>`;

async function precacheAppShell() {
  const cache = await caches.open(CACHE);
  const response = await fetch('/app', { cache: 'no-store' });
  if (!response.ok) throw new Error(`App shell returned ${response.status}`);
  const html = await response.clone().text();
  const assetPaths = [...html.matchAll(/(?:src|href)=["'](\/assets\/[^"'?#]+(?:\?[^"']*)?)["']/g)]
    .map((match) => match[1]);
  const requiredPaths = [...new Set([
    ...assetPaths,
    '/assets/fonts/instrument-sans-latin.woff2',
    '/assets/fonts/ibm-plex-mono-600-latin.woff2',
  ])];

  // Do not activate a partial shell. If any required asset cannot be cached,
  // installation fails and the previous worker keeps serving its known-good cache.
  await Promise.all(requiredPaths.map((assetPath) => cache.add(assetPath)));
  await cache.put('/', response.clone());
  await cache.put('/app', response);
}

self.addEventListener('install', e => {
  e.waitUntil(precacheAppShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const [rootShell, appShell] = await Promise.all([
      cache.match('/'),
      cache.match('/app'),
    ]);
    if (!rootShell || !appShell) {
      throw new Error('Refusing to activate an incomplete RIVT app shell.');
    }
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            void caches.open(CACHE).then((cache) => {
              void cache.put('/', clone);
            });
          }
          return response;
        })
        .catch(async () => (
          await caches.match('/app')
          || await caches.match('/')
          || new Response(OFFLINE_DOCUMENT, {
            headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
            status: 503,
          })
        ))
    );
    return;
  }
  if (!url.pathname.startsWith('/assets/') && !url.pathname.startsWith('/brand/')) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(e.request, { ignoreSearch: true });
    if (cached) return cached;

    const response = await fetch(e.request);
    if (response.ok && response.type === 'basic') {
      await cache.put(e.request, response.clone());
    }
    return response;
  })());
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
      // Android status bars require a monochrome mark on a transparent canvas.
      badge: '/rivt-notification-badge-192.png',
      tag: data.tag || 'rivt-push',
      data: data.url ? { url: data.url } : undefined,
    })
  );
});

// Notification click handler
self.addEventListener('notificationclick', e => {
  e.notification.close();
  let url = '/';
  try {
    const requested = new URL(e.notification.data?.url || '/', self.location.origin);
    if (requested.origin === self.location.origin) url = `${requested.pathname}${requested.search}${requested.hash}`;
  } catch {}
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
