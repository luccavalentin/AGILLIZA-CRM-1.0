import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ETAPAS_STEPPER, indiceEtapa } from "./pipeline-map";

/**
 * Stepper horizontal do ciclo da proposta (6 etapas fixas).
 * Segue o modelo do banco. Rótulos neutros — nenhum provedor citado.
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
      <ol className="flex items-center">
        {ETAPAS_STEPPER.map((etapa, i) => {
          const concluida = i < atual;
          const isAtual = i === atual;
          const first = i === 0;
          return (
            <li key={etapa.codigo} className={cn("flex items-center", !first && "flex-1")}>
              {!first && (
                <div
                  className={cn("h-0.5 flex-1", i <= atual ? "bg-primary" : "bg-border")}
                  aria-hidden
                />
              )}
              <div className="flex flex-col items-center gap-1.5 px-1">
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                    concluida && "bg-primary text-primary-foreground",
                    isAtual && "bg-primary/10 text-primary ring-2 ring-primary",
                    !concluida && !isAtual && "bg-muted text-muted-foreground",
                  )}
                >
                  {concluida ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <span
                  className={cn(
                    "whitespace-nowrap text-[11px] font-medium",
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
        <p className="mt-2 text-center text-xs text-muted-foreground">Detalhe Status: {detalheStatus}</p>
      )}
    </div>
  );
}
