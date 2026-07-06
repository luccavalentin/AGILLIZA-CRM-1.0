import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  listarDemandas,
  moverStatusDemanda,
  transicaoDemandaPermitida,
  type DemandaStatus,
} from "@/lib/operacional/demandas.functions";
import { PRIORIDADE, statusDemanda, TONE_BAR } from "@/components/operacional/status";
import { SlaCountdown } from "@/components/operacional/sla-countdown";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/operacional/demandas_/kanban")({
  head: () => ({ meta: [{ title: "Kanban de Demandas — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.demandas"),
  component: Pagina,
});

const COLUNAS: DemandaStatus[] = ["aberta", "em_andamento", "aguardando", "concluida", "cancelada"];

function Pagina() {
  const qc = useQueryClient();
  const moverFn = useServerFn(moverStatusDemanda);
  const [arrastando, setArrastando] = useState<{ id: string; status: DemandaStatus } | null>(null);

  const { data } = useQuery({
    queryKey: ["demandas", "kanban"],
    queryFn: () => listarDemandas({ data: { escopo: "equipe" } }),
  });

  async function soltar(coluna: DemandaStatus) {
    if (!arrastando) return;
    const { id, status } = arrastando;
    setArrastando(null);
    if (status === coluna) return;
    if (!transicaoDemandaPermitida(status, coluna)) {
      toast.error(
        `Transição inválida: ${statusDemanda(status).label} → ${statusDemanda(coluna).label}.`,
      );
      return;
    }
    try {
      await moverFn({ data: { id, status: coluna } });
      qc.invalidateQueries({ queryKey: ["demandas"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao mover.");
    }
  }

  const itens = data ?? [];

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Kanban de Demandas</h1>
          <p className="text-sm text-muted-foreground">Arraste os cards entre etapas permitidas.</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/operacional/demandas">
            <ArrowLeft className="mr-1 h-4 w-4" /> Lista
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {COLUNAS.map((col) => {
          const cfg = statusDemanda(col);
          const doStatus = itens.filter((d) => d.status === col);
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
                {doStatus.map((d) => (
                  <div
                    key={d.id}
                    draggable
                    onDragStart={() => setArrastando({ id: d.id, status: d.status })}
                    onDragEnd={() => setArrastando(null)}
                    className="overflow-hidden rounded-lg border border-border bg-card"
                  >
                    <div className={cn("h-[2px]", PRIORIDADE[d.prioridade].bar)} />
                    <div className="p-3">
                      <Link
                        to="/operacional/demandas/$id"
                        params={{ id: d.id }}
                        className="text-sm font-medium text-foreground hover:underline"
                      >
                        {d.titulo}
                      </Link>
                      {d.nome_cliente && (
                        <p className="text-xs text-muted-foreground">{d.nome_cliente}</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {d.nome_responsavel ?? "—"}
                      </p>
                      <div className="mt-2">
                        <SlaCountdown
                          inicio={d.sla_inicio}
                          prazo={d.prazo_sla}
                          concluida={d.status === "concluida"}
                          concluidaEm={d.concluida_em}
                        />
                      </div>
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
