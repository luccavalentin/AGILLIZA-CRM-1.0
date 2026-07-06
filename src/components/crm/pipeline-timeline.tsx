import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StageItem {
  codigo: string;
  nome: string;
  ordem: number;
}

/**
 * Timeline visual das etapas: concluída (verde), atual (destaque), próxima (accent), futura (cinza).
 * Quando `onSelecionar` é informado, cada etapa vira um botão clicável que move o cliente.
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
  return (
    <div className="flex flex-wrap gap-2">
      {stages.map((s) => {
        const concluida = s.ordem < atualOrdem;
        const atual = s.ordem === atualOrdem;
        const proxima = s.ordem === atualOrdem + 1;
        const classes = cn(
          "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
          concluida && "bg-success/10 text-success border border-success/20",
          atual && "bg-primary text-primary-foreground",
          proxima && "bg-accent text-accent-foreground",
          !concluida &&
            !atual &&
            !proxima &&
            "bg-muted text-muted-foreground border border-border",
          onSelecionar && !atual && "cursor-pointer hover:ring-2 hover:ring-primary/40",
          onSelecionar && "disabled:cursor-not-allowed disabled:opacity-60",
        );
        const conteudo = (
          <>
            {concluida && <Check className="size-3" aria-hidden />}
            {atual && (
              <span
                className="size-1.5 rounded-full bg-primary-foreground animate-pulse"
                aria-hidden
              />
            )}
            {s.nome}
          </>
        );

        if (onSelecionar) {
          return (
            <button
              key={s.codigo}
              type="button"
              disabled={disabled || atual}
              onClick={() => onSelecionar(s.codigo)}
              className={classes}
              title={atual ? "Etapa atual" : `Mover para "${s.nome}"`}
            >
              {conteudo}
            </button>
          );
        }

        return (
          <span key={s.codigo} className={classes}>
            {conteudo}
          </span>
        );
      })}
    </div>
  );
}
