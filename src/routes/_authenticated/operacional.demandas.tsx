import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
  Inbox,
  Hourglass,
  Flame,
  Bell,
  ChevronRight,
  Download,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { baixarDemandasPDF } from "@/lib/operacional/export-pdf";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  listarDemandas,
  excluirDemanda,
  type DemandaStatus,
} from "@/lib/operacional/demandas.functions";
import { getMinhaSessao } from "@/lib/session.functions";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10.5px] font-medium text-success">
        <CheckCircle2 className="h-3 w-3" /> Concluída
      </span>
    );
  if (status === "cancelada")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10.5px] text-muted-foreground">
        Cancelada
      </span>
    );
  if (!prazo)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10.5px] text-muted-foreground">
        <Clock className="h-3 w-3" /> Sem prazo
      </span>
    );
  const restante = new Date(prazo).getTime() - Date.now();
  if (restante < 0)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10.5px] font-semibold text-destructive">
        <AlertTriangle className="h-3 w-3" /> SLA vencido
      </span>
    );
  if (restante < 24 * 3600_000)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[10.5px] font-medium text-warning">
        <Clock className="h-3 w-3" /> &lt; 24h
      </span>
    );
  const dias = Math.ceil(restante / 86_400_000);
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10.5px] text-muted-foreground">
      <Clock className="h-3 w-3" /> {dias}d
    </span>
  );
}

