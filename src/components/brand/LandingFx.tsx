import { useEffect, useRef } from "react";

/**
 * Fundo interativo sofisticado para a tela de acesso.
 * Renderiza, em canvas, orbes de luz que derivam em um campo de fluxo
 * (sensação de líquido em movimento) e reagem suavemente ao mouse, além
 * de ondas concêntricas que se expandem conforme o ponteiro se move.
 * Sem dependências externas; respeita prefers-reduced-motion.
 */

interface Orb {
  x: number;
  y: number;
  r: number;
  hue: number;
  sat: number;
  phase: number;
  speed: number;
}

interface Ripple {
  x: number;
  y: number;
  t: number; // 0..1
}

export function LandingFx({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = 0;
    let h = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Paleta: azuis profundos + um toque de vermelho da marca.
    const palette = [
      { hue: 216, sat: 70 },
      { hue: 226, sat: 80 },
      { hue: 232, sat: 85 },
      { hue: 205, sat: 80 },
    ];

    let orbs: Orb[] = [];
    const ripples: Ripple[] = [];

    // Mouse suavizado (inércia de líquido).
    let mx = 0.5;
    let my = 0.45;
    let smx = 0.5;
    let smy = 0.45;

    // Intensidade do efeito: 0 em repouso, sobe apenas quando o mouse está sobre
    // a área (para não ofuscar as informações). Interpolada suavemente.
    let intensity = 0;
    let targetIntensity = 0;

    const buildOrbs = () => {
      const count = w < 640 ? 4 : 6;
      orbs = Array.from({ length: count }, (_, i) => {
        const p = palette[i % palette.length];
        return {
          x: Math.random(),
          y: Math.random(),
          r: (w < 640 ? 0.5 : 0.42) + Math.random() * 0.25,
          hue: p.hue,
          sat: p.sat,
          phase: Math.random() * Math.PI * 2,
          speed: 0.15 + Math.random() * 0.25,
        };
      });
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildOrbs();
    };

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mx = (e.clientX - rect.left) / rect.width;
      my = (e.clientY - rect.top) / rect.height;
      // Cria ondas esparsas para não sobrecarregar.
      if (!reduce && Math.random() < 0.3) {
        ripples.push({ x: mx, y: my, t: 0 });
        if (ripples.length > 14) ripples.shift();
      }
    };

    let start = performance.now();
    let raf = 0;

    const frame = (now: number) => {
      const time = (now - start) / 1000;
      smx += (mx - smx) * 0.05;
      smy += (my - smy) * 0.05;

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      const minDim = Math.min(w, h);

      for (const o of orbs) {
        // Campo de fluxo: soma de senos para deriva orgânica (movimento amplo).
        const t = reduce ? 0 : time * o.speed;
        const fx =
          o.x + Math.sin(t + o.phase) * 0.14 + Math.cos(t * 0.6 + o.phase * 1.3) * 0.09;
        const fy =
          o.y + Math.cos(t * 0.9 + o.phase) * 0.14 + Math.sin(t * 0.5 + o.phase * 0.7) * 0.09;

        // Atração perceptível em direção ao mouse.
        const px = (fx + (smx - fx) * 0.22) * w;
        const py = (fy + (smy - fy) * 0.22) * h;
        const radius = o.r * minDim;

        const g = ctx.createRadialGradient(px, py, 0, px, py, radius);
        g.addColorStop(0, `hsla(${o.hue}, ${o.sat}%, 60%, 0.42)`);
        g.addColorStop(0.4, `hsla(${o.hue}, ${o.sat}%, 48%, 0.20)`);
        g.addColorStop(1, `hsla(${o.hue}, ${o.sat}%, 42%, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
      }


      // Ondas concêntricas onde o mouse passou.
      ctx.globalCompositeOperation = "screen";
      for (const rp of ripples) {
        rp.t += 0.01;
        const alpha = (1 - rp.t) * 0.4;
        if (alpha <= 0) continue;
        const rad = rp.t * minDim * 0.6;
        ctx.beginPath();
        ctx.arc(rp.x * w, rp.y * h, rad, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(205, 95%, 75%, ${alpha})`;
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
      for (let i = ripples.length - 1; i >= 0; i--) {
        if (ripples[i].t >= 1) ripples.splice(i, 1);
      }

      ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(frame);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    start = performance.now();
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return <canvas ref={canvasRef} className={`landing-fx ${className ?? ""}`} aria-hidden="true" />;
}
