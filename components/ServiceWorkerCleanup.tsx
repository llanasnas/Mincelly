"use client";

import { useEffect } from "react";

/**
 * Removes the service worker that earlier versions of Mincely registered.
 * That worker intercepted POST uploads and broke them on mobile ("TypeError:
 * Failed to fetch"); see public/sw.js for the full story.
 *
 * The app no longer registers a worker at all — this only cleans up devices that
 * still have the old one. A stale worker keeps controlling the page until it is
 * reloaded, hence the single reload.
 */
export function ServiceWorkerCleanup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .getRegistrations()
      .then(async (registrations) => {
        if (registrations.length === 0) return;

        await Promise.all(registrations.map((r) => r.unregister()));
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((key) => caches.delete(key)));
        }
        if (navigator.serviceWorker.controller) window.location.reload();
      })
      .catch(() => {
        // Nothing to clean up, or the browser refused — either way the app works.
      });
  }, []);

  return null;
}
