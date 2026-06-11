const CACHE_NAME = 'task-tracker-v1';
const urlsToCache = [
  '/',
  '/index.html'
];

// Install event - cache essential files
self.addEventListener('install', event => {
  console.log('[ServiceWorker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[ServiceWorker] Caching essential files');
      return cache.addAll(urlsToCache).catch(err => {
        console.log('[ServiceWorker] Cache addAll error:', err);
        // Continue even if some files fail to cache
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[ServiceWorker] Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  // Skip API calls - always go to network
  if (event.request.url.includes('/api/')) {
    return event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({ error: 'Offline - API not available' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      // Return cached response if available
      if (response) {
        return response;
      }

      return fetch(event.request)
        .then(response => {
          // Only cache successful responses
          if (!response || response.status !== 200 || response.type === 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          // Cache successful responses for static assets
          if (event.request.method === 'GET') {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }

          return response;
        })
        .catch(() => {
          // Return offline fallback or cached response
          return caches.match(event.request).then(cachedResponse => {
            return cachedResponse || new Response(
              'Offline - Resource not available',
              { status: 503 }
            );
          });
        });
    })
  );
});

// Message event - for skip-waiting
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
