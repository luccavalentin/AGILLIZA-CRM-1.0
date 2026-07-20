// Registro guardado do service worker do App do Cliente.
// NUNCA registra em preview/iframe/dev — apenas no domínio publicado (produção).
export function registrarSwCliente() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const h = window.location.hostname;
  const emIframe = window.self !== window.top;
  const bloqueado =
    !import.meta.env.PROD ||
    emIframe ||
    h.startsWith("id-preview--") ||
    h.startsWith("preview--") ||
    h === "lovableproject.com" ||
    h.endsWith(".lovableproject.com") ||
    h === "lovableproject-dev.com" ||
    h.endsWith(".lovableproject-dev.com") ||
    h === "beta.lovable.dev" ||
    h.endsWith(".beta.lovable.dev") ||
    new URL(window.location.href).searchParams.get("sw") === "off";

  if (bloqueado) {
    navigator.serviceWorker.getRegistrations?.().then((regs) => {
      regs
        .filter((r) => r.active?.scriptURL.endsWith("/sw-cliente.js"))
        .forEach((r) => r.unregister());
    });
    return;
  }

  navigator.serviceWorker.register("/sw-cliente.js", { scope: "/cliente" }).catch(() => {
    /* falha silenciosa — app funciona online normalmente */
  });
}
