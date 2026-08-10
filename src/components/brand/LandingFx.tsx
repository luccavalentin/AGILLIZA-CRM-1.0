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
          r: (w < 640 ? 0.22 : 0.18) + Math.random() * 0.1,
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
      // Só ativa o efeito quando o ponteiro está sobre a área do canvas.
      const dentro =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      targetIntensity = dentro ? 1 : 0;
      // Cria ondas esparsas para não sobrecarregar.
      if (dentro && !reduce && Math.random() < 0.3) {
        ripples.push({ x: mx, y: my, t: 0 });
        if (ripples.length > 14) ripples.shift();
      }
    };
    const onLeave = () => {
      targetIntensity = 0;
    };

    let start = performance.now();
    let raf = 0;

    const frame = (now: number) => {
      const time = (now - start) / 1000;
      // Rastreamento firme: o brilho acompanha o ponteiro quase coladinho,
      // com só um leve amortecimento para não ficar "duro".
      smx += (mx - smx) * 0.35;
      smy += (my - smy) * 0.35;
      intensity += (targetIntensity - intensity) * 0.06;

      ctx.clearRect(0, 0, w, h);

      // Em repouso o canvas fica limpo (sem luz) para não ofuscar o conteúdo.
      if (intensity < 0.01) {
        raf = requestAnimationFrame(frame);
        return;
      }

      ctx.globalCompositeOperation = "lighter";

      const minDim = Math.min(w, h);
      if (!Number.isFinite(minDim) || minDim <= 0) {
        raf = requestAnimationFrame(frame);
        return;
      }


      for (const o of orbs) {
        // Campo de fluxo: soma de senos para deriva orgânica (movimento amplo).
        const t = reduce ? 0 : time * o.speed;

        const fx =
          o.x + Math.sin(t + o.phase) * 0.14 + Math.cos(t * 0.6 + o.phase * 1.3) * 0.09;
        const fy =
          o.y + Math.cos(t * 0.9 + o.phase) * 0.14 + Math.sin(t * 0.5 + o.phase * 0.7) * 0.09;

        // Forte atração ao ponteiro: os orbes se concentram onde o mouse está.
        const px = (fx + (smx - fx) * 0.55) * w;
        const py = (fy + (smy - fy) * 0.55) * h;
        const radius = o.r * minDim;

        const g = ctx.createRadialGradient(px, py, 0, px, py, radius);
        g.addColorStop(0, `hsla(${o.hue}, ${o.sat}%, 60%, ${0.2 * intensity})`);
        g.addColorStop(0.4, `hsla(${o.hue}, ${o.sat}%, 48%, ${0.09 * intensity})`);
        g.addColorStop(1, `hsla(${o.hue}, ${o.sat}%, 42%, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Núcleo de luz exatamente sob o ponteiro, para o foco cair onde
      // a seta do mouse está (e não atrás dela).
      {
        const cx = smx * w;
        const cy = smy * h;
        const coreR = minDim * 0.12;
        const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
        core.addColorStop(0, `hsla(205, 90%, 68%, ${0.28 * intensity})`);
        core.addColorStop(0.5, `hsla(216, 80%, 56%, ${0.12 * intensity})`);
        core.addColorStop(1, `hsla(216, 80%, 50%, 0)`);
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
        ctx.fill();
      }



      // Ondas concêntricas onde o mouse passou.
      ctx.globalCompositeOperation = "screen";
      for (const rp of ripples) {
        rp.t += 0.01;
        const alpha = (1 - rp.t) * 0.18 * intensity;
        if (alpha <= 0) continue;
        const rad = rp.t * minDim * 0.3;
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
    window.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    start = performance.now();
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className={`landing-fx ${className ?? ""}`} aria-hidden="true" />;
}
