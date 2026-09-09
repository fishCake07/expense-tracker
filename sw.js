const CACHE_NAME = "expense-tracker-cache-v82";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css?v=82",
  "./app.js?v=82",
  "./auth-sync.js?v=82",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// Install Event: Cache all assets and force immediate activation
self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate Event: Purge all old caches and claim all clients immediately
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: NETWORK-FIRST with offline Cache fallback
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  // Strictly bypass service worker for any API requests
  if (e.request.url.includes("/api/")) return;

  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Offline fallback
        return caches.match(e.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (e.request.mode === "navigate" && !e.request.url.includes("/api/")) {
            return caches.match("./index.html");
          }
        });
      })
  );
});
