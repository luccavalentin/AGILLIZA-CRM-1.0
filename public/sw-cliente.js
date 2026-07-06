// Service worker do App do Cliente (shell offline).
// NAO registra Web Push nem push subscriptions — nao ha backend de push no projeto.
const SHELL_CACHE = "agz-cliente-shell-v1";
const SHELL_ASSETS = [
  "/manifest-cliente.webmanifest",
  "/icons/cliente/icon-192.png",
  "/icons/cliente/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("agz-cliente-") && k !== SHELL_CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Network-first para dados dinamicos (server functions / api).
  const isDynamic = url.pathname.startsWith("/_serverFn") || url.pathname.startsWith("/api");
  if (isDynamic) {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  // Cache-first para o shell.
  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req)
          .then((res) => {
            if (res.ok && (req.destination === "image" || url.pathname.startsWith("/icons/"))) {
              const copy = res.clone();
              caches.open(SHELL_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => caches.match("/manifest-cliente.webmanifest")),
    ),
  );
});
