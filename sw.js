// Offline support: the app shell is precached and refreshed behind the
// scenes. Bump CACHE when shipping asset changes so clients update.
const CACHE = 'tfc-cache-v1';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './images/icons/icon.svg',
  './images/icons/icon-192.png',
  './images/icons/icon-512.png',
  './css/main.css',
  './css/base.css',
  './css/card.css',
  './css/form.css',
  './css/results.css',
  './css/history.css',
  './css/sections.css',
  './css/info-box.css',
  './css/theme-switcher.css',
  './css/dark-theme.css',
  './js/main.js',
  './js/App.js',
  './js/UI.js',
  './js/CostCalculator.js',
  './js/HistoryStore.js',
  './js/ChildStore.js',
  './js/HistoryChart.js',
  './js/DateUtil.js',
  './js/config.js',
  './js/format.js',
  './js/Settings.js',
  './js/ThemeSwitcher.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) {
    return;
  }
  if (request.mode === 'navigate') {
    // Network first so updates arrive promptly, with the cached shell offline
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }
  // Stale-while-revalidate for the app shell assets
  event.respondWith(
    caches.match(request).then(cached => {
      const refresh = fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || refresh;
    })
  );
});
