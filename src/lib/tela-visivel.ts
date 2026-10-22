/**
 * Área visível da tela em variáveis CSS (`--altura-visivel`, `--topo-visivel`).
 *
 * No iPhone o teclado não encolhe a janela; no Android, com
 * `interactive-widget=resizes-content`, encolhe. O modal (components/ui/dialog)
 * usa essas variáveis para caber no que sobra acima do teclado — senão o botão
 * de salvar ficava escondido atrás dele. Também traz para a vista o campo tocado
 * dentro de um diálogo, depois que o teclado termina de subir.
 */
export function acompanharTelaVisivel(): () => void {
  const vv = window.visualViewport;
  const raiz = document.documentElement;
  let quadro = 0;
  const aplicar = () => {
    if (!vv) return;
    cancelAnimationFrame(quadro);
    quadro = requestAnimationFrame(() => {
      raiz.style.setProperty("--altura-visivel", `${Math.round(vv.height)}px`);
      raiz.style.setProperty("--topo-visivel", `${Math.round(vv.offsetTop)}px`);
    });
  };
  const aoFocar = (e: FocusEvent) => {
    const alvo = e.target as HTMLElement | null;
    if (!alvo?.matches?.("input, textarea, select, [contenteditable='true']")) return;
    if (!alvo.closest('[role="dialog"]')) return;
    window.setTimeout(() => alvo.scrollIntoView({ block: "nearest" }), 320);
  };
  aplicar();
  vv?.addEventListener("resize", aplicar);
  vv?.addEventListener("scroll", aplicar);
  document.addEventListener("focusin", aoFocar);
  return () => {
    cancelAnimationFrame(quadro);
    vv?.removeEventListener("resize", aplicar);
    vv?.removeEventListener("scroll", aplicar);
    document.removeEventListener("focusin", aoFocar);
  };
}
