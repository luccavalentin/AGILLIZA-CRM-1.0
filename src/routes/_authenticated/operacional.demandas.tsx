import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Search,
  Kanban,
  MessageCircle,
  Clock,
  AlertTriangle,
  CheckCircle2,
  X,
} from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import { listarDemandas, type DemandaStatus } from "@/lib/operacional/demandas.functions";
import { statusDemanda, TONE_BAR } from "@/components/operacional/status";
import { PriorityChip, OpAvatar } from "@/components/operacional/ui";
import { NovaDemandaDialog } from "@/components/operacional/nova-demanda-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/operacional/demandas")({
  head: () => ({ meta: [{ title: "Demandas — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.demandas"),
  component: Pagina,
});

function fmtData(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const hoje = new Date();
  const diff = Math.floor((hoje.getTime() - d.getTime()) / 86_400_000);
  if (diff <= 0) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (diff === 1) return "ontem";
  if (diff < 7) return `${diff}d atrás`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function SlaChip({ prazo, status }: { prazo: string | null; status: DemandaStatus }) {
  if (status === "concluida")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-success">
        <CheckCircle2 className="h-3 w-3" /> Concluída
      </span>
    );
  if (status === "cancelada")
    return <span className="text-xs text-muted-foreground">Cancelada</span>;
  if (!prazo)
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" /> Sem prazo
      </span>
    );
  const restante = new Date(prazo).getTime() - Date.now();
  if (restante < 0)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
        <AlertTriangle className="h-3 w-3" /> SLA vencido
      </span>
    );
  if (restante < 24 * 3600_000)
    return (
      <span className="inline-flex items-center gap-1 text-xs text-warning">
        <Clock className="h-3 w-3" /> &lt; 24h
      </span>
    );
  const dias = Math.ceil(restante / 86_400_000);
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Clock className="h-3 w-3" /> {dias}d
    </span>
  );
}

