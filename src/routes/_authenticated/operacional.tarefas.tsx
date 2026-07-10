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
  ArrowUpRight,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { assertModuloPermitido } from "@/lib/route-guards";
import { listarTarefas, excluirTarefa } from "@/lib/operacional/tarefas.functions";
import { NovaTarefaDialog } from "@/components/operacional/nova-tarefa-dialog";
import { TarefaDrawer } from "@/components/operacional/tarefa-drawer";
import { ToneBadge } from "@/components/crm/tone-badge";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { statusTarefa, TONE_BAR, type Prioridade } from "@/components/operacional/status";
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

function fmtData(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
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

function Pagina() {
  const [escopo, setEscopo] = useState<"todas" | "minhas">("minhas");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const excluir = useServerFn(excluirTarefa);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["tarefas", escopo, q],
    queryFn: () => listarTarefas({ data: { escopo, q: q || undefined } }),
  });

  const itens = data ?? [];

  const stats = useMemo(
    () => ({
      total: itens.length,
      abertas: itens.filter((t) => t.status === "aberta").length,
      andamento: itens.filter((t) => t.status === "em_andamento").length,
      concluidas: itens.filter((t) => t.status === "concluida").length,
    }),
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

  return (
    <div className="space-y-6 p-4 md:p-6">
      <OpHero
        icon={<ListChecks className="h-6 w-6" />}
        eyebrow="Operacional"
        titulo="Tarefas"
        descricao="Itens de trabalho, checklists e prazos da sua operação."
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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OpStat
          label="Total"
          value={stats.total}
          icon={<ListChecks className="h-5 w-5" />}
          tint="bg-primary/10 text-primary"
        />
        <OpStat
          label="Abertas"
          value={stats.abertas}
          icon={<CircleDot className="h-5 w-5" />}
          tint="bg-sky-500/10 text-sky-600 dark:text-sky-400"
          accent="var(--primary)"
        />
        <OpStat
          label="Em andamento"
          value={stats.andamento}
          icon={<Loader2 className="h-5 w-5" />}
          tint="bg-warning/15 text-warning-foreground"
          accent="var(--warning)"
        />
        <OpStat
          label="Concluídas"
          value={stats.concluidas}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tint="bg-success/10 text-success"
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

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-muted/60" />
            ))}
          </div>
        ) : itens.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-14 text-center">
            <div className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
              <ListChecks className="h-7 w-7" />
            </div>
            <p className="text-sm font-medium text-foreground">Nenhuma tarefa encontrada</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Crie uma nova tarefa para organizar o trabalho da equipe.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <table className="hidden w-full text-sm md:table">
              <thead className="border-b border-border/70 bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Nº</th>
                  <th className="px-4 py-3">Título</th>
                  <th className="hidden px-4 py-3 lg:table-cell">Cliente</th>
                  <th className="hidden px-4 py-3 lg:table-cell">Responsável</th>
                  <th className="px-4 py-3">Prazo</th>
                  <th className="hidden px-4 py-3 sm:table-cell">Prioridade</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {itens.map((t) => {
                  const late = vencida(t.prazo, t.status);
                  return (
                    <tr
                      key={t.id}
                      onClick={() => setSel(t.id)}
                      className={cn(
                        "op-row group cursor-pointer hover:bg-accent/40",
                        late && "bg-destructive/[0.04]",
                      )}
                    >
                      <td className="px-4 py-3 align-middle tabular-nums text-muted-foreground">
                        {t.numero}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <span className="flex items-center gap-1.5 font-medium text-foreground">
                          <span className="line-clamp-1">{t.titulo}</span>
                          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 align-middle text-muted-foreground lg:table-cell">
                        {t.nome_cliente ?? "—"}
                      </td>
                      <td className="hidden px-4 py-3 align-middle lg:table-cell">
                        <div className="flex items-center gap-2">
                          <OpAvatar nome={t.nome_responsavel} />
                          <span className="truncate text-muted-foreground">
                            {t.nome_responsavel ?? "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 tabular-nums",
                            late ? "font-medium text-destructive" : "text-muted-foreground",
                          )}
                        >
                          <Clock className="h-3.5 w-3.5" />
                          {fmtData(t.prazo)}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 align-middle sm:table-cell">
                        <PriorityChip prioridade={t.prioridade as Prioridade} />
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <ToneBadge tone={statusTarefa(t.status).tone}>
                          {statusTarefa(t.status).label}
                        </ToneBadge>
                      </td>
                      <td
                        className="px-4 py-3 text-right align-middle"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ConfirmDelete
                          titulo="Excluir tarefa"
                          descricao={`A tarefa ${t.numero} será removida permanentemente.`}
                          onConfirm={() => handleExcluir(t.id)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile */}
            <ul className="divide-y divide-border/60 md:hidden">
              {itens.map((t) => {
                const late = vencida(t.prazo, t.status);
                return (
                  <li key={t.id}>
                    <button
                      onClick={() => setSel(t.id)}
                      className={cn(
                        "op-row flex w-full flex-col gap-2 p-4 text-left active:bg-accent/40",
                        late && "bg-destructive/[0.04]",
                      )}
                      style={{
                        ["--op-accent" as string]: late
                          ? "var(--destructive)"
                          : "var(--primary)",
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="line-clamp-2 font-medium text-foreground">{t.titulo}</span>
                        <ToneBadge tone={statusTarefa(t.status).tone}>
                          {statusTarefa(t.status).label}
                        </ToneBadge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                        <span className="tabular-nums">{t.numero}</span>
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
                        {t.nome_responsavel && (
                          <span className="inline-flex items-center gap-1">
                            <OpAvatar nome={t.nome_responsavel} className="size-5 text-[9px]" />
                            {t.nome_responsavel}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      <TarefaDrawer id={sel} onClose={() => setSel(null)} />
    </div>
  );
}

// Mantém TONE_BAR importado disponível para futuras variações de status.
void TONE_BAR;
