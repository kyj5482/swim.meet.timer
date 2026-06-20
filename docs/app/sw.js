// SplitLane service worker.
//
// Strategy: NETWORK-FIRST for the app shell (HTML / CSS / JS / manifest) so an
// installed home-screen PWA always shows the latest deploy when online, and
// CACHE-FIRST only for static icons. Offline still works via the cache fallback.
// Bumping CACHE wipes old caches on activate.
const CACHE = 'splitlane-v2';
const ASSETS = [
  '.',
  'index.html',
  'manifest.webmanifest',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  // Activate the new worker immediately instead of waiting for old tabs to close.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Let the page trigger an immediate activation after an update is found.
self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

function putInCache(req, res) {
  const copy = res.clone();
  caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // ignore cross-origin

  const isShell =
    req.mode === 'navigate' ||
    url.pathname.endsWith('/') ||
    /\.(html|css|js|webmanifest|json)$/.test(url.pathname);

  if (isShell) {
    // Network-first: always try the network, fall back to cache when offline.
    e.respondWith(
      fetch(req)
        .then((res) => putInCache(req, res))
        .catch(() => caches.match(req).then((hit) => hit || caches.match('index.html')))
    );
  } else {
    // Cache-first for icons / images.
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => putInCache(req, res)))
    );
  }
});
