const CACHE_NAME = 'diet-tracker-v5'

self.addEventListener('install', e => {
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  // Delete every old cache on activation
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// Never cache — always fetch from network
self.addEventListener('fetch', e => {
  e.respondWith(fetch(e.request))
})
