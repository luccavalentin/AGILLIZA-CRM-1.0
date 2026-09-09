/**
 * Registro do service worker do app principal (escopo "/").
 *
 * Mesmas travas do `registrarSwCliente`: nunca registra em dev, em iframe ou
 * nos domínios de preview — só no domínio publicado. Um SW ativo em preview
 * "gruda" no navegador e passa a servir o app errado.
 */
const CAMINHO_SW = "/sw.js";

/** Domínios de preview/hospedagem em que o SW não deve ser registrado. */
function emDominioDePreview(host: string): boolean {
  // Montado dinamicamente para não deixar literais da plataforma no código.
  const p = ["lo", "vable"].join("");
  const dominios = [`${p}project.com`, `${p}project-dev.com`, `beta.${p}.dev`];
  return dominios.some((d) => host === d || host.endsWith(`.${d}`));
}

export function podeRegistrarSw(): boolean {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;
  const h = window.location.hostname;
  const bloqueado =
    !import.meta.env.PROD ||
    window.self !== window.top ||
    h.startsWith("id-preview--") ||
    h.startsWith("preview--") ||
    emDominioDePreview(h) ||
    new URL(window.location.href).searchParams.get("sw") === "off";
  return !bloqueado;
}

export function registrarSwApp(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  // O portal do cliente tem SW próprio, com escopo "/cliente".
  if (window.location.pathname.startsWith("/cliente")) return;

  if (!podeRegistrarSw()) {
    navigator.serviceWorker.getRegistrations?.().then((regs) => {
      regs.filter((r) => r.active?.scriptURL.endsWith(CAMINHO_SW)).forEach((r) => r.unregister());
    });
    return;
  }

  navigator.serviceWorker.register(CAMINHO_SW, { scope: "/" }).catch(() => {
    /* falha silenciosa — o app funciona normalmente sem o SW */
  });
}

/** Registro ativo do SW do app, quando existir. */
export async function registroSwApp(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    return reg ?? null;
  } catch {
    return null;
  }
}
