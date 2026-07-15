import type { FeriadoBR } from "@/lib/feriados-br";
import { CelulaDia, type TarefaCelula } from "./celula-dia";
import { DIAS, chaveDia, montarCelulas } from "./utils";
import brandSymbol from "@/assets/brand/agilliza-symbol-oficial.png";


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
    <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-border shadow-card">
      <div className="relative z-10 grid min-w-[560px] grid-cols-7 gap-px overflow-x-auto">
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
      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center mix-blend-multiply dark:mix-blend-screen">
        <img
          src={brandSymbol}
          alt=""
          aria-hidden
          draggable={false}
          className="h-[90%] w-auto max-w-[85%] select-none object-contain opacity-[0.07] dark:opacity-[0.09]"
        />
      </div>
    </div>
  );
}
