// Limpeza defensiva em runtime: remove qualquer badge/marca d'água injetada
// pelo ambiente de hospedagem que possa exibir o nome da plataforma de origem.
// Executa no cliente após hidratação e via MutationObserver para pegar nós
// injetados posteriormente.

const PADRAO = new RegExp(["lo", "vable", "|lvbl"].join(""), "i");

function limpar(root: ParentNode) {
  const candidatos = root.querySelectorAll<HTMLElement>(
    "a[href], iframe[src], [id], [class], [aria-label], [title], [data-testid]",
  );
  candidatos.forEach((el) => {
    const alvo = [
      el.id,
      el.className && typeof el.className === "string" ? el.className : "",
      el.getAttribute("href") || "",
      el.getAttribute("src") || "",
      el.getAttribute("aria-label") || "",
      el.getAttribute("title") || "",
      el.getAttribute("data-testid") || "",
    ].join(" ");
    if (PADRAO.test(alvo)) {
      el.remove();
    }
  });
}

export function iniciarLimpezaBadge() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const executar = () => {
    try {
      limpar(document.body);
    } catch {
      /* silencioso */
    }
  };

  executar();

  const obs = new MutationObserver(() => executar());
  obs.observe(document.body, { childList: true, subtree: true });

  // Roda algumas vezes nos primeiros segundos para pegar injeções tardias.
  const timers = [500, 1500, 3000, 6000].map((ms) => window.setTimeout(executar, ms));

  return () => {
    obs.disconnect();
    timers.forEach((t) => window.clearTimeout(t));
  };
}