function Pagina() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const excluirFn = useServerFn(excluirDemanda);
  const sessaoFn = useServerFn(getMinhaSessao);
  const [escopo, setEscopo] = useState<"minhas" | "geral">(
    () =>
      (typeof window !== "undefined" &&
        (localStorage.getItem("demandas:escopo") as "minhas" | "geral")) ||
      "geral",
  );
  const [q, setQ] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<DemandaStatus | "todas">("todas");
  const [tipoFiltro, setTipoFiltro] = useState<string>("todos");
  const [excluirId, setExcluirId] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const { data: sessao } = useQuery({
    queryKey: ["minha-sessao"],
    queryFn: () => sessaoFn(),
    staleTime: 5 * 60_000,
  });
  const meuId = sessao?.profile?.id ?? null;

  const { data: itens, isLoading, refetch } = useQuery({
    queryKey: ["demandas", "lista", escopo],
    queryFn: () => listarDemandas({ data: { escopo } }),
  });

  async function confirmarExclusao() {
    if (!excluirId) return;
    setExcluindo(true);
    try {
      await excluirFn({ data: { id: excluirId } });
      toast.success("Demanda excluída.");
      queryClient.invalidateQueries({ queryKey: ["demandas"] });
      setExcluirId(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível excluir a demanda.");
    } finally {
      setExcluindo(false);
    }
  }


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
    <div className="space-y-5 p-4 md:p-6">
      {/* Hero */}
      <div className="op-hero grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-5 md:p-6">
        <div className="min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/80">
            Operacional
          </span>
          <h1 className="mt-0.5 truncate text-2xl font-bold tracking-tight text-foreground md:text-[26px]">
            Demandas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Distribua tarefas, acompanhe SLAs e converse com o time em tempo real.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild variant="outline" size="sm" className="bg-card/60 backdrop-blur">
            <Link to="/operacional/demandas/kanban">
              <Kanban className="mr-1.5 h-4 w-4" /> Kanban
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="bg-card/60 backdrop-blur"
            disabled={(filtrados?.length ?? 0) === 0}
            onClick={() => {
              try {
                baixarDemandasPDF({
                  demandas: filtrados,
                  escopo: escopo === "minhas" ? "Minhas demandas" : "Demandas gerais",
                });
                toast.success("PDF gerado com sucesso.");
              } catch {
                toast.error("Não foi possível gerar o PDF.");
              }
            }}
          >
            <Download className="mr-1.5 h-4 w-4" /> Baixar PDF
          </Button>
          <NovaDemandaDialog onCriada={() => refetch()} />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Ativas" valor={kpis.abertas} tone="primary" icon={Inbox} />
        <Kpi label="Aguardando" valor={kpis.aguardando} tone="warning" icon={Hourglass} />
        <Kpi label="Vencidas" valor={kpis.vencidas} tone="destructive" icon={Flame} />
        <Kpi label="Não lidas" valor={kpis.naoLidas} tone="info" icon={Bell} />
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/80 p-3 shadow-sm backdrop-blur md:flex-row md:items-center">
        <Tabs
          value={escopo}
          onValueChange={(v) => {
            const val = v as "minhas" | "geral";
            setEscopo(val);
            if (typeof window !== "undefined") localStorage.setItem("demandas:escopo", val);
          }}
        >
          <TabsList className="h-9 rounded-lg">
            <TabsTrigger value="minhas" className="rounded-md text-xs">
              Minhas
            </TabsTrigger>
            <TabsTrigger value="geral" className="rounded-md text-xs">
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
            className="h-9 rounded-lg pl-9 text-sm"
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
            <SelectTrigger className="h-9 w-full rounded-lg text-xs md:w-[200px]">
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

        <div className="flex flex-wrap gap-1.5">
          {(["todas", "aberta", "em_andamento", "aguardando", "concluida"] as const).map((s) => {
            const ativo = statusFiltro === s;
            const label = s === "todas" ? "Todas" : statusDemanda(s as DemandaStatus).label;
            return (
              <button
                key={s}
                onClick={() => setStatusFiltro(s)}
                className={cn(
                  "rounded-full border px-3 py-1 text-[11px] font-medium transition-all",
                  ativo
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border/60 bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground",
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
          <p className="rounded-2xl border border-dashed border-border/60 bg-card p-10 text-center text-sm text-muted-foreground">
            Carregando demandas…
          </p>
        )}
        {!isLoading && filtrados.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/60 bg-card p-10 text-center">
            <Inbox className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium text-foreground">Nenhuma demanda encontrada</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ajuste os filtros ou crie uma nova demanda.
            </p>
          </div>
        )}
        {filtrados.map((d) => {
          const cfg = statusDemanda(d.status as DemandaStatus);
          const souCriador = Boolean(meuId && d.criador_id === meuId);
          const abrir = () =>
            navigate({ to: "/operacional/demandas/$id", params: { id: d.id } });
          return (
            <div
              key={d.id}
              role="button"
              tabIndex={0}
              onClick={abrir}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  abrir();
                }
              }}
              className="group relative flex w-full cursor-pointer items-start gap-3 overflow-hidden rounded-2xl border border-border/60 bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <span
                className={cn(
                  "absolute inset-y-0 left-0 w-1 rounded-r-full",
                  TONE_BAR[cfg.tone],
                )}
              />
              <div className="min-w-0 flex-1 pl-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {d.numero ?? "DEM-—"}
                  </span>
                  <PriorityChip prioridade={d.prioridade} />
                  <Badge
                    variant="outline"
                    className="border-border/70 bg-muted/40 text-[10px] font-medium"
                  >
                    {cfg.label}
                  </Badge>
                  {d.nao_lidas > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground shadow-sm">
                      <MessageCircle className="h-3 w-3" /> {d.nao_lidas}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 truncate text-sm font-semibold text-foreground">
                  {d.titulo}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {d.nome_cliente && <span className="truncate">👤 {d.nome_cliente}</span>}
                  {d.numero_proposta && <span>📄 {d.numero_proposta}</span>}
                  {d.numero_simulacao && <span>🧮 {d.numero_simulacao}</span>}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <div className="flex items-center gap-2">
                  <div className="max-w-[10rem] truncate text-right">
                    <p className="truncate text-xs font-semibold text-foreground">
                      {d.nome_responsavel ?? "—"}
                    </p>
                    {d.tipo_responsavel && (
                      <p className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                        {tipoLabel(d.tipo_responsavel)}
                      </p>
                    )}
                  </div>
                  <OpAvatar nome={d.nome_responsavel} className="size-7 text-[10px]" />
                </div>
                <SlaChip prazo={d.prazo_sla} status={d.status as DemandaStatus} />
                {d.ultima_mensagem_em && (
                  <span className="text-[10px] text-muted-foreground/70">
                    últ. msg {fmtData(d.ultima_mensagem_em)}
                  </span>
                )}
              </div>
              {souCriador && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExcluirId(d.id);
                  }}
                  aria-label="Excluir demanda"
                  title="Excluir demanda"
                  className="absolute right-2 top-2 grid size-7 place-items-center rounded-lg text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive focus:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <ChevronRight className="mt-1 hidden h-4 w-4 shrink-0 text-muted-foreground/40 transition group-hover:text-primary md:block" />
            </div>
          );
        })}
      </div>

      <AlertDialog
        open={excluirId !== null}
        onOpenChange={(o) => !o && !excluindo && setExcluirId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir demanda?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Toda a conversa, anexos e histórico
              serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={excluindo}
              onClick={(e) => {
                e.preventDefault();
                void confirmarExclusao();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {excluindo ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
  icon: Icon,
}: {
  label: string;
  valor: number;
  tone: "primary" | "warning" | "destructive" | "info";
  icon: React.ComponentType<{ className?: string }>;
}) {
  const toneMap = {
    primary: {
      text: "text-primary",
      bg: "bg-primary/10",
      border: "border-primary/20",
    },
    warning: {
      text: "text-warning",
      bg: "bg-warning/10",
      border: "border-warning/20",
    },
    destructive: {
      text: "text-destructive",
      bg: "bg-destructive/10",
      border: "border-destructive/20",
    },
    info: {
      text: "text-info",
      bg: "bg-info/10",
      border: "border-info/20",
    },
  } as const;
  const t = toneMap[tone];
  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 overflow-hidden rounded-2xl border bg-card px-4 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
        t.border,
      )}
    >
      <div
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-xl",
          t.bg,
          t.text,
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className={cn("text-2xl font-bold tabular-nums leading-none mt-1", t.text)}>
          {valor}
        </p>
      </div>
    </div>
  );
}
