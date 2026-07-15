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
  Users,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [tipoFiltro, setTipoFiltro] = useState<string>("todos");

  const { data: itens, isLoading, refetch } = useQuery({
    queryKey: ["demandas", "lista", escopo],
    queryFn: () => listarDemandas({ data: { escopo } }),
  });

  // Tipos de usuário únicos entre responsáveis (para filtro).
  const tiposDisponiveis = useMemo(() => {
    const set = new Set<string>();
    (itens ?? []).forEach((d) => {
      if (d.tipo_responsavel) set.add(d.tipo_responsavel);
    });
    return [...set].sort();
  }, [itens]);

  const filtrados = useMemo(() => {
    const arr = itens ?? [];
    const termo = q.trim().toLowerCase();
    return arr.filter((d) => {
      if (statusFiltro !== "todas" && d.status !== statusFiltro) return false;
      if (tipoFiltro !== "todos" && d.tipo_responsavel !== tipoFiltro) return false;
      if (!termo) return true;
      return (
        d.titulo.toLowerCase().includes(termo) ||
        (d.numero ?? "").toLowerCase().includes(termo) ||
        (d.nome_cliente ?? "").toLowerCase().includes(termo) ||
        (d.nome_responsavel ?? "").toLowerCase().includes(termo)
      );
    });
  }, [itens, q, statusFiltro, tipoFiltro]);

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
    <div className="space-y-4 p-4 md:p-6">
      {/* Header — refinado, uma única linha */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/60 pb-4">
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-primary/70">
            Operacional
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-foreground">
            Demandas
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Envie tarefas para colegas e converse em tempo real.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/operacional/demandas/kanban">
              <Kanban className="mr-1.5 h-4 w-4" /> Kanban
            </Link>
          </Button>
          <NovaDemandaDialog onCriada={() => refetch()} />
        </div>
      </div>

      {/* KPIs — inline, discretos */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Kpi label="Ativas" valor={kpis.abertas} tone="primary" />
        <Kpi label="Aguardando" valor={kpis.aguardando} tone="warning" />
        <Kpi label="Vencidas" valor={kpis.vencidas} tone="destructive" />
        <Kpi label="Não lidas" valor={kpis.naoLidas} tone="info" />
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-2.5 rounded-xl border border-border/60 bg-card/70 p-2.5 backdrop-blur md:flex-row md:items-center">
        <Tabs
          value={escopo}
          onValueChange={(v) => {
            const val = v as "minhas" | "geral";
            setEscopo(val);
            if (typeof window !== "undefined") localStorage.setItem("demandas:escopo", val);
          }}
        >
          <TabsList className="h-8 rounded-md">
            <TabsTrigger value="minhas" className="rounded-sm text-xs">
              Minhas
            </TabsTrigger>
            <TabsTrigger value="geral" className="rounded-sm text-xs">
              Gerais
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por título, número, cliente ou responsável…"
            className="h-9 pl-9 text-sm"
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

        {tiposDisponiveis.length > 0 && (
          <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
            <SelectTrigger className="h-9 w-full text-xs md:w-[190px]">
              <Users className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue placeholder="Tipo de usuário" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {tiposDisponiveis.map((t) => (
                <SelectItem key={t} value={t}>
                  {tipoLabel(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex flex-wrap gap-1">
          {(["todas", "aberta", "em_andamento", "aguardando", "concluida"] as const).map((s) => {
            const ativo = statusFiltro === s;
            const label = s === "todas" ? "Todas" : statusDemanda(s as DemandaStatus).label;
            return (
              <button
                key={s}
                onClick={() => setStatusFiltro(s)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-[11px] font-medium transition",
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
      <div className="space-y-1.5">
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
              <span className={cn("mt-0.5 h-full w-0.5 shrink-0 self-stretch rounded-full", TONE_BAR[cfg.tone])} />
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
                  <div className="max-w-[10rem] truncate text-right">
                    <p className="truncate text-xs font-medium text-foreground">
                      {d.nome_responsavel ?? "—"}
                    </p>
                    {d.tipo_responsavel && (
                      <p className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                        {tipoLabel(d.tipo_responsavel)}
                      </p>
                    )}
                  </div>
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

function tipoLabel(slug: string): string {
  if (!slug) return "—";
  return slug
    .split(/[-_\s]+/)
    .map((s) => (s ? s[0].toUpperCase() + s.slice(1) : s))
    .join(" ");
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
    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3.5 py-2.5">
      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={cn("text-lg font-semibold tabular-nums", toneCls)}>{valor}</p>
    </div>
  );
}
