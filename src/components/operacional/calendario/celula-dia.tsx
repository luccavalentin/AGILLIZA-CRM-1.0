import { statusTarefa, PRIORIDADE, TONE_BAR } from "@/components/operacional/status";
import { cn } from "@/lib/utils";
import type { FeriadoBR } from "@/lib/feriados-br";

// Estrutura mínima consumida pela célula (evita acoplar ao tipo completo da tarefa).
export interface TarefaCelula {
  id: string;
  titulo: string;
  prioridade: string;
  status: string;
}

interface CelulaDiaProps {
  data: Date;
  chave: string;
  tarefas: TarefaCelula[];
  foraMes: boolean;
  hoje: boolean;
  feriado?: FeriadoBR;
  onSelecionar: (id: string) => void;
}

const MAX_VISIVEIS = 3;

/** Célula individual de um dia dentro da grade do calendário. */
export function CelulaDia({
  data,
  chave,
  tarefas,
  foraMes,
  hoje,
  feriado,
  onSelecionar,
}: CelulaDiaProps) {
  const feriadoOficial = feriado && !feriado.facultativo;

  return (
    <div
      className={cn(
        "relative min-h-[92px] bg-card/70 p-1.5 backdrop-blur-[1px]",
        foraMes && "bg-muted/30",
        feriadoOficial && "bg-destructive/5",
      )}
    >
      <div className="mb-1 flex items-center gap-1">
        <span
          className={cn(
            "inline-flex h-5 w-5 items-center justify-center rounded-full text-xs tabular-nums",
            hoje
              ? "bg-primary text-primary-foreground"
              : feriadoOficial
                ? "font-semibold text-destructive"
                : foraMes
                  ? "text-muted-foreground"
                  : "text-foreground",
          )}
        >
          {data.getDate()}
        </span>
      </div>

      {feriado && (
        <div
          className={cn(
            "mb-1 truncate rounded px-1 py-0.5 text-[10px] font-medium",
            feriado.facultativo
              ? "bg-muted text-muted-foreground"
              : "bg-destructive/10 text-destructive",
          )}
          title={feriado.descricao + (feriado.facultativo ? " (facultativo)" : "")}
        >
          {feriado.descricao}
        </div>
      )}

      <div className="space-y-1">
        {tarefas.slice(0, MAX_VISIVEIS).map((t) => (
          <button
            key={t.id}
            onClick={() => onSelecionar(t.id)}
            className="flex w-full items-center gap-1 overflow-hidden rounded bg-muted/60 px-1 py-0.5 text-left text-[11px] hover:bg-muted"
          >
            <span
              className={cn(
                "h-2.5 w-[3px] shrink-0 rounded-full",
                PRIORIDADE[t.prioridade as "p1"].bar,
              )}
            />
            <span
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                TONE_BAR[statusTarefa(t.status).tone],
              )}
            />
            <span className="truncate text-foreground">{t.titulo}</span>
          </button>
        ))}
        {tarefas.length > MAX_VISIVEIS && (
          <span className="block px-1 text-[11px] text-muted-foreground">
            +{tarefas.length - MAX_VISIVEIS} mais
          </span>
        )}
      </div>
    </div>
  );
}
