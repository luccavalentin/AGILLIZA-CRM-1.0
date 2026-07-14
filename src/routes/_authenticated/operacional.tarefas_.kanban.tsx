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
import { statusTarefa, TONE_BAR } from "@/components/operacional/status";
import { PriorityChip, OpAvatar } from "@/components/operacional/ui";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    <div className="space-y-5 p-4 md:p-6">
      <div className="op-hero grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-5">
        <div className="min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/80">
            Operacional
          </span>
          <h1 className="truncate text-xl font-bold tracking-tight text-foreground">
            Kanban de Tarefas
          </h1>
          <p className="text-sm text-muted-foreground">
            Arraste os cards entre etapas permitidas.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="bg-card/60 backdrop-blur">
          <Link to="/operacional/tarefas">
            <ArrowLeft className="mr-1 h-4 w-4" /> Lista
          </Link>
        </Button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {COLUNAS.map((col) => {
          const cfg = statusTarefa(col);
          const doStatus = itens.filter((t) => t.status === col);
          const alvo = arrastando && transicaoTarefaPermitida(arrastando.status, col);
          return (
            <div
              key={col}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => soltar(col)}
              className={cn(
                "op-kcol flex w-[280px] shrink-0 flex-col transition-shadow",
                alvo && "ring-2 ring-primary/40",
              )}
            >
              <div className="flex items-center justify-between gap-2 px-3.5 pb-2 pt-3">
                <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <span className={cn("size-2 rounded-full", TONE_BAR[cfg.tone])} />
                  {cfg.label}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground tabular-nums">
                  {doStatus.length}
                </span>
              </div>
              <div className="brand-scroll flex-1 space-y-2.5 p-2.5">
                {doStatus.length === 0 && (
                  <p className="px-2 py-6 text-center text-xs text-muted-foreground/70">
                    Sem tarefas
                  </p>
                )}
                {doStatus.map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={() => setArrastando({ id: t.id, status: t.status })}
                    onDragEnd={() => setArrastando(null)}
                    className="op-kcard cursor-grab overflow-hidden p-3 active:cursor-grabbing"
                    style={{ ["--op-accent" as string]: "var(--primary)" }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-sm font-medium text-foreground">{t.titulo}</p>
                      <PriorityChip prioridade={t.prioridade} />
                    </div>
                    {t.nome_cliente && (
                      <p className="mt-1 truncate text-xs text-muted-foreground">{t.nome_cliente}</p>
                    )}
                    <div className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <OpAvatar nome={t.nome_responsavel} className="size-5 text-[9px]" />
                      <span className="truncate">{t.nome_responsavel ?? "—"}</span>
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

