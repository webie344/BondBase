// Service Worker for Group Chat App
const CACHE_NAME = 'groupchat-v1';

// Install event - cache important files
self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll([
          '/',
          '/index.html',
          '/group.html',
          '/groups.html',
          '/login.html',
          '/set.html',
          '/groupchat.js',
          '/calls.js'
        ]).catch(error => {
          console.log('Cache addAll error:', error);
        });
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Claim clients immediately
  return self.clients.claim();
});

// Fetch event - serve from cache if available
self.addEventListener('fetch', event => {
  // Skip non-GET requests and Chrome extensions
  if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension://')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Return cached response if found
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Otherwise fetch from network
        return fetch(event.request)
          .then(response => {
            // Don't cache if not a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone the response for caching
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch(error => {
            console.log('Fetch failed:', error);
            // You could return a custom offline page here
            return new Response('Network error occurred', {
              status: 408,
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});

// Message event handling
self.addEventListener('message', event => {
  console.log('Service Worker received message:', event.data);
  
  if (event.data && event.data.type) {
    const port = event.ports && event.ports[0];
    
    switch (event.data.type) {
      case 'APP_CONFIG':
        console.log('App config received');
        if (port) port.postMessage({ status: 'config_received' });
        break;
        
      case 'NETWORK_ONLINE':
        console.log('Network online');
        // Try to sync any offline data
        if (event.data.sync) {
          event.waitUntil(syncOfflineData());
        }
        break;
        
      case 'NETWORK_OFFLINE':
        console.log('Network offline');
        break;
        
      case 'CACHE_DATA':
        console.log('Cache data:', event.data.url);
        if (event.data.url && event.data.data) {
          caches.open(CACHE_NAME).then(cache => {
            const response = new Response(JSON.stringify(event.data.data), {
              headers: { 'Content-Type': 'application/json' }
            });
            cache.put(event.data.url, response);
          });
        }
        break;
        
      case 'GET_CACHED_DATA':
        console.log('Get cached data:', event.data.url);
        if (event.data.url && port) {
          caches.match(event.data.url)
            .then(response => {
              if (response) {
                return response.json();
              }
              return null;
            })
            .then(data => {
              port.postMessage(data);
            })
            .catch(error => {
              port.postMessage(null);
            });
        }
        break;
    }
  }
});

// Background sync for offline data
async function syncOfflineData() {
  console.log('Syncing offline data...');
  // You can implement offline data sync here
  // For example, send pending messages stored in IndexedDB
}

// Periodic cache cleanup
setInterval(() => {
  caches.open(CACHE_NAME).then(cache => {
    cache.keys().then(requests => {
      console.log(`Cache has ${requests.length} items`);
    });
  });
}, 300000); // Every 5 minutes

