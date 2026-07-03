import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StageItem {
  codigo: string;
  nome: string;
  ordem: number;
}

/** Timeline visual das etapas: concluída (verde), atual (destaque), próxima (accent), futura (cinza). */
export function PipelineTimeline({
  stages,
  atualOrdem,
}: {
  stages: StageItem[];
  atualOrdem: number;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {stages.map((s) => {
        const concluida = s.ordem < atualOrdem;
        const atual = s.ordem === atualOrdem;
        const proxima = s.ordem === atualOrdem + 1;
        return (
          <span
            key={s.codigo}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium",
              concluida && "bg-success/10 text-success border border-success/20",
              atual && "bg-primary text-primary-foreground",
              proxima && "bg-accent text-accent-foreground",
              !concluida && !atual && !proxima && "bg-muted text-muted-foreground border border-border",
            )}
          >
            {concluida && <Check className="size-3" aria-hidden />}
            {atual && <span className="size-1.5 rounded-full bg-primary-foreground animate-pulse" aria-hidden />}
            {s.nome}
          </span>
        );
      })}
    </div>
  );
}
