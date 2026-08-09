// Static-assets-only service worker.
// Caches ONLY /_next/static/* and /icons/* (immutable, content-hashed).
// Pages, RSC payloads, API calls are NOT intercepted — the browser talks
// to the network directly, so a deploy can never be shadowed by stale
// cached HTML/RSC from a previous build.
const STATIC_CACHE = "inspekcja-static-v2"

const PRECACHE_ASSETS = ["/icons/icon-192.png", "/icons/icon-512.png"]

self.addEventListener("install", (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .catch(() => {})
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key !== STATIC_CACHE)
              .map((key) => caches.delete(key).catch(() => false))
          )
        )
        .catch(() => {}),
    ]).catch(() => {})
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return

  const url = new URL(request.url)
  if (url.origin !== location.origin) return

  // Auth routes: never intercept.
  if (url.pathname.startsWith("/auth")) return

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(cacheFirst(request))
  }
  // Everything else: no respondWith — browser handles it natively.
})

// Never rejects: every await is guarded so respondWith always receives
// a Response (cached → network → bare fetch retry → 503).
async function cacheFirst(request) {
  let cache = null
  try {
    cache = await caches.open(STATIC_CACHE)
  } catch {
    cache = null
  }

  if (cache) {
    try {
      const cached = await cache.match(request)
      if (cached) return cached
    } catch {
      // cache.match failed — fall through to network
    }
  }

  try {
    const response = await fetch(request)
    if (cache && response.ok) {
      cache.put(request, response.clone()).catch(() => {})
    }
    return response
  } catch {
    // network failed — retry once without cache interaction
  }

  try {
    return await fetch(request)
  } catch {
    return new Response("Zasób niedostępny offline.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  }
}
