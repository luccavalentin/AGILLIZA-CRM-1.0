import { cn } from "@/lib/utils";
import type { FeriadoBR } from "@/lib/feriados-br";
import { CelulaDia, type TarefaCelula } from "./celula-dia";
import { DIAS, MESES, chaveDia, montarCelulas } from "./utils";
import { statusTarefa, PRIORIDADE, TONE_BAR } from "@/components/operacional/status";
import brandSymbol from "@/assets/brand/agilliza-symbol-oficial.png";
import type { VisaoCalendario } from "./navegacao-calendario";

interface GradeCalendarioProps {
  ref: Date;
  hojeChave: string;
  visao: VisaoCalendario;
  tarefasPorDia: Map<string, TarefaCelula[]>;
  feriados: Map<string, FeriadoBR>;
  onSelecionar: (id: string) => void;
  onIrPara?: (data: Date) => void;
}

/** Dispatcher visual do calendário — alterna entre Dia, Semana, Mês e Ano. */
export function GradeCalendario(props: GradeCalendarioProps) {
  const { visao } = props;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-border shadow-card">
      <div className="relative z-10 bg-card">
        {visao === "dia" && <VisaoDia {...props} />}
        {visao === "semana" && <VisaoSemana {...props} />}
        {visao === "mes" && <VisaoMes {...props} />}
        {visao === "ano" && <VisaoAno {...props} />}
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

/* ---------- Mês (grade tradicional) ---------- */
function VisaoMes({ ref, hojeChave, tarefasPorDia, feriados, onSelecionar }: GradeCalendarioProps) {
  const celulas = montarCelulas(ref);
  return (
    <div className="grid min-w-[560px] grid-cols-7 gap-px overflow-x-auto bg-border">
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

/* ---------- Semana ---------- */
function VisaoSemana({ ref, hojeChave, tarefasPorDia, feriados, onSelecionar }: GradeCalendarioProps) {
  const inicio = new Date(ref);
  inicio.setDate(inicio.getDate() - inicio.getDay());
  const dias: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    dias.push(d);
  }
  return (
    <div className="grid min-w-[560px] grid-cols-7 gap-px overflow-x-auto bg-border">
      {DIAS.map((d) => (
        <div
          key={d}
          className="bg-muted/50 px-2 py-1.5 text-center text-xs font-medium text-muted-foreground"
        >
          {d}
        </div>
      ))}
      {dias.map((d) => {
        const k = chaveDia(d);
        return (
          <div key={k} className="min-h-[420px] bg-card p-2">
            <CelulaDia
              data={d}
              chave={k}
              tarefas={tarefasPorDia.get(k) ?? []}
              foraMes={false}
              hoje={k === hojeChave}
              feriado={feriados.get(k)}
              onSelecionar={onSelecionar}
            />
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Dia ---------- */
function VisaoDia({ ref, hojeChave, tarefasPorDia, feriados, onSelecionar }: GradeCalendarioProps) {
  const k = chaveDia(ref);
  const tarefas = tarefasPorDia.get(k) ?? [];
  const feriado = feriados.get(k);
  const eHoje = k === hojeChave;

  return (
    <div className="min-h-[420px] bg-card p-6">
      <div className="mb-4 flex items-center gap-3">
        <span
          className={cn(
            "inline-flex h-12 w-12 items-center justify-center rounded-2xl text-xl font-semibold tabular-nums",
            eHoje ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
          )}
        >
          {ref.getDate()}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {ref.toLocaleDateString("pt-BR", { weekday: "long" })}
          </p>
          <p className="text-lg font-semibold text-foreground">
            {MESES[ref.getMonth()]} {ref.getFullYear()}
          </p>
          {feriado && (
            <p
              className={cn(
                "mt-1 inline-block rounded px-2 py-0.5 text-xs font-medium",
                feriado.facultativo
                  ? "bg-muted text-muted-foreground"
                  : "bg-destructive/10 text-destructive",
              )}
            >
              {feriado.descricao}
              {feriado.facultativo ? " (facultativo)" : ""}
            </p>
          )}
        </div>
      </div>

      {tarefas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhuma tarefa neste dia.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {tarefas.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => onSelecionar(t.id)}
                className="flex w-full items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-left text-sm shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <span
                  className={cn(
                    "h-4 w-[3px] shrink-0 rounded-full",
                    PRIORIDADE[t.prioridade as "p1"].bar,
                  )}
                />
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    TONE_BAR[statusTarefa(t.status).tone],
                  )}
                />
                <span className="truncate font-medium text-foreground">{t.titulo}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- Ano (12 mini-meses) ---------- */
function VisaoAno({ ref, hojeChave, tarefasPorDia, onIrPara }: GradeCalendarioProps) {
  const ano = ref.getFullYear();
  const meses = Array.from({ length: 12 }, (_, i) => new Date(ano, i, 1));

  return (
    <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {meses.map((m) => (
        <MiniMes
          key={m.getMonth()}
          referencia={m}
          hojeChave={hojeChave}
          tarefasPorDia={tarefasPorDia}
          onIrPara={onIrPara}
        />
      ))}
    </div>
  );
}

function MiniMes({
  referencia,
  hojeChave,
  tarefasPorDia,
  onIrPara,
}: {
  referencia: Date;
  hojeChave: string;
  tarefasPorDia: Map<string, TarefaCelula[]>;
  onIrPara?: (d: Date) => void;
}) {
  const celulas = montarCelulas(referencia);
  return (
    <button
      type="button"
      onClick={() => onIrPara?.(referencia)}
      className="group flex flex-col gap-2 bg-card p-3 text-left transition-colors hover:bg-primary/[0.03]"
    >
      <span className="text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
        {MESES[referencia.getMonth()]}
      </span>
      <div className="grid grid-cols-7 gap-0.5">
        {DIAS.map((d) => (
          <span
            key={d}
            className="text-center text-[9px] font-medium uppercase tracking-wider text-muted-foreground"
          >
            {d.charAt(0)}
          </span>
        ))}
        {celulas.map((d) => {
          const k = chaveDia(d);
          const foraMes = d.getMonth() !== referencia.getMonth();
          const eHoje = k === hojeChave;
          const tem = (tarefasPorDia.get(k) ?? []).length > 0;
          return (
            <span
              key={k}
              className={cn(
                "relative grid aspect-square place-items-center rounded text-[10px] tabular-nums",
                foraMes && "text-muted-foreground/50",
                !foraMes && !eHoje && "text-foreground",
                eHoje && "bg-primary font-semibold text-primary-foreground",
              )}
            >
              {d.getDate()}
              {tem && !eHoje && (
                <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-primary" />
              )}
            </span>
          );
        })}
      </div>
    </button>
  );
}