function Pagina() {
  const navigate = useNavigate();
  const [escopo, setEscopo] = useState<"minhas" | "geral">(
    () =>
      (typeof window !== "undefined" &&
        (localStorage.getItem("demandas:escopo") as "minhas" | "geral")) ||
      "geral",
  );
  const [q, setQ] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<DemandaStatus | "todas">("todas");

  const { data: itens, isLoading, refetch } = useQuery({
    queryKey: ["demandas", "lista", escopo],
    queryFn: () => listarDemandas({ data: { escopo } }),
  });

  const filtrados = useMemo(() => {
    const arr = itens ?? [];
    const termo = q.trim().toLowerCase();
    return arr.filter((d) => {
      if (statusFiltro !== "todas" && d.status !== statusFiltro) return false;
      if (!termo) return true;
      return (
        d.titulo.toLowerCase().includes(termo) ||
        (d.numero ?? "").toLowerCase().includes(termo) ||
        (d.nome_cliente ?? "").toLowerCase().includes(termo) ||
        (d.nome_responsavel ?? "").toLowerCase().includes(termo)
      );
    });
  }, [itens, q, statusFiltro]);

  const kpis = useMemo(() => {
    const arr = itens ?? [];
    const abertas = arr.filter((d) => d.status === "aberta" || d.status === "em_andamento").length;
    const aguardando = arr.filter((d) => d.status === "aguardando").length;
    const vencidas = arr.filter(
      (d) =>
        d.prazo_sla &&
        new Date(d.prazo_sla).getTime() < Date.now() &&
        d.status !== "concluida" &&
        d.status !== "cancelada",
    ).length;
    const naoLidas = arr.reduce((n, d) => n + (d.nao_lidas ?? 0), 0);
    return { abertas, aguardando, vencidas, naoLidas };
  }, [itens]);

  return (
    <div className="space-y-5 p-4 md:p-6">
      {/* Header */}
      <div className="op-hero grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-5">
        <div className="min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/80">
            Operacional
          </span>
          <h1 className="truncate text-xl font-bold tracking-tight text-foreground">Demandas</h1>
          <p className="text-sm text-muted-foreground">
            Envie tarefas para colegas e converse em tempo real.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="bg-card/60 backdrop-blur">
            <Link to="/operacional/demandas/kanban">
              <Kanban className="mr-1.5 h-4 w-4" /> Kanban
            </Link>
          </Button>
          <NovaDemandaDialog onCriada={() => refetch()} />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Ativas" valor={kpis.abertas} tone="primary" />
        <Kpi label="Aguardando" valor={kpis.aguardando} tone="warning" />
        <Kpi label="Vencidas" valor={kpis.vencidas} tone="destructive" />
        <Kpi label="Não lidas" valor={kpis.naoLidas} tone="info" />
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-3 md:flex-row md:items-center">
        <Tabs
          value={escopo}
          onValueChange={(v) => {
            const val = v as "minhas" | "geral";
            setEscopo(val);
            if (typeof window !== "undefined") localStorage.setItem("demandas:escopo", val);
          }}
        >
          <TabsList className="h-9 rounded-lg">
            <TabsTrigger value="minhas" className="rounded-md">
              Minhas
            </TabsTrigger>
            <TabsTrigger value="geral" className="rounded-md">
              Gerais
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por título, número, cliente ou responsável…"
            className="pl-9"
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label="Limpar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["todas", "aberta", "em_andamento", "aguardando", "concluida"] as const).map((s) => {
            const ativo = statusFiltro === s;
            const label = s === "todas" ? "Todas" : statusDemanda(s as DemandaStatus).label;
            return (
              <button
                key={s}
                onClick={() => setStatusFiltro(s)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition",
                  ativo
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/60 bg-background text-muted-foreground hover:bg-muted",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {isLoading && (
          <p className="rounded-lg border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
            Carregando…
          </p>
        )}
        {!isLoading && filtrados.length === 0 && (
          <p className="rounded-lg border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
            Nenhuma demanda encontrada.
          </p>
        )}
        {filtrados.map((d) => {
          const cfg = statusDemanda(d.status as DemandaStatus);
          return (
            <button
              key={d.id}
              onClick={() =>
                navigate({ to: "/operacional/demandas/$id", params: { id: d.id } })
              }
              className="group flex w-full items-start gap-3 rounded-xl border border-border/60 bg-card p-3.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <span className={cn("mt-1 h-full w-1 shrink-0 self-stretch rounded-full", TONE_BAR[cfg.tone])} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {d.numero ?? "DEM-—"}
                  </span>
                  <PriorityChip prioridade={d.prioridade} />
                  <Badge variant="outline" className="text-[10px]">
                    {cfg.label}
                  </Badge>
                  {d.nao_lidas > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                      <MessageCircle className="h-3 w-3" /> {d.nao_lidas}
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-sm font-semibold text-foreground">{d.titulo}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {d.nome_cliente && <span className="truncate">👤 {d.nome_cliente}</span>}
                  {d.numero_proposta && <span>📄 {d.numero_proposta}</span>}
                  {d.numero_simulacao && <span>🧮 {d.numero_simulacao}</span>}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <div className="flex items-center gap-1.5">
                  <OpAvatar nome={d.nome_responsavel} className="size-6 text-[10px]" />
                  <span className="max-w-[10rem] truncate text-xs text-muted-foreground">
                    {d.nome_responsavel ?? "—"}
                  </span>
                </div>
                <SlaChip prazo={d.prazo_sla} status={d.status as DemandaStatus} />
                {d.ultima_mensagem_em && (
                  <span className="text-[10px] text-muted-foreground/70">
                    últ. msg {fmtData(d.ultima_mensagem_em)}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Kpi({
  label,
  valor,
  tone,
}: {
  label: string;
  valor: number;
  tone: "primary" | "warning" | "destructive" | "info";
}) {
  const toneCls =
    tone === "primary"
      ? "text-primary"
      : tone === "warning"
        ? "text-warning"
        : tone === "destructive"
          ? "text-destructive"
          : "text-info";
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tabular-nums", toneCls)}>{valor}</p>
    </div>
  );
}
