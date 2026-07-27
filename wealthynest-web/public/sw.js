// Deliberately minimal: this exists to make the PWA installable with a real fetch handler (a
// prerequisite for a Play Store TWA, not just "Add to Home Screen") and to show a real page
// instead of the browser's own offline error when the network drops mid-navigation — nothing
// more. It does NOT cache API responses, account/expense/investment data, or Next.js's RSC
// payloads: this is a finance app, and a service worker silently serving yesterday's balance
// while offline is worse than no offline support at all. Only navigation requests are
// intercepted; every other request (API calls, static chunks, images) goes straight to the
// network untouched.
const CACHE_NAME = "wealthynest-shell-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL))
  );
});
