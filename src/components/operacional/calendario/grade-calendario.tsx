import type { FeriadoBR } from "@/lib/feriados-br";
import { CelulaDia, type TarefaCelula } from "./celula-dia";
import { DIAS, chaveDia, montarCelulas } from "./utils";

interface GradeCalendarioProps {
  ref: Date;
  hojeChave: string;
  tarefasPorDia: Map<string, TarefaCelula[]>;
  feriados: Map<string, FeriadoBR>;
  onSelecionar: (id: string) => void;
}

/** Grade mensal (cabeçalho de dias da semana + 42 células). */
export function GradeCalendario({
  ref,
  hojeChave,
  tarefasPorDia,
  feriados,
  onSelecionar,
}: GradeCalendarioProps) {
  const celulas = montarCelulas(ref);

  return (
    <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-border/70 bg-border shadow-card">
      {DIAS.map((d) => (
        <div
          key={d}
          className="bg-muted/50 px-2 py-1.5 text-center text-xs font-medium text-muted-foreground"
        >
          {d}
        </div>
      ))}
      {celulas.map((d) => {
        const k = chaveDia(d);
        return (
          <CelulaDia
            key={k}
            data={d}
            chave={k}
            tarefas={tarefasPorDia.get(k) ?? []}
            foraMes={d.getMonth() !== ref.getMonth()}
            hoje={k === hojeChave}
            feriado={feriados.get(k)}
            onSelecionar={onSelecionar}
          />
        );
      })}
    </div>
  );
}
