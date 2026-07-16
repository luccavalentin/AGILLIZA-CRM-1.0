import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, MoreHorizontal, Plus, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  listarDemandas,
  moverStatusDemanda,
  transicaoDemandaPermitida,
  type DemandaStatus,
} from "@/lib/operacional/demandas.functions";
import { listarResponsaveisEquipe } from "@/lib/propostas/propostas.functions";
import { statusDemanda, TONE_BAR } from "@/components/operacional/status";
import { PriorityChip, OpAvatar } from "@/components/operacional/ui";
import { NovaDemandaDialog } from "@/components/operacional/nova-demanda-dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type DemandaItem = Awaited<ReturnType<typeof listarDemandas>>[number];

/* ------------------------------- SLA (kanban) ------------------------------ */
/** Texto curto de SLA no padrão da referência (Aberta há Xd / SLA vence / vencido / Concluída). */
function fmtDur(ms: number): string {
  const s = Math.max(Math.floor(Math.abs(ms) / 1000), 0);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return h > 0 ? `${d}d ${h}h ${m}m` : `${d}d`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
function fmtDias(inicio: string, now: number): string {
  const dias = Math.max(Math.floor((now - new Date(inicio).getTime()) / 86_400_000), 0);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "há 1 dia";
  return `há ${dias} dias`;
}
function fmtData(d: string): string {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function SlaLine({ d, now }: { d: DemandaItem; now: number }) {
  if (d.status === "concluida") {
    const noPrazo = !d.concluida_em || !d.prazo_sla || new Date(d.concluida_em).getTime() <= new Date(d.prazo_sla).getTime();
    return (
      <span className={cn("inline-flex items-center gap-1.5", noPrazo ? "text-success" : "text-destructive")}>
        <CheckCircle2 className="h-3.5 w-3.5" />
        Concluída em {d.concluida_em ? fmtData(d.concluida_em) : "—"}
      </span>
    );
  }
  if (d.status === "cancelada") {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <Clock className="h-3.5 w-3.5" /> Cancelada
      </span>
    );
  }
  if (d.status === "aguardando") {
    // aguardando retorno — mostra idade desde o início ou vencimento se estiver próximo
    if (d.prazo_sla) {
      const restante = new Date(d.prazo_sla).getTime() - now;
      if (restante < 0) {
        return (
          <span className="inline-flex items-center gap-1.5 text-destructive font-medium">
            <AlertTriangle className="h-3.5 w-3.5" /> SLA vencido {fmtDur(restante)}
          </span>
        );
      }
      if (restante < 24 * 3600_000) {
        return (
          <span className="inline-flex items-center gap-1.5 text-warning">
            <Clock className="h-3.5 w-3.5" /> SLA vence em {fmtDur(restante)}
          </span>
        );
      }
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <Clock className="h-3.5 w-3.5" /> Aguardando {fmtDias(d.sla_inicio, now)}
      </span>
    );
  }
  // aberta / em_andamento
  if (d.prazo_sla) {
    const restante = new Date(d.prazo_sla).getTime() - now;
    if (restante < 0) {
      return (
        <span className="inline-flex items-center gap-1.5 text-destructive font-medium">
          <AlertTriangle className="h-3.5 w-3.5" /> SLA vencido {fmtDur(restante)}
        </span>
      );
    }
    if (restante < 24 * 3600_000) {
      return (
        <span className="inline-flex items-center gap-1.5 text-warning">
          <Clock className="h-3.5 w-3.5" /> SLA vence em {fmtDur(restante)}
        </span>
      );
    }
    // >24h: mostra tempo restante em dias/horas
    return (
      <span className="inline-flex items-center gap-1.5 text-success/90">
        <Clock className="h-3.5 w-3.5" /> SLA vence em {fmtDur(restante)}
      </span>
    );
  }
  const rot = d.status === "aberta" ? "Aberta" : "Em andamento";
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <Clock className="h-3.5 w-3.5" /> {rot} {fmtDias(d.sla_inicio, now)}
    </span>
  );
}

/* --------------------------------- Card ------------------------------------ */

const KanbanCard = memo(function KanbanCard({
  d,
  now,
  onDragStart,
  onDragEnd,
  onOpen,
}: {
  d: DemandaItem;
  now: number;
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
      className="group cursor-pointer rounded-xl border border-border/70 bg-card p-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          {d.numero ?? "DEM-—"}
        </span>
        <PriorityChip prioridade={d.prioridade} />
      </div>
      <p className="mt-1.5 line-clamp-2 text-[13.5px] font-semibold leading-snug text-foreground">
        {d.titulo}
      </p>
      {d.nome_cliente && (
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{d.nome_cliente}</p>
      )}
      <div className="mt-2.5 flex items-center gap-1.5">
        <OpAvatar nome={d.nome_responsavel} className="size-5 text-[9px]" />
        <span className="truncate text-xs text-muted-foreground">
          {d.nome_responsavel ?? "Sem responsável"}
        </span>
      </div>
      <div className="mt-2.5 border-t border-border/60 pt-2 text-xs tabular-nums">
        <SlaLine d={d} now={now} />
      </div>
    </div>
  );
});

