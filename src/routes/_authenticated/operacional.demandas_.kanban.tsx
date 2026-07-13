import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  listarDemandas,
  moverStatusDemanda,
  transicaoDemandaPermitida,
  type DemandaStatus,
} from "@/lib/operacional/demandas.functions";
import { statusDemanda, TONE_BAR } from "@/components/operacional/status";
import { PriorityChip, OpAvatar } from "@/components/operacional/ui";
import { SlaCountdown } from "@/components/operacional/sla-countdown";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DemandaItem = Awaited<ReturnType<typeof listarDemandas>>[number];

const KanbanCard = memo(function KanbanCard({
  d,
  onDragStart,
  onDragEnd,
  onOpen,
}: {
  d: DemandaItem;
  onDragStart: (id: string, status: DemandaStatus) => void;
  onDragEnd: () => void;
  onOpen: (id: string) => void;
}) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(d.id, d.status as DemandaStatus)}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(d.id)}
      className="op-kcard cursor-pointer overflow-hidden p-3 active:cursor-grabbing"
      style={{ ["--op-accent" as string]: "var(--primary)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="line-clamp-2 text-sm font-medium text-foreground">{d.titulo}</span>
        <PriorityChip prioridade={d.prioridade} />
      </div>
      {d.nome_cliente && (
        <p className="mt-1 truncate text-xs text-muted-foreground">{d.nome_cliente}</p>
      )}
      <div className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <OpAvatar nome={d.nome_responsavel} className="size-5 text-[9px]" />
        <span className="truncate">{d.nome_responsavel ?? "—"}</span>
      </div>
      <div className="mt-2 border-t border-border/60 pt-2">
        <SlaCountdown
          inicio={d.sla_inicio}
          prazo={d.prazo_sla}
          concluida={d.status === "concluida"}
          concluidaEm={d.concluida_em}
        />
      </div>
    </div>
  );
});


export const Route = createFileRoute("/_authenticated/operacional/demandas_/kanban")({
  head: () => ({ meta: [{ title: "Kanban de Demandas — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.demandas"),
  component: Pagina,
});

const COLUNAS: DemandaStatus[] = ["aberta", "em_andamento", "aguardando", "concluida", "cancelada"];

function Pagina() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const moverFn = useServerFn(moverStatusDemanda);
  // Fonte do arraste em ref: não dispara re-render ao iniciar o drag (evita a
  // "trava" do ghost). O estado abaixo só controla o realce da coluna-alvo.
  const arrastandoRef = useRef<{ id: string; status: DemandaStatus } | null>(null);
  const [arrastando, setArrastando] = useState<{ id: string; status: DemandaStatus } | null>(null);

  const { data } = useQuery({
    queryKey: ["demandas", "kanban"],
    queryFn: () => listarDemandas({ data: { escopo: "equipe" } }),
  });

  const onDragStart = useCallback((id: string, status: DemandaStatus) => {
    arrastandoRef.current = { id, status };
    // Adia o realce para depois do navegador capturar a imagem de arraste,
    // deixando o movimento fluido em vez de "pesado".
    requestAnimationFrame(() => setArrastando({ id, status }));
  }, []);

  const onDragEnd = useCallback(() => {
    arrastandoRef.current = null;
    setArrastando(null);
  }, []);

  const onOpen = useCallback(
    (id: string) => navigate({ to: "/operacional/demandas/$id", params: { id } }),
    [navigate],
  );

  const soltar = useCallback(
    async (coluna: DemandaStatus) => {
      const origem = arrastandoRef.current;
      arrastandoRef.current = null;
      setArrastando(null);
      if (!origem) return;
      const { id, status } = origem;
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
    },
    [moverFn, qc],
  );

  const itens = useMemo(() => data ?? [], [data]);
  // Agrupa uma única vez por status, em vez de refiltrar a lista inteira
  // para cada coluna a cada render (inclusive durante o arraste).
  const porStatus = useMemo(() => {
    const mapa = new Map<DemandaStatus, DemandaItem[]>();
    for (const col of COLUNAS) mapa.set(col, []);
    for (const d of itens) mapa.get(d.status as DemandaStatus)?.push(d);
    return mapa;
  }, [itens]);


  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="op-hero grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-5">
        <div className="min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/80">
            Operacional
          </span>
          <h1 className="truncate text-xl font-bold tracking-tight text-foreground">
            Kanban de Demandas
          </h1>
          <p className="text-sm text-muted-foreground">
            Arraste os cards entre etapas permitidas.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="bg-card/60 backdrop-blur">
          <Link to="/operacional/demandas">
            <ArrowLeft className="mr-1 h-4 w-4" /> Lista
          </Link>
        </Button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {COLUNAS.map((col) => {
          const cfg = statusDemanda(col);
          const doStatus = porStatus.get(col) ?? [];
          const alvo = arrastando && transicaoDemandaPermitida(arrastando.status, col);
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
                    Sem demandas
                  </p>
                )}
                {doStatus.map((d) => (
                  <KanbanCard
                    key={d.id}
                    d={d}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    onOpen={onOpen}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

