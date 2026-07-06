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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex w-[min(90vw,380px)] flex-col items-center gap-5 rounded-2xl border border-border bg-card p-8 text-center shadow-xl">
        <img
          src="/favicon.png"
          alt="Agilliza"
          className="h-14 w-14 animate-pulse rounded-xl"
        />

        <div>
          <p className="text-base font-semibold text-card-foreground">
            Aguarde enquanto preparamos suas simulações
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {temProgresso
              ? `${concluidos} de ${total} bancos processados`
              : "Consultando os bancos parceiros…"}
          </p>
        </div>

        {/* Barra estilo "pilha recarregando" */}
        <div className="w-full">
          <div className="relative h-4 w-full overflow-hidden rounded-full border border-border bg-muted">
            <div
              className="relative h-full rounded-full bg-gradient-to-r from-primary/80 to-primary transition-[width] duration-700 ease-out"
              style={{ width: temProgresso ? `${Math.max(pct, 8)}%` : "100%" }}
            >
              {/* brilho que percorre a barra (efeito de carregamento) */}
              <div className="absolute inset-0 animate-carga bg-[linear-gradient(90deg,transparent,color-mix(in_oklab,var(--color-primary-foreground)_45%,transparent),transparent)] bg-[length:40%_100%] bg-no-repeat" />
            </div>
          </div>
          {temProgresso && (
            <p className="mt-2 text-right text-xs font-medium tabular-nums text-muted-foreground">
              {pct}%
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
