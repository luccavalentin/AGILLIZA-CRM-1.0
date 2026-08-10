import { Check, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import { ETAPAS_STEPPER, indiceEtapa } from "./pipeline-map";

/**
 * Stepper horizontal do ciclo da oportunidade (12 etapas).
 * Etapas `auto` avançam pela integração bancária; as demais são concluídas
 * manualmente. Rótulos neutros — nenhum provedor citado.
 * O trilho rola horizontalmente dentro do card em telas estreitas, com
 * padding vertical para nunca cortar o anel da etapa atual.
 */
export function PipelineStepper({
  status,
  detalheStatus,
}: {
  status: string;
  detalheStatus?: string | null;
}) {
  const recusado = status === "credito_recusado";

  if (status === "cancelada") {
    return (
      <div className="flex w-full items-center gap-3 rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive">
          <Ban className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-destructive">
            Proposta cancelada — fluxo interrompido
          </p>
          {detalheStatus && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              Detalhe: {detalheStatus}
            </p>
          )}
        </div>
      </div>
    );
  }

  const atual = indiceEtapa(status);
  const total = ETAPAS_STEPPER.length;
  // Ajuste para 7 etapas conforme solicitado no anexo
  const progresso = Math.round(((atual + 1) / 7) * 100);
  const etapaAtual = ETAPAS_STEPPER[atual];

  return (
    <div className="w-full">
      {/* Cabeçalho do progresso */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Etapa {atual + 1} de 7
          </span>
          {etapaAtual && (
            <span
              className={cn(
                "truncate text-sm font-semibold",
                recusado ? "text-destructive" : "text-foreground",
              )}
            >
              · {etapaAtual.label}
            </span>
          )}
        </div>
        <span className="text-xs font-semibold tabular-nums text-muted-foreground">
          {progresso}% concluído
        </span>
      </div>

      {/* Barra de progresso fina */}
      <div className="mb-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            recusado
              ? "bg-gradient-to-r from-destructive/70 to-destructive"
              : "bg-gradient-to-r from-primary/70 to-primary",
          )}
          style={{ width: `${progresso}%` }}
        />
      </div>

      {/* Trilho de etapas — padding vertical evita corte do anel */}
      <div className="w-full px-1 pb-2 pt-3">
        <ol className="flex w-full items-start justify-between">
          {ETAPAS_STEPPER.map((etapa, i) => {
            const concluida = i < atual;
            const isAtual = i === atual;
            const first = i === 0;
            const recusadaAtual = isAtual && recusado;
            return (
              <li key={etapa.codigo} className={cn("flex items-start", !first && "flex-1")}>
                {!first && (
                  <div className="mt-[15px] h-0.5 min-w-6 flex-1 overflow-hidden rounded-full bg-border sm:min-w-10">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        i <= atual
                          ? recusado && i >= atual
                            ? "bg-destructive"
                            : "bg-primary"
                          : "bg-transparent",
                      )}
                      style={{ width: i <= atual ? "100%" : "0%" }}
                    />
                  </div>
                )}
                <div className="flex w-16 flex-col items-center gap-2 px-1 sm:w-28">
                  <span
                    className={cn(
                      "relative grid size-8 place-items-center rounded-full text-xs font-bold transition-all",
                      concluida &&
                        "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20",
                      isAtual &&
                        !recusadaAtual &&
                        "bg-primary/10 text-primary ring-2 ring-primary shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_10%,transparent)]",
                      recusadaAtual &&
                        "bg-destructive/10 text-destructive ring-2 ring-destructive shadow-[0_0_0_4px_color-mix(in_oklab,var(--destructive)_12%,transparent)]",
                      !concluida && !isAtual && "bg-muted text-muted-foreground ring-1 ring-border",
                    )}
                  >
                    {concluida ? <Check className="h-4 w-4" /> : etapa.numero}
                  </span>
                  <span
                    className={cn(
                      "line-clamp-2 text-center text-[11px] font-medium leading-tight",
                      recusadaAtual
                        ? "text-destructive"
                        : isAtual
                          ? "font-semibold text-primary"
                          : concluida
                            ? "text-foreground/70"
                            : "text-muted-foreground",
                    )}
                  >
                    {etapa.label}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {detalheStatus && (
        <p className="mt-1 text-center text-xs text-muted-foreground">
          Detalhe Status: <span className="font-medium text-foreground/80">{detalheStatus}</span>
        </p>
      )}
    </div>
  );
}
