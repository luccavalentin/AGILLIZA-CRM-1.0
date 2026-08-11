import { useEffect, useRef, useState } from "react";

/** Overlay exibido enquanto a simulação/proposta consulta os bancos. */
export function ConsultandoOverlay({
  aberto,
  total,
  concluidos,
  titulo = "Preparando suas simulações",
  legenda,
}: {
  aberto: boolean;
  total: number;
  concluidos: number;
  titulo?: string;
  legenda?: string;
}) {
  const temProgresso = total > 0;

  // Sinaliza conclusão de todos os bancos.
  const finalizado = temProgresso && concluidos >= total;

  // Progresso animado exibido: sobe suavemente para dar sensação de carregamento,
  // sem "travar" em 0% enquanto um banco é processado.
  const [pctExibido, setPctExibido] = useState(0);
  const rafRef = useRef<number | null>(null);

  // Reinicia ao abrir o overlay.
  useEffect(() => {
    if (aberto) setPctExibido(0);
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;

    const tick = () => {
      setPctExibido((atual) => {
        // Teto: quando finalizado vai a 100; senão, sobe até ~90% da fatia do
        // banco atual para indicar atividade sem ultrapassar o progresso real.
        const teto = finalizado
          ? 100
          : temProgresso
            ? Math.min(99, ((concluidos + 0.9) / total) * 100)
            : 96;

        if (atual >= teto) return atual;
        // Aproxima do teto de forma suave (mais rápido no começo).
        const passo = Math.max(0.4, (teto - atual) * 0.06);
        return Math.min(teto, atual + passo);
      });
      rafRef.current = window.setTimeout(tick, 40) as unknown as number;
    };

    tick();
    return () => {
      if (rafRef.current != null) clearTimeout(rafRef.current);
    };
  }, [aberto, temProgresso, finalizado, concluidos, total]);

  if (!aberto) return null;

  const pct = Math.round(pctExibido);

  // Anel de progresso (SVG)
  const raio = 52;
  const circunferencia = 2 * Math.PI * raio;
  const offset = circunferencia * (1 - pctExibido / 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-md">
      <div className="relative w-[min(92vw,420px)] overflow-hidden rounded-3xl border border-border/60 bg-card/95 p-8 text-center shadow-2xl ring-1 ring-black/5">
        {/* brilho de fundo */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
        />

        <div className="relative flex flex-col items-center gap-6">
          {/* Anel de progresso com símbolo ao centro */}
          <div className="relative h-36 w-36">
            {/* halo pulsante */}
            <div className="absolute inset-2 animate-ping rounded-full bg-primary/10 [animation-duration:2.5s]" />

            <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r={raio}
                fill="none"
                strokeWidth="8"
                className="stroke-muted"
              />
              <circle
                cx="60"
                cy="60"
                r={raio}
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                className="stroke-primary transition-[stroke-dashoffset] duration-200 ease-out"
                strokeDasharray={circunferencia}
                strokeDashoffset={offset}
              />
            </svg>

            {/* centro */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <img
                src="/favicon.png"
                alt="Agilliza"
                className="h-10 w-10 rounded-lg"
                draggable={false}
              />
              <span className="mt-1 text-lg font-bold tabular-nums text-card-foreground">
                {pct}%
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-base font-semibold tracking-tight text-card-foreground">{titulo}</p>
            <p className="text-sm text-muted-foreground">
              {legenda ??
                (temProgresso
                  ? `${concluidos} de ${total} simulações processadas`
                  : "Consultando os bancos parceiros…")}
            </p>
          </div>

          {/* Indicadores por banco */}
          {temProgresso && (
            <div className="flex w-full items-center justify-center gap-1.5">
              {Array.from({ length: total }).map((_, i) => {
                const feito = i < concluidos;
                const ativo = i === concluidos;
                return (
                  <span
                    key={i}
                    className={[
                      "h-1.5 flex-1 rounded-full transition-colors duration-500",
                      feito ? "bg-primary" : ativo ? "animate-pulse bg-primary/50" : "bg-muted",
                    ].join(" ")}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
