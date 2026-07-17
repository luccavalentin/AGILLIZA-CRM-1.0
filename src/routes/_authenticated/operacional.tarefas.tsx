import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  KanbanSquare,
  CalendarDays,
  Search,
  ListChecks,
  CircleDot,
  Loader2,
  CheckCircle2,
  Clock,
  Check,
  User2,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { baixarTarefasPDF } from "@/lib/operacional/export-pdf";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  listarTarefas,
  excluirTarefa,
  concluirTarefa,
  moverStatusTarefa,
} from "@/lib/operacional/tarefas.functions";
import { NovaTarefaDialog } from "@/components/operacional/nova-tarefa-dialog";
import { TarefaDrawer } from "@/components/operacional/tarefa-drawer";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { type Prioridade } from "@/components/operacional/status";
import { OpHero, OpStat, PriorityChip, OpAvatar } from "@/components/operacional/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/operacional/tarefas")({
  head: () => ({ meta: [{ title: "Tarefas — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.tarefas"),
  component: Pagina,
});

type Tarefa = Awaited<ReturnType<typeof listarTarefas>>[number];

function fmtData(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo",  
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function vencida(prazo: string | null, status: string): boolean {
  if (!prazo || status === "concluida" || status === "cancelada") return false;
  return new Date(prazo).getTime() < Date.now();
}

const GRUPOS: Array<{
  id: string;
  titulo: string;
  match: (s: string) => boolean;
  accent: string;
  icon: typeof CircleDot;
}> = [
  {
    id: "aberta",
    titulo: "A fazer",
    match: (s) => s === "aberta",
    accent: "var(--primary)",
    icon: CircleDot,
  },
  {
    id: "em_andamento",
    titulo: "Em andamento",
    match: (s) => s === "em_andamento",
    accent: "var(--warning)",
    icon: Loader2,
  },
  {
    id: "concluida",
    titulo: "Concluídas",
    match: (s) => s === "concluida" || s === "cancelada",
    accent: "var(--success)",
    icon: CheckCircle2,
  },
];

function Pagina() {
  const [escopo, setEscopo] = useState<"todas" | "minhas">("minhas");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [alternando, setAlternando] = useState<string | null>(null);
  const excluir = useServerFn(excluirTarefa);
  const concluir = useServerFn(concluirTarefa);
  const mover = useServerFn(moverStatusTarefa);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["tarefas", escopo, q],
    queryFn: () => listarTarefas({ data: { escopo, q: q || undefined } }),
  });

  const itens = data ?? [];

  const stats = useMemo(() => {
    const agora = new Date();
    const fimHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59).getTime();
    const abertasList = itens.filter(
      (t) => t.status !== "concluida" && t.status !== "cancelada",
    );
    const vencidas = itens.filter((t) => vencida(t.prazo, t.status)).length;
    const hoje = abertasList.filter(
      (t) => t.prazo && !vencida(t.prazo, t.status) && new Date(t.prazo).getTime() <= fimHoje,
    ).length;
    const concluidas = itens.filter((t) => t.status === "concluida").length;
    return {
      total: itens.length,
      abertas: itens.filter((t) => t.status === "aberta").length,
      andamento: itens.filter((t) => t.status === "em_andamento").length,
      hoje,
      vencidas,
      concluidas,
      taxaConclusao: itens.length ? Math.round((concluidas / itens.length) * 100) : 0,
    };
  }, [itens]);


  const grupos = useMemo(
    () =>
      GRUPOS.map((g) => ({
        ...g,
        tarefas: itens.filter((t) => g.match(t.status)),
      })),
    [itens],
  );

  async function handleExcluir(id: string) {
    try {
      await excluir({ data: { id } });
      toast.success("Tarefa excluída.");
      refetch();
    } catch {
      toast.error("Não foi possível excluir a tarefa.");
    }
  }

  async function toggle(t: Tarefa) {
    if (alternando) return;
    const concluida = t.status === "concluida" || t.status === "cancelada";
    setAlternando(t.id);
    try {
      if (concluida) {
        await mover({ data: { id: t.id, status: "aberta" } });
        toast.success("Tarefa reaberta.");
      } else {
        await concluir({ data: { id: t.id } });
        toast.success("Tarefa concluída.");
      }
      await refetch();
    } catch {
      toast.error("Não foi possível atualizar a tarefa.");
    } finally {
      setAlternando(null);
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <OpHero
        icon={<ListChecks className="h-6 w-6" />}
        eyebrow="Operacional"
        titulo="Tarefas"
        descricao="Sua lista de trabalho — marque como concluída ao finalizar cada item."
        acoes={
          <>
            <Button asChild variant="outline" size="sm" className="bg-card/60 backdrop-blur">
              <Link to="/operacional/tarefas/calendario">
                <CalendarDays className="mr-1.5 h-4 w-4" /> Calendário
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="bg-card/60 backdrop-blur">
              <Link to="/operacional/tarefas/kanban">
                <KanbanSquare className="mr-1.5 h-4 w-4" /> Kanban
              </Link>
            </Button>
            <NovaTarefaDialog onCriada={refetch} />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <OpStat
          label="Total"
          value={stats.total}
          hint={`${stats.abertas + stats.andamento} em aberto`}
          icon={<ListChecks className="h-5 w-5" />}
        />
        <OpStat
          label="A fazer"
          value={stats.abertas}
          icon={<CircleDot className="h-5 w-5" />}
          accent="var(--primary)"
        />
        <OpStat
          label="Em andamento"
          value={stats.andamento}
          icon={<Loader2 className="h-5 w-5" />}
          accent="var(--warning)"
        />
        <OpStat
          label="Para hoje"
          value={stats.hoje}
          hint="Prazo até o fim do dia"
          icon={<Clock className="h-5 w-5" />}
          accent="var(--warning)"
          alerta={stats.hoje > 0}
        />
        <OpStat
          label="Vencidas"
          value={stats.vencidas}
          hint="Prazo ultrapassado"
          icon={<Clock className="h-5 w-5" />}
          accent="var(--destructive)"
          alerta={stats.vencidas > 0}
        />
        <OpStat
          label="Conclusão"
          value={`${stats.taxaConclusao}%`}
          hint={`${stats.concluidas} concluídas`}
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="var(--success)"
        />
      </div>


      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={escopo} onValueChange={(v) => setEscopo(v as "todas" | "minhas")}>
          <TabsList>
            <TabsTrigger value="minhas">Minhas</TabsTrigger>
            <TabsTrigger value="todas">Todas</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por título…"
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted/60" />
          ))}
        </div>
      ) : itens.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border/70 bg-card p-14 text-center shadow-card">
          <div className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
            <ListChecks className="h-7 w-7" />
          </div>
          <p className="text-sm font-medium text-foreground">Nenhuma tarefa encontrada</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Crie uma nova tarefa para organizar o trabalho da equipe.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grupos.map((g) =>
            g.tarefas.length === 0 ? null : (
              <section key={g.id} className="space-y-2.5">
                <div className="flex items-center gap-2 px-1">
                  <span
                    className="h-3.5 w-1 rounded-full"
                    style={{ background: g.accent }}
                  />
                  <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {g.titulo}
                  </h2>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                    {g.tarefas.length}
                  </span>
                </div>

                <ul className="space-y-2">
                  {g.tarefas.map((t) => {
                    const late = vencida(t.prazo, t.status);
                    const done = t.status === "concluida" || t.status === "cancelada";
                    return (
                      <li key={t.id}>
                        <div
                          className={cn(
                            "op-row group flex items-center gap-3 rounded-xl border border-border bg-card p-3 pr-3 shadow-card transition-colors hover:border-primary/30 hover:bg-accent/30 md:gap-4 md:p-3.5",
                            late && "ring-1 ring-destructive/30",
                          )}
                          style={{ ["--op-accent" as string]: g.accent }}
                        >
                          <button
                            type="button"
                            aria-label={done ? "Reabrir tarefa" : "Concluir tarefa"}
                            onClick={() => toggle(t)}
                            disabled={alternando === t.id}
                            className={cn(
                              "grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors",
                              done
                                ? "border-success bg-success text-success-foreground"
                                : "border-muted-foreground/40 text-transparent hover:border-primary hover:text-primary/40",
                            )}
                          >
                            {alternando === t.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                            ) : (
                              <Check className="h-3.5 w-3.5" strokeWidth={3} />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => setSel(t.id)}
                            className="flex min-w-0 flex-1 flex-col gap-1.5 text-left"
                          >
                            <span
                              className={cn(
                                "flex items-center gap-2 font-medium",
                                done ? "text-muted-foreground line-through" : "text-foreground",
                              )}
                            >
                              <span className="line-clamp-1">{t.titulo}</span>
                            </span>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span className="tabular-nums text-muted-foreground/70">
                                {t.numero}
                              </span>
                              <PriorityChip prioridade={t.prioridade as Prioridade} />
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 tabular-nums",
                                  late && "font-medium text-destructive",
                                )}
                              >
                                <Clock className="h-3 w-3" />
                                {fmtData(t.prazo)}
                              </span>
                              {t.nome_cliente && (
                                <span className="inline-flex items-center gap-1 truncate">
                                  <User2 className="h-3 w-3" />
                                  {t.nome_cliente}
                                </span>
                              )}
                            </div>
                          </button>

                          {t.nome_responsavel && (
                            <div className="hidden shrink-0 items-center gap-2 sm:flex">
                              <OpAvatar nome={t.nome_responsavel} />
                            </div>
                          )}

                          <div className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                            <ConfirmDelete
                              titulo="Excluir tarefa"
                              descricao={`A tarefa ${t.numero} será removida permanentemente.`}
                              onConfirm={() => handleExcluir(t.id)}
                            />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ),
          )}
        </div>
      )}

      <TarefaDrawer id={sel} onClose={() => setSel(null)} />
    </div>
  );
}
