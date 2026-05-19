const STATIC_CACHE = "inspekcja-static-v1"
const DYNAMIC_CACHE = "inspekcja-dynamic-v1"

const PRECACHE_ASSETS = [
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
]

self.addEventListener("install", (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_ASSETS))
  )
})

self.addEventListener("activate", (event) => {
  const validCaches = [STATIC_CACHE, DYNAMIC_CACHE]
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(
          keys.filter((k) => !validCaches.includes(k)).map((k) => caches.delete(k))
        )
      ),
    ])
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle GET requests to same origin
  if (request.method !== "GET") return
  if (url.origin !== location.origin) return

  // Auth routes — always fetch from network, never cache
  if (url.pathname.startsWith("/auth")) return

  // _next/static and icons — CacheFirst (immutable assets)
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // Everything else (pages, data) — NetworkFirst with cache fallback
  event.respondWith(networkFirst(request, DYNAMIC_CACHE))
})

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch {
    return new Response("Zasób niedostępny offline.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cache = await caches.open(cacheName)
    const cached = await cache.match(request)
    if (cached) return cached
    return new Response("Brak połączenia. Strona niedostępna offline.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  }
}
