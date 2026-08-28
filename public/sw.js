/**
 * public/sw.js
 * SheZen service worker — offline caching for PWA support.
 *
 * Strategy:
 *  - Cache-first for static assets (_next/static/*)
 *  - Network-first for HTML pages (so updates propagate quickly)
 *  - Cache-first for fonts (long-lived)
 *
 * This is a hand-written service worker because next-pwa is incompatible
 * with Next.js 16's Turbopack build. Upgrade to @serwist/next when it
 * fully supports Turbopack.
 */

const CACHE_NAME = "shezen-v2";
const FONT_CACHE = "shezen-fonts-v2";

// Assets to pre-cache on install (adjust paths after a production build
// reveals the actual hashed filenames — for now just cache the shell).
const PRECACHE_URLS = ["/", "/cycle", "/journal", "/notes", "/vault", "/privacy", "/unlock", "/setup"];

// ─── Install ──────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {
      // Silently ignore — pages may not exist yet during dev
    })
  );
  self.skipWaiting();
});

// ─── Activate ─────────────────────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== FONT_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch ────────────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and non-same-origin requests.
  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin && !url.hostname.includes("fonts.")) return;

  // Font files: cache-first, long TTL.
  if (
    url.hostname.includes("fonts.gstatic.com") ||
    url.hostname.includes("fonts.googleapis.com")
  ) {
    event.respondWith(
      caches.open(FONT_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((res) => {
            cache.put(request, res.clone());
            return res;
          });
        })
      )
    );
    return;
  }

  // Static Next.js assets: cache-first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          });
        })
      )
    );
    return;
  }

  // HTML pages: network-first with cache fallback.
  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, res.clone()));
          }
          return res;
        })
        .catch(() => caches.match(request).then((cached) => cached ?? caches.match("/")))
    );
    return;
  }
});
