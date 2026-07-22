const APP_VERSION = "2026.07.22.6";
const CACHE_NAME = `runner-${APP_VERSION}`;
const APP_FILES = [
  "/",
  "/index.html",
  `/manifest.json?v=${APP_VERSION}`,
  `/style.css?v=${APP_VERSION}`,
  `/side-quests.js?v=${APP_VERSION}`,
  `/path-system.js?v=${APP_VERSION}`,
  `/xp-system.js?v=${APP_VERSION}`,
  `/app.js?v=${APP_VERSION}`,
  `/app-version.json?v=${APP_VERSION}`,
  "/sw.js",
  `/icons/icon-192.svg?v=${APP_VERSION}`,
  `/icons/icon-512.svg?v=${APP_VERSION}`
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME && (k.startsWith("halfmarathon-") || k.startsWith("runner-"))).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.matchAll({ type: "window" }))
      .then((clients) => clients.forEach((client) => client.postMessage({ type: "APP_UPDATED", version: APP_VERSION })))
  );
  self.clients.claim();
});

// Focus an already-open tab if there is one, otherwise open a new one --
// used by the rule-based notifications in app.js (see Notifications there).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("/");
    })
  );
});

// Network-first: always fetch fresh, fall back to cache only when offline
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(new Request(event.request, { cache: "reload" }))
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
