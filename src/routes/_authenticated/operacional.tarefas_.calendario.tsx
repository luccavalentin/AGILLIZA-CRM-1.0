import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import { listarTarefas } from "@/lib/operacional/tarefas.functions";
import { TarefaDrawer } from "@/components/operacional/tarefa-drawer";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mapaFeriados } from "@/lib/feriados-br";
import { NavegacaoCalendario, type VisaoCalendario } from "@/components/operacional/calendario/navegacao-calendario";
import { GradeCalendario } from "@/components/operacional/calendario/grade-calendario";
import type { TarefaCelula } from "@/components/operacional/calendario/celula-dia";
import { chaveDia } from "@/components/operacional/calendario/utils";


export const Route = createFileRoute("/_authenticated/operacional/tarefas_/calendario")({
  head: () => ({ meta: [{ title: "Calendário de Tarefas — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.tarefas"),
  component: Pagina,
});

function Pagina() {
  const hoje = new Date();
  const [ref, setRef] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const [sel, setSel] = useState<string | null>(null);
  const [escopo, setEscopo] = useState<"todas" | "minhas">(
    () => (typeof window !== "undefined" && (localStorage.getItem("tarefas:escopo") as "todas" | "minhas")) || "todas",
  );

  const { data } = useQuery({
    queryKey: ["tarefas", "calendario", escopo],
    queryFn: () => listarTarefas({ data: { escopo } }),
  });

  const tarefasPorDia = useMemo(() => {
    const mapa = new Map<string, TarefaCelula[]>();
    (data ?? []).forEach((t) => {
      if (!t.prazo) return;
      const k = chaveDia(new Date(t.prazo));
      const arr = mapa.get(k) ?? [];
      arr.push(t as TarefaCelula);
      mapa.set(k, arr);
    });
    return mapa;
  }, [data]);

  const feriados = useMemo(
    () => mapaFeriados([ref.getFullYear() - 1, ref.getFullYear(), ref.getFullYear() + 1]),
    [ref],
  );

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="op-hero grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-5">
        <div className="min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/80">
            Operacional
          </span>
          <h1 className="truncate text-xl font-bold tracking-tight text-foreground">
            Calendário de Tarefas
          </h1>
          <p className="text-sm text-muted-foreground">Tarefas organizadas pela data de prazo.</p>
        </div>
        <Button asChild variant="outline" size="sm" className="bg-card/60 backdrop-blur">
          <Link to="/operacional/tarefas">
            <ArrowLeft className="mr-1 h-4 w-4" /> Lista
          </Link>
        </Button>
      </div>

      <Tabs
        value={escopo}
        onValueChange={(v) => {
          const val = v as "todas" | "minhas";
          setEscopo(val);
          if (typeof window !== "undefined") localStorage.setItem("tarefas:escopo", val);
        }}
      >
        <TabsList className="h-10 rounded-xl">
          <TabsTrigger value="minhas" className="rounded-lg">Minhas</TabsTrigger>
          <TabsTrigger value="todas" className="rounded-lg">Gerais</TabsTrigger>
        </TabsList>
      </Tabs>

      <NavegacaoCalendario ref={ref} hoje={hoje} onChange={setRef} />


      <GradeCalendario
        ref={ref}
        hojeChave={chaveDia(hoje)}
        tarefasPorDia={tarefasPorDia}
        feriados={feriados}
        onSelecionar={setSel}
      />

      <TarefaDrawer id={sel} onClose={() => setSel(null)} />
    </div>
  );
}
