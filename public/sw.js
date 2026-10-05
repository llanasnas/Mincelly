// Self-destroying service worker.
//
// Mincely used to ship a pass-through worker for PWA installability. Re-issuing
// POST requests through `fetch(event.request)` re-reads the body stream, which
// broke file uploads on mobile Chrome ("TypeError: Failed to fetch"). Browsers no
// longer need a worker to install a PWA, so the fix is to have none.
//
// Devices that installed the old worker still poll this URL for updates. Serving
// this file makes them replace it with a worker that takes over every open tab,
// reloads it so it runs the current app, and then removes itself.

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))

      // Tabs opened under the old worker are not controlled by this one yet, and
      // only controlled tabs can be navigated — claim them first.
      await self.clients.claim()
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      await Promise.all(clients.map((client) => client.navigate(client.url).catch(() => null)))

      await self.registration.unregister()
    })(),
  )
})
