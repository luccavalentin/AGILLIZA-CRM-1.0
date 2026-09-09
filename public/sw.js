/**
 * Service worker do app do correspondente/parceiro (escopo "/").
 *
 * Faz o mínimo necessário para que o PWA se comporte como app nativo:
 *  - exibir notificações do sistema (popup do Android/iOS/Windows);
 *  - abrir a tela certa quando o usuário toca na notificação;
 *  - receber Web Push, quando o servidor de push estiver configurado.
 *
 * NÃO faz cache de HTML/JS de propósito: um shell em cache serviria a versão
 * antiga do app depois de cada deploy, que é exatamente o problema que a
 * recarga automática de chunk em `__root.tsx` já tenta contornar.
 */
const CACHE_ICONES = "agz-app-icones-v1";
const ICONE = "/icons/app/icon-192.png";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const chaves = await caches.keys();
      await Promise.all(
        chaves
          .filter((k) => k.startsWith("agz-app-") && k !== CACHE_ICONES)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

// Só os ícones passam pelo cache. O handler existe também porque o Chrome
// exige um listener de `fetch` para considerar o app instalável.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith("/icons/")) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_ICONES);
      const cached = await cache.match(req);
      if (cached) return cached;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    })(),
  );
});

/**
 * Web Push. Fica pronto para quando existir servidor de push (VAPID);
 * enquanto não existir, este handler simplesmente nunca é chamado.
 */
self.addEventListener("push", (event) => {
  let dados = {};
  try {
    dados = event.data ? event.data.json() : {};
  } catch {
    dados = { titulo: "Agilliza", corpo: event.data ? event.data.text() : "" };
  }
  const titulo = dados.titulo || dados.title || "Agilliza";
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: dados.corpo || dados.body || "",
      icon: ICONE,
      badge: ICONE,
      tag: dados.tag || undefined,
      renotify: Boolean(dados.tag),
      data: { link: dados.link || "/" },
      vibrate: [80, 40, 80],
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = (event.notification.data && event.notification.data.link) || "/";
  event.waitUntil(
    (async () => {
      const janelas = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Reaproveita uma janela já aberta do app (comportamento de app nativo).
      for (const janela of janelas) {
        if (new URL(janela.url).origin !== self.location.origin) continue;
        await janela.focus();
        if ("navigate" in janela) {
          try {
            await janela.navigate(destino);
          } catch {
            janela.postMessage({ tipo: "agilliza:navegar", destino });
          }
        } else {
          janela.postMessage({ tipo: "agilliza:navegar", destino });
        }
        return;
      }
      await self.clients.openWindow(destino);
    })(),
  );
});
