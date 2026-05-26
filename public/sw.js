// Minimal service worker — required for PWA installability
// No caching strategy: acts as a pass-through to avoid interfering with Next.js

self.addEventListener('install', () => {
    // @ts-expect-error -- service worker global, skipWaiting not typed
    self.skipWaiting()
})

self.addEventListener('activate', () => {
    // @ts-expect-error -- service worker global, clients not typed
    self.clients.claim()
})

// Pass all fetch requests through to the network
self.addEventListener('fetch', (event) => {
    // @ts-expect-error -- FetchEvent.respondWith not typed in this context
    event.respondWith(fetch(event.request))
})
