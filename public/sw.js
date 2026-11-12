// Service Worker para RPG Life-Engine PWA (v4.0 - Safari iOS & Resiliencia de Despliegue)
// Soporta sincronización offline, Network-First para documentos HTML (evita ChunkLoadError tras despliegues)
// y limpieza automática de versiones antiguas de caché.

const CACHE_NAME = "rpg-life-engine-v4.0";
const PRECACHE_URLS = [
  "/",
  "/cozy",
  "/dashboard",
  "/quick",
  "/login",
  "/manifest.json",
  "/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => {
              console.log("[SW] Eliminando caché antigua:", k);
              return caches.delete(k);
            })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data && event.data.type === "CLEAR_ALL_CACHES") {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
    );
  }
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // 1. Para llamadas a API: Network-First con respuesta offline informativa
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request).catch(async () => {
        if (event.request.method === "GET") {
          const cached = await caches.match(event.request);
          if (cached) return cached;
        }
        return new Response(
          JSON.stringify({
            offline: true,
            message: "Estás sin conexión a internet. Los cambios se sincronizarán al recuperar la señal.",
          }),
          {
            status: 503,
            statusText: "Service Unavailable (Offline)",
            headers: { "Content-Type": "application/json" },
          }
        );
      })
    );
    return;
  }

  // 2. Para navegación de páginas HTML: Network-First con fallback a caché
  // Esto previene que Safari iOS sirva HTML antiguo con hashes de chunks Next.js eliminados
  const isNavigationRequest =
    event.request.mode === "navigate" ||
    (event.request.method === "GET" &&
      event.request.headers.get("accept") &&
      event.request.headers.get("accept").includes("text/html"));

  if (isNavigationRequest) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          const fallback = await caches.match("/");
          return fallback || new Response("Desconectado de Oakhaven", { status: 503 });
        })
    );
    return;
  }

  // 3. Para scripts, estilos y assets estáticos: Stale-While-Revalidate seguro
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            (networkResponse.type === "basic" || networkResponse.type === "cors")
          ) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
