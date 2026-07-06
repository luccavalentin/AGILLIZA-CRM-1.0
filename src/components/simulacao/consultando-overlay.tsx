/** Overlay exibido enquanto a simulação consulta os bancos. */
export function ConsultandoOverlay({
  aberto,
  total,
  concluidos,
}: {
  aberto: boolean;
  total: number;
  concluidos: number;
}) {
  if (!aberto) return null;

  const temProgresso = total > 0;
  const pct = temProgresso ? Math.min(100, Math.round((concluidos / total) * 100)) : 0;

  // Anel de progresso (SVG)
  const raio = 52;
  const circunferencia = 2 * Math.PI * raio;
  const offset = circunferencia * (1 - (temProgresso ? pct : 0) / 100);

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
                className="stroke-primary transition-[stroke-dashoffset] duration-700 ease-out"
                strokeDasharray={circunferencia}
                strokeDashoffset={temProgresso ? offset : circunferencia * 0.75}
                style={
                  temProgresso
                    ? undefined
                    : { animation: "spin 1.1s linear infinite", transformOrigin: "center" }
                }
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
              {temProgresso && (
                <span className="mt-1 text-lg font-bold tabular-nums text-card-foreground">
                  {pct}%
                </span>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-base font-semibold tracking-tight text-card-foreground">
              Preparando suas simulações
            </p>
            <p className="text-sm text-muted-foreground">
              {temProgresso
                ? `${concluidos} de ${total} bancos processados`
                : "Consultando os bancos parceiros…"}
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
                      feito
                        ? "bg-primary"
                        : ativo
                          ? "animate-pulse bg-primary/50"
                          : "bg-muted",
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
