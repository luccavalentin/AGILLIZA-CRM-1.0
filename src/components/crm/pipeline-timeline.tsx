import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StageItem {
  codigo: string;
  nome: string;
  ordem: number;
}

/**
 * Esteira visual em formato de stepper conectado: barra de progresso animada,
 * nós com estados (concluída, atual, próxima, futura) e trilho rolável.
 * Quando `onSelecionar` é informado, cada nó vira um botão que move o cliente.
 */
export function PipelineTimeline({
  stages,
  atualOrdem,
  onSelecionar,
  disabled,
}: {
  stages: StageItem[];
  atualOrdem: number;
  onSelecionar?: (codigo: string) => void;
  disabled?: boolean;
}) {
  const ordenadas = [...stages].sort((a, b) => a.ordem - b.ordem);
  const total = ordenadas.length;
  const atualIdx = ordenadas.findIndex((s) => s.ordem === atualOrdem);
  const posicao = atualIdx >= 0 ? atualIdx + 1 : 0;
  const percent = total > 1 ? Math.round((Math.max(0, posicao - 1) / (total - 1)) * 100) : 0;
  const nomeAtual = atualIdx >= 0 ? ordenadas[atualIdx].nome : "—";

  // Etapa atual não corresponde a nenhuma etapa cadastrada (esteira reconfigurada).
  if (total > 0 && atualIdx < 0) {
    return (
      <p className="text-sm text-destructive">
        A etapa atual do cliente não existe mais na esteira. Reconfigure a esteira ou mova o cliente
        para uma etapa válida.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho com etapa atual e progresso */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Etapa atual
          </p>
          <p className="truncate text-base font-semibold text-foreground">{nomeAtual}</p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold tabular-nums text-primary">{percent}%</span>
          <p className="text-[11px] text-muted-foreground">
            {posicao > 0 ? `${posicao} de ${total} etapas` : `${total} etapas`}
          </p>
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-success via-primary to-primary shadow-[0_0_12px_-2px_var(--primary)] transition-[width] duration-700 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Trilho de nós */}
      <div className="flex overflow-x-auto pb-1 [scrollbar-width:thin]">
        {ordenadas.map((s, i) => {
          const concluida = s.ordem < atualOrdem;
          const atual = s.ordem === atualOrdem;
          const alcancada = s.ordem <= atualOrdem;
          // Etapas futuras permanecem clicáveis para permitir avançar o fluxo manualmente.
          const futura = s.ordem > atualOrdem;

          const node = (
            <span
              className={cn(
                "relative z-10 flex shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all duration-300",
                atual ? "size-11" : "size-9",
                concluida && "border-success bg-success text-success-foreground",
                atual &&
                  "border-primary bg-primary text-primary-foreground ring-[6px] ring-primary/25 shadow-[0_0_24px_-4px_var(--primary)] animate-pulse",
                futura && "border-border bg-background text-muted-foreground",
                onSelecionar &&
                  !atual &&
                  "group-hover:border-primary group-hover:text-primary group-hover:ring-4 group-hover:ring-primary/10",
              )}
            >
              {concluida ? (
                <Check className="size-4" aria-hidden />
              ) : atual ? (
                <span className="size-2.5 rounded-full bg-primary-foreground" aria-hidden />
              ) : (
                i + 1
              )}
            </span>
          );

          // Selo "VOCÊ ESTÁ AQUI" com ponteiro apontando para o nó.
          const marcadorAtual = atual ? (
            <span
              className="absolute -top-6 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap"
              aria-hidden
            >
              <span className="relative inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-foreground shadow-md">
                <span className="size-1 rounded-full bg-primary-foreground animate-pulse" />
                Você está aqui
                <span
                  className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-primary"
                  aria-hidden
                />
              </span>
            </span>
          ) : null;

          const label = (
            <span
              className={cn(
                "mt-2 w-full text-balance break-words text-center text-[11px] leading-tight transition-colors",
                atual ? "font-bold text-primary" : "text-muted-foreground",
              )}
            >
              {s.nome}
            </span>
          );

          const conector =
            i > 0 ? (
              <span
                className={cn(
                  "pointer-events-none absolute right-1/2 top-[42px] h-0.5 w-full -translate-y-1/2 transition-colors duration-500",
                  alcancada ? "bg-gradient-to-r from-success to-primary" : "bg-border",
                )}
                aria-hidden
              />
            ) : null;

          const inner = (
            <>
              {conector}
              {marcadorAtual}
              {node}
              {label}
            </>
          );

          const wrapperClasses =
            "group relative flex min-w-[104px] flex-1 flex-col items-center px-1.5 pt-6";

          if (onSelecionar) {
            return (
              <button
                key={s.codigo}
                type="button"
                disabled={disabled || atual}
                onClick={() => onSelecionar(s.codigo)}
                className={cn(
                  wrapperClasses,
                  "cursor-pointer disabled:cursor-not-allowed disabled:opacity-100",
                )}
                title={
                  atual
                    ? "Etapa atual"
                    : futura
                      ? `Avançar para "${s.nome}"`
                      : `Voltar para "${s.nome}"`
                }
              >
                {inner}
              </button>
            );
          }

          return (
            <div key={s.codigo} className={wrapperClasses}>
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
