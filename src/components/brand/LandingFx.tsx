import { useEffect, useRef } from "react";

/**
 * Efeito de fundo interativo para a tela de seleção de acesso.
 * Blobs de luz que reagem ao movimento do mouse com um leve "flutuar",
 * criando a sensação de água/luz em movimento. Sem dependências externas.
 */
export function LandingFx() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    // Posição-alvo (mouse) e posição suavizada (render) — normalizadas 0..1.
    let tx = 0.5;
    let ty = 0.4;
    let cx = 0.5;
    let cy = 0.4;
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width;
      ty = (e.clientY - r.top) / r.height;
    };

    const tick = () => {
      // Interpolação suave para dar inércia de "líquido".
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      el.style.setProperty("--mx", `${(cx * 100).toFixed(2)}%`);
      el.style.setProperty("--my", `${(cy * 100).toFixed(2)}%`);
      // Deslocamento suave (parallax) dos blobs.
      el.style.setProperty("--dx", `${((cx - 0.5) * 40).toFixed(2)}px`);
      el.style.setProperty("--dy", `${((cy - 0.5) * 40).toFixed(2)}px`);
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={rootRef} className="landing-fx" aria-hidden="true">
      <span className="landing-fx__blob landing-fx__blob--a" />
      <span className="landing-fx__blob landing-fx__blob--b" />
      <span className="landing-fx__blob landing-fx__blob--c" />
      <span className="landing-fx__cursor" />
    </div>
  );
}
