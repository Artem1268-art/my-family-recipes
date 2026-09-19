const CACHE_NAME = 'lime-recipes-v3';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', e => {
  // Пропускаем все фоновые проверки, чтобы телефон мгновенно одобрял безопасность сайта
  e.respondWith(fetch(e.request));
});

