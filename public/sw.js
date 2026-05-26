// Minimal service worker — required for PWA installability
// No caching strategy: acts as a pass-through to avoid interfering with Next.js

self.addEventListener('install', (event) => {
    // @ts-ignore
    self.skipWaiting()
})

self.addEventListener('activate', (event) => {
    // @ts-ignore
    self.clients.claim()
})

// Pass all fetch requests through to the network
self.addEventListener('fetch', (event) => {
    // @ts-ignore
    event.respondWith(fetch(event.request))
})