/* --------------------------------- Rota ------------------------------------ */

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
  const arrastandoRef = useRef<{ id: string; status: DemandaStatus } | null>(null);
  const [arrastando, setArrastando] = useState<{ id: string; status: DemandaStatus } | null>(null);
  const [escopo, setEscopo] = useState<"minhas" | "equipe">(
    () => (typeof window !== "undefined" && (localStorage.getItem("demandas:escopo") as "minhas" | "equipe")) || "equipe",
  );
  const [filtroResponsavel, setFiltroResponsavel] = useState<string>("todos");

  const { data, refetch } = useQuery({
    queryKey: ["demandas", "kanban", escopo],
    queryFn: () => listarDemandas({ data: { escopo } }),
  });

  const { data: responsaveis } = useQuery({
    queryKey: ["demandas", "responsaveis-equipe"],
    queryFn: () => listarResponsaveisEquipe(),
    staleTime: 5 * 60_000,
  });

  // Relógio compartilhado — evita 1 timer por card.
  const [now, setNow] = useState(() => Date.now());
  useMemo(() => {
    if (typeof window === "undefined") return;
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const onDragStart = useCallback((id: string, status: DemandaStatus) => {
    arrastandoRef.current = { id, status };
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

  const itens = useMemo(() => {
    const base = data ?? [];
    if (filtroResponsavel === "todos") return base;
    if (filtroResponsavel === "sem") return base.filter((d) => !d.responsavel_id);
    return base.filter((d) => d.responsavel_id === filtroResponsavel);
  }, [data, filtroResponsavel]);
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

      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          value={escopo}
          onValueChange={(v) => {
            const val = v as "minhas" | "equipe";
            setEscopo(val);
            if (typeof window !== "undefined") localStorage.setItem("demandas:escopo", val);
          }}
        >
          <TabsList className="h-10 rounded-xl">
            <TabsTrigger value="minhas" className="rounded-lg">Minhas</TabsTrigger>
            <TabsTrigger value="equipe" className="rounded-lg">Gerais</TabsTrigger>
          </TabsList>
        </Tabs>

        <Select value={filtroResponsavel} onValueChange={setFiltroResponsavel}>
          <SelectTrigger className="h-10 w-full max-w-[260px] rounded-xl sm:w-[260px]">
            <SelectValue placeholder="Filtrar por responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os responsáveis</SelectItem>
            <SelectItem value="sem">Sem responsável</SelectItem>
            {(responsaveis ?? []).map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {filtroResponsavel !== "todos" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9"
            onClick={() => setFiltroResponsavel("todos")}
          >
            Limpar filtro
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 pb-3 sm:grid-cols-2 xl:grid-cols-4">
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
                "flex min-w-0 flex-col rounded-2xl border border-border/60 bg-muted/30 transition-all",
                alvo && "border-primary/60 bg-primary/5 ring-2 ring-primary/30",
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-2 border-b border-border/50 px-4 py-3">
                <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <span className={cn("size-2 rounded-full", TONE_BAR[cfg.tone])} />
                  {cfg.label}
                  <span className="ml-1 text-xs font-medium tabular-nums text-muted-foreground">
                    {doStatus.length}
                  </span>
                </span>
                <button
                  type="button"
                  className="rounded-md p-1 text-muted-foreground/70 opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100"
                  aria-label="Opções da coluna"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>

              {/* Cards */}
              <div className="brand-scroll flex-1 space-y-2.5 p-2.5">
                {doStatus.length === 0 && (
                  <p className="rounded-lg border border-dashed border-border/60 bg-background/40 px-2 py-6 text-center text-xs text-muted-foreground/70">
                    Sem demandas
                  </p>
                )}
                {doStatus.map((d) => (
                  <KanbanCard
                    key={d.id}
                    d={d}
                    now={now}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    onOpen={onOpen}
                  />
                ))}
              </div>

              {/* Footer — criar demanda */}
              <div className="border-t border-border/50 p-2">
                <NovaDemandaDialog
                  onCriada={() => refetch()}
                  trigger={
                    <button
                      type="button"
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-primary"
                    >
                      <Plus className="h-3.5 w-3.5" /> Criar demanda
                    </button>
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
