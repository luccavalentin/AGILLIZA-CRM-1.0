import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  listarTarefas,
  moverStatusTarefa,
  transicaoTarefaPermitida,
  type TarefaStatus,
} from "@/lib/operacional/tarefas.functions";
import { PRIORIDADE, statusTarefa, TONE_BAR } from "@/components/operacional/status";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/operacional/tarefas_/kanban")({
  head: () => ({ meta: [{ title: "Kanban de Tarefas — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.tarefas"),
  component: Pagina,
});

const COLUNAS: TarefaStatus[] = ["aberta", "em_andamento", "concluida", "cancelada"];

function Pagina() {
  const qc = useQueryClient();
  const moverFn = useServerFn(moverStatusTarefa);
  const [arrastando, setArrastando] = useState<{ id: string; status: TarefaStatus } | null>(null);

  const { data } = useQuery({
    queryKey: ["tarefas", "kanban"],
    queryFn: () => listarTarefas({ data: { escopo: "todas" } }),
  });

  async function soltar(coluna: TarefaStatus) {
    if (!arrastando) return;
    const { id, status } = arrastando;
    setArrastando(null);
    if (status === coluna) return;
    if (!transicaoTarefaPermitida(status, coluna)) {
      toast.error(
        `Transição inválida: ${statusTarefa(status).label} → ${statusTarefa(coluna).label}.`,
      );
      return;
    }
    try {
      await moverFn({ data: { id, status: coluna } });
      qc.invalidateQueries({ queryKey: ["tarefas"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao mover.");
    }
  }

  const itens = data ?? [];

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Kanban de Tarefas</h1>
          <p className="text-sm text-muted-foreground">Arraste os cards entre etapas permitidas.</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/operacional/tarefas">
            <ArrowLeft className="mr-1 h-4 w-4" /> Lista
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {COLUNAS.map((col) => {
          const cfg = statusTarefa(col);
          const doStatus = itens.filter((t) => t.status === col);
          return (
            <div
              key={col}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => soltar(col)}
              className="rounded-lg border border-border bg-muted/30"
            >
              <div className={cn("h-[3px] rounded-t-lg", TONE_BAR[cfg.tone])} />
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-sm font-medium text-foreground">{cfg.label}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {doStatus.length}
                </span>
              </div>
              <div className="space-y-2 p-2">
                {doStatus.map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={() => setArrastando({ id: t.id, status: t.status })}
                    onDragEnd={() => setArrastando(null)}
                    className="overflow-hidden rounded-lg border border-border bg-card"
                  >
                    <div className={cn("h-[2px]", PRIORIDADE[t.prioridade].bar)} />
                    <div className="p-3">
                      <p className="text-sm font-medium text-foreground">{t.titulo}</p>
                      {t.nome_cliente && (
                        <p className="text-xs text-muted-foreground">{t.nome_cliente}</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t.nome_responsavel ?? "—"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
