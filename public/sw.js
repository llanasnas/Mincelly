// Self-destroying service worker.
//
// Mincely used to ship a pass-through worker for PWA installability. Re-issuing
// POST requests through `fetch(event.request)` re-reads the body stream, which
// broke file uploads on mobile Chrome ("TypeError: Failed to fetch"). Browsers no
// longer need a worker to install a PWA, so the fix is to have none.
//
// Devices that installed the old worker still poll this URL for updates. Serving
// this file makes them replace it with a worker that removes itself and hands
// every request back to the network.

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
      await self.registration.unregister()
      const clients = await self.clients.matchAll({ type: 'window' })
      // Reload open tabs so they stop being controlled by a worker.
      await Promise.all(clients.map((client) => client.navigate(client.url)))
    })(),
  )
})
