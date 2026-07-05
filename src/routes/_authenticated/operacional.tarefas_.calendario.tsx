import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import { listarTarefas } from "@/lib/operacional/tarefas.functions";
import { TarefaDrawer } from "@/components/operacional/tarefa-drawer";
import { statusTarefa, PRIORIDADE, TONE_BAR } from "@/components/operacional/status";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/operacional/tarefas_/calendario")({
  head: () => ({ meta: [{ title: "Calendário de Tarefas — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.tarefas"),
  component: Pagina,
});

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function chaveDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Pagina() {
  const hoje = new Date();
  const [ref, setRef] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const [sel, setSel] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["tarefas", "calendario"],
    queryFn: () => listarTarefas({ data: { escopo: "todas" } }),
  });

  const porDia = new Map<string, any[]>();
  (data ?? []).forEach((t) => {
    if (!t.prazo) return;
    const k = chaveDia(new Date(t.prazo));
    const arr = porDia.get(k) ?? [];
    arr.push(t);
    porDia.set(k, arr);
  });

  const primeiro = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const inicio = new Date(primeiro);
  inicio.setDate(inicio.getDate() - primeiro.getDay());
  const celulas: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    celulas.push(d);
  }
  const hojeK = chaveDia(hoje);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Calendário de Tarefas</h1>
          <p className="text-sm text-muted-foreground">Tarefas organizadas pela data de prazo.</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/operacional/tarefas"><ArrowLeft className="mr-1 h-4 w-4" /> Lista</Link>
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium text-foreground">
          {MESES[ref.getMonth()]} {ref.getFullYear()}
        </h2>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8"
            onClick={() => setRef(new Date(ref.getFullYear(), ref.getMonth() - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setRef(new Date(hoje.getFullYear(), hoje.getMonth(), 1))}>
            Hoje
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8"
            onClick={() => setRef(new Date(ref.getFullYear(), ref.getMonth() + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border">
        {DIAS.map((d) => (
          <div key={d} className="bg-muted/50 px-2 py-1.5 text-center text-xs font-medium text-muted-foreground">{d}</div>
        ))}
        {celulas.map((d) => {
          const k = chaveDia(d);
          const doDia = porDia.get(k) ?? [];
          const foraMes = d.getMonth() !== ref.getMonth();
          return (
            <div key={k} className={cn("min-h-[92px] bg-card p-1.5", foraMes && "bg-muted/30")}>
              <div className={cn(
                "mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs tabular-nums",
                k === hojeK ? "bg-primary text-primary-foreground" : foraMes ? "text-muted-foreground" : "text-foreground",
              )}>
                {d.getDate()}
              </div>
              <div className="space-y-1">
                {doDia.slice(0, 3).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSel(t.id)}
                    className="flex w-full items-center gap-1 overflow-hidden rounded bg-muted/60 px-1 py-0.5 text-left text-[11px] hover:bg-muted"
                  >
                    <span className={cn("h-2.5 w-[3px] shrink-0 rounded-full", PRIORIDADE[t.prioridade as "p1"].bar)} />
                    <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", TONE_BAR[statusTarefa(t.status).tone])} />
                    <span className="truncate text-foreground">{t.titulo}</span>
                  </button>
                ))}
                {doDia.length > 3 && (
                  <span className="block px-1 text-[11px] text-muted-foreground">+{doDia.length - 3} mais</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <TarefaDrawer id={sel} onClose={() => setSel(null)} />
    </div>
  );
}
