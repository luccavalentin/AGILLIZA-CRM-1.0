import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ETAPAS_STEPPER, indiceEtapa } from "./pipeline-map";

/**
 * Stepper horizontal do ciclo da oportunidade (13 etapas).
 * Etapas `auto` avançam pela integração bancária; as demais são concluídas
 * manualmente. Rótulos neutros — nenhum provedor citado.
 * O trilho rola horizontalmente dentro do card em telas estreitas.
 */
export function PipelineStepper({
  status,
  detalheStatus,
}: {
  status: string;
  detalheStatus?: string | null;
}) {
  if (status === "cancelada") {
    return (
      <div className="w-full rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-center">
        <p className="text-sm font-medium text-destructive">
          Proposta cancelada — fluxo interrompido
        </p>
        {detalheStatus && (
          <p className="mt-1 text-xs text-muted-foreground">Detalhe Status: {detalheStatus}</p>
        )}
      </div>
    );
  }
  const atual = indiceEtapa(status);

  return (
    <div className="w-full">
      <div className="w-full overflow-x-auto pb-2">
        <ol className="flex min-w-max items-start">
          {ETAPAS_STEPPER.map((etapa, i) => {
            const concluida = i < atual;
            const isAtual = i === atual;
            const first = i === 0;
            return (
              <li key={etapa.codigo} className={cn("flex items-start", !first && "flex-1")}>
                {!first && (
                  <div
                    className={cn(
                      "mt-4 h-0.5 min-w-6 flex-1 sm:min-w-8",
                      i <= atual ? "bg-primary" : "bg-border",
                    )}
                    aria-hidden
                  />
                )}
                <div className="flex w-20 flex-col items-center gap-1.5 px-1 sm:w-24">
                  <span
                    className={cn(
                      "relative flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                      concluida && "bg-primary text-primary-foreground",
                      isAtual && "bg-primary/10 text-primary ring-2 ring-primary",
                      !concluida && !isAtual && "bg-muted text-muted-foreground",
                    )}
                  >
                    {concluida ? <Check className="h-4 w-4" /> : etapa.numero}
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
      </div>
      {detalheStatus && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Detalhe Status: {detalheStatus}
        </p>
      )}
    </div>
  );
}
