import { Check, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { ETAPAS_STEPPER, indiceEtapa } from "./pipeline-map";

/**
 * Stepper horizontal do ciclo da oportunidade (13 etapas).
 * Etapas `auto` avançam pela integração bancária; as demais são concluídas
 * manualmente. Rótulos neutros — nenhum provedor citado.
 */
export function PipelineStepper({
  status,
  detalheStatus,
}: {
  status: string;
  detalheStatus?: string | null;
}) {
  const atual = indiceEtapa(status);

  return (
    <div className="w-full">
      <ol className="flex min-w-max items-start overflow-x-auto pb-2">
        {ETAPAS_STEPPER.map((etapa, i) => {
          const concluida = i < atual;
          const isAtual = i === atual;
          const first = i === 0;
          return (
            <li key={etapa.codigo} className={cn("flex items-start", !first && "flex-1")}>
              {!first && (
                <div
                  className={cn("mt-4 h-0.5 min-w-8 flex-1", i <= atual ? "bg-primary" : "bg-border")}
                  aria-hidden
                />
              )}
              <div className="flex w-24 flex-col items-center gap-1.5 px-1">
                <span
                  className={cn(
                    "relative flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                    concluida && "bg-primary text-primary-foreground",
                    isAtual && "bg-primary/10 text-primary ring-2 ring-primary",
                    !concluida && !isAtual && "bg-muted text-muted-foreground",
                  )}
                >
                  {concluida ? <Check className="h-4 w-4" /> : etapa.numero}
                  {etapa.auto && (
                    <Zap
                      className="absolute -right-1 -top-1 h-3 w-3 text-amber-500"
                      aria-label="Etapa automática (integração bancária)"
                    />
                  )}
                </span>
                <span
                  className={cn(
                    "text-center text-[11px] font-medium leading-tight",
                    isAtual ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {etapa.label}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
      {detalheStatus && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Detalhe Status: {detalheStatus}
        </p>
      )}
    </div>
  );
}

