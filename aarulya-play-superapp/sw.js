const CACHE_NAME = 'aarulya-play-local-v2';
const APP_SHELL = [
  './', './index.html', './styles.css', './monetization.css', './phase-two-games.css',
  './learning.html', './learning.css', './privacy.html', './manifest.webmanifest',
  './src/app.js', './src/battle-engine.js', './src/game-catalog.js', './src/monetization-policy.js',
  './src/phase-two-games.js', './src/platform-controls.js', './src/revenue-policy.js',
  './src/learning-games.js', './src/learning-app.js', './src/pwa.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    if (response.ok && new URL(event.request.url).origin === self.location.origin) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
    }
    return response;
  }).catch(() => caches.match('./index.html'))));
});
