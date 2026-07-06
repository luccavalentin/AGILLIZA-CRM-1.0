import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { KanbanSquare, CalendarDays, Users } from "lucide-react";
import { toast } from "sonner";
import { assertModuloPermitido } from "@/lib/route-guards";
import { listarTarefas, excluirTarefa } from "@/lib/operacional/tarefas.functions";
import { NovaTarefaDialog } from "@/components/operacional/nova-tarefa-dialog";
import { TarefaDrawer } from "@/components/operacional/tarefa-drawer";
import { ToneBadge } from "@/components/crm/tone-badge";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { PRIORIDADE, statusTarefa } from "@/components/operacional/status";
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

function Pagina() {
  const [escopo, setEscopo] = useState<"todas" | "minhas">("todas");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const excluir = useServerFn(excluirTarefa);

  const { data, refetch } = useQuery({
    queryKey: ["tarefas", escopo, q],
    queryFn: () => listarTarefas({ data: { escopo, q: q || undefined } }),
  });

  const itens = data ?? [];

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
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Tarefas</h1>
          <p className="text-sm text-muted-foreground">Itens de trabalho, checklists e prazos.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/operacional/tarefas/calendario">
              <CalendarDays className="mr-1 h-4 w-4" /> Calendário
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/operacional/tarefas/equipe">
              <Users className="mr-1 h-4 w-4" /> Equipe
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/operacional/tarefas/kanban">
              <KanbanSquare className="mr-1 h-4 w-4" /> Kanban
            </Link>
          </Button>
          <NovaTarefaDialog onCriada={refetch} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={escopo} onValueChange={(v) => setEscopo(v as any)}>
          <TabsList>
            <TabsTrigger value="todas">Todas</TabsTrigger>
            <TabsTrigger value="minhas">Minhas</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por título…"
          className="max-w-xs"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        {itens.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma tarefa encontrada.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Nº</th>
                <th className="px-3 py-2">Título</th>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Responsável</th>
                <th className="px-3 py-2">Prazo</th>
                <th className="px-3 py-2">Prioridade</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {itens.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => setSel(t.id)}
                  className="cursor-pointer transition-colors hover:bg-accent/50"
                >
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{t.numero}</td>
                  <td className="px-3 py-2 font-medium text-foreground">{t.titulo}</td>
                  <td className="px-3 py-2 text-muted-foreground">{t.nome_cliente ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{t.nome_responsavel ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {fmtData(t.prazo)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "inline-block h-1.5 w-8 rounded-full",
                        PRIORIDADE[t.prioridade].bar,
                      )}
                    />
                    <span className="ml-2 text-xs text-muted-foreground">
                      {PRIORIDADE[t.prioridade].label}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <ToneBadge tone={statusTarefa(t.status).tone}>
                      {statusTarefa(t.status).label}
                    </ToneBadge>
                  </td>
                  <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                    <ConfirmDelete
                      titulo="Excluir tarefa"
                      descricao={`A tarefa ${t.numero} será removida permanentemente.`}
                      onConfirm={() => handleExcluir(t.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <TarefaDrawer id={sel} onClose={() => setSel(null)} />
    </div>
  );
}
