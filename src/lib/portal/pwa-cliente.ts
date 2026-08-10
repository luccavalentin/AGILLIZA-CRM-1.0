// Registro guardado do service worker do App do Cliente.
// NUNCA registra em preview/iframe/dev — apenas no domínio publicado (produção).
export function registrarSwCliente() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const h = window.location.hostname;
  const emIframe = window.self !== window.top;
  // Domínios de preview/hospedagem em que o SW não deve ser registrado.
  // Montados dinamicamente para não deixar literais da plataforma no código.
  const p = ["lo", "vable"].join("");
  const dominiosPreview = [`${p}project.com`, `${p}project-dev.com`, `beta.${p}.dev`];
  const emPreview = dominiosPreview.some((d) => h === d || h.endsWith(`.${d}`));
  const bloqueado =
    !import.meta.env.PROD ||
    emIframe ||
    h.startsWith("id-preview--") ||
    h.startsWith("preview--") ||
    emPreview ||
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
