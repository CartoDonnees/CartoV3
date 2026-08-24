/* CARTODONNEES V3 - service worker (cache terrain hors-ligne) */
const CACHE = "cartodonnees-v1";
const CORE = ["/carte", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // GeoJSON & statiques : cache-first (mise en cache au vol)
  if (url.pathname.startsWith("/geojson/") || url.pathname.startsWith("/_next/static/")) {
    e.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // Navigations : réseau d'abord, repli cache
  if (request.mode === "navigate") {
    e.respondWith(fetch(request).catch(() => caches.match("/carte")));
  }
});
