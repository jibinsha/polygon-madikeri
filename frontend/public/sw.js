const VERSION = "polygon-madikeri-v5";
const APP_CACHE = `${VERSION}-app`;
const TILE_CACHE = `${VERSION}-tiles`;
const APP_SHELL = [
  "/",
  "/index.html",
  "/Final_Field_Plan.csv",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== APP_CACHE && key !== TILE_CACHE).map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Map tiles are cached as they are viewed. This gives field users an
  // offline copy of the areas they have already opened without changing the
  // map workflow or downloading the whole region up front.
  if (request.method === "GET" && (
    url.hostname === "tile.openstreetmap.org" ||
    url.hostname.endsWith(".tile.openstreetmap.org")
  )) {
    event.respondWith((async () => {
      const cache = await caches.open(TILE_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok || response.type === "opaque") cache.put(request, response.clone()).catch(() => {});
        return response;
      } catch {
        return cached || Response.error();
      }
    })());
    return;
  }

  // For application navigation, use the network when available and fall
  // back to the cached app shell. This also makes deep-link refreshes work
  // when the device has no signal.
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(APP_CACHE);
          cache.put("/index.html", response.clone()).catch(() => {});
        }
        return response;
      } catch {
        return (await caches.match("/index.html")) || (await caches.match("/"));
      }
    })());
    return;
  }

  // Cache same-origin static application assets. Vite's hashed assets are
  // immutable, so cache-first is safe and fast in the field.
  if (request.method === "GET" && url.origin === self.location.origin && !url.pathname.startsWith("/api/")) {
    event.respondWith((async () => {
      const cache = await caches.open(APP_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone()).catch(() => {});
        return response;
      } catch {
        return cached || Response.error();
      }
    })());
  }
});
