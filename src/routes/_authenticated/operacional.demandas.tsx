import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  KanbanSquare,
  Search,
  Inbox,
  Loader2,
  CheckCircle2,
  Flame,
  Download,
  FilterX,
  MoreVertical,
  Calendar,
  ArrowUpRight,
  Minus,
  ArrowDownRight,
  Plus,
  List as ListIcon,
  Clock,
  CircleDot,
  MoreHorizontal,
} from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  listarDemandas,
  escalarDemanda,
  excluirDemanda,
} from "@/lib/operacional/demandas.functions";
import { NovaDemandaDialog } from "@/components/operacional/nova-demanda-dialog";
import { statusDemanda, type Prioridade } from "@/components/operacional/status";
import { OpAvatar } from "@/components/operacional/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

type Escopo = "minhas" | "todas";

function atrasada(d: { status: string; prazo_sla: string | null }): boolean {
  if (d.status === "concluida" || d.status === "cancelada" || !d.prazo_sla) return false;
  return new Date(d.prazo_sla).getTime() < Date.now();
}

/** Duração compacta: "1d 2h 16m", "3h 45m", "12m". */
function durCompacta(ms: number): string {
  const abs = Math.max(0, Math.abs(ms));
  const d = Math.floor(abs / 86_400_000);
  const h = Math.floor((abs % 86_400_000) / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  if (d > 0) return `${d}d ${h}h${h > 0 && m > 0 && d < 3 ? ` ${m}m` : ""}`.trim();
  if (h > 0) return `${h}h${m > 0 ? ` ${m}m` : ""}`;
  return `${Math.max(m, 1)}m`;
}

function diasAbertos(sla_inicio: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(sla_inicio).getTime()) / 86_400_000));
}

type CardStatusInfo = { texto: string; tone: "muted" | "danger" | "warning" | "success" };

function cardStatusInfo(d: {
  status: string;
  prazo_sla: string | null;
  sla_inicio: string;
  concluida_em: string | null;
}): CardStatusInfo {
  if (d.status === "concluida" && d.concluida_em) {
    const dt = new Date(d.concluida_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    return { texto: `Concluída em ${dt}`, tone: "success" };
  }
  if (d.status === "cancelada") {
    return { texto: "Cancelada", tone: "muted" };
  }
  if (d.prazo_sla) {
    const delta = new Date(d.prazo_sla).getTime() - Date.now();
    if (delta < 0) return { texto: `SLA vencido há ${durCompacta(delta)}`, tone: "danger" };
    if (delta <= 24 * 3_600_000) return { texto: `SLA vence em ${durCompacta(delta)}`, tone: "warning" };
    return { texto: `SLA vence em ${durCompacta(delta)}`, tone: "muted" };
  }
  const dias = diasAbertos(d.sla_inicio);
  const label =
    d.status === "aguardando"
      ? `Aguardando há ${dias === 0 ? "hoje" : `${dias} ${dias === 1 ? "dia" : "dias"}`}`
      : d.status === "em_andamento"
        ? `${dias} ${dias === 1 ? "dia" : "dias"} em aberto`
        : `Aberta há ${dias === 0 ? "hoje" : `${dias} ${dias === 1 ? "dia" : "dias"}`}`;
  return { texto: label, tone: "muted" };
}

const PRIORIDADE_MAP: Record<Prioridade, { label: string; cls: string; Icon: typeof ArrowUpRight }> = {
  p1: {
    label: "Alta",
    cls: "bg-destructive/10 text-destructive border-destructive/20",
    Icon: ArrowUpRight,
  },
  p2: {
    label: "Média",
    cls: "bg-warning/10 text-warning border-warning/20",
    Icon: Minus,
  },
  p3: {
    label: "Baixa",
    cls: "bg-success/10 text-success border-success/20",
    Icon: ArrowDownRight,
  },
};

const STATUS_DOT: Record<string, string> = {
  aberta: "bg-primary",
  em_andamento: "bg-warning",
  aguardando: "bg-primary",
  concluida: "bg-success",
  cancelada: "bg-muted-foreground",
};

function StatusPill({ status }: { status: string }) {
  const s = statusDemanda(status);
  const late = status !== "concluida" && status !== "cancelada";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
        s.tone === "success" && "bg-success/10 text-success border-success/20",
        s.tone === "warning" && "bg-warning/10 text-warning border-warning/20",
        s.tone === "danger" && "bg-destructive/10 text-destructive border-destructive/20",
        s.tone === "info" && "bg-primary/10 text-primary border-primary/20",
        s.tone === "muted" && "bg-muted text-muted-foreground border-border",
        !late && "opacity-90",
      )}
    >
      <span className={cn("size-1.5 rounded-full", STATUS_DOT[status] ?? "bg-muted-foreground")} />
      {s.label}
    </span>
  );
}

function PrioridadeBadge({ prioridade }: { prioridade: Prioridade }) {
  const p = PRIORIDADE_MAP[prioridade] ?? PRIORIDADE_MAP.p3;
  const Icon = p.Icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
        p.cls,
      )}
    >
      <Icon className="h-3 w-3" />
      {p.label}
    </span>
  );
}

/** Anel circular de SLA (%). */
function SlaRing({
  inicio,
  prazo,
  concluida,
}: {
  inicio: string;
  prazo: string | null;
  concluida?: boolean;
}) {
  if (!prazo) {
    return (
      <div className="flex items-center gap-2">
        <div className="grid size-9 shrink-0 place-items-center rounded-full border border-dashed border-border text-[10px] text-muted-foreground">
          —
        </div>
        <span className="text-[11px] text-muted-foreground">Sem SLA</span>
      </div>
    );
  }
  const ini = new Date(inicio).getTime();
  const fim = new Date(prazo).getTime();
  const total = Math.max(fim - ini, 1);
  const consumido = Math.min(Math.max((Date.now() - ini) / total, 0), 1);
  const pct = Math.round(consumido * 100);

  const cor =
    concluida
      ? "var(--success)"
      : consumido >= 1
        ? "var(--destructive)"
        : consumido >= 0.75
          ? "var(--warning)"
          : consumido >= 0.4
            ? "var(--warning)"
            : "var(--success)";

  const rot = 360 * consumido;
  const label = concluida
    ? "Concluída"
    : consumido >= 1
      ? "SLA vencido"
      : consumido >= 0.75
        ? "Vence em 24h"
        : "Dentro do prazo";

  return (
    <div className="flex items-center gap-2.5">
      <div
        className="grid size-9 shrink-0 place-items-center rounded-full text-[10px] font-semibold tabular-nums text-foreground"
        style={{
          background: `conic-gradient(${cor} ${rot}deg, color-mix(in oklab, ${cor} 12%, transparent) 0)`,
        }}
      >
        <span className="grid size-7 place-items-center rounded-full bg-card">{pct}%</span>
      </div>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}

function PrazoCell({
  prazo,
  status,
}: {
  prazo: string | null;
  status: string;
}) {
  if (!prazo)
    return <span className="text-xs text-muted-foreground">—</span>;
  const fim = new Date(prazo);
  const dias = Math.round((fim.getTime() - Date.now()) / (24 * 3600 * 1000));
  const concluida = status === "concluida" || status === "cancelada";
  const late = !concluida && dias < 0;
  const soon = !concluida && dias >= 0 && dias <= 2;

  const legenda = concluida
    ? "—"
    : late
      ? `${Math.abs(dias)} ${Math.abs(dias) === 1 ? "dia" : "dias"} em atraso`
      : dias === 0
        ? "Vence hoje"
        : dias === 1
          ? "Vence amanhã"
          : `${dias} dias restantes`;

  return (
    <div className="flex items-start gap-2">
      <Calendar
        className={cn(
          "mt-0.5 h-3.5 w-3.5 shrink-0",
          late ? "text-destructive" : soon ? "text-warning" : "text-muted-foreground",
        )}
      />
      <div className="min-w-0">
        <div className="text-xs font-medium tabular-nums text-foreground">
          {fim.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
        </div>
        <div
          className={cn(
            "text-[11px] tabular-nums",
            late ? "text-destructive font-medium" : soon ? "text-warning" : "text-muted-foreground",
          )}
        >
          {legenda}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card px-3 py-2.5 transition-colors hover:border-foreground/15">
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ backgroundColor: accent }}
      />
      <div className="flex items-center justify-between gap-2 pl-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </p>
        <span
          className="grid size-5 shrink-0 place-items-center rounded-full"
          style={{
            color: accent,
            backgroundColor: `color-mix(in oklab, ${accent} 10%, transparent)`,
          }}
        >
          {icon}
        </span>
      </div>
      <p className="mt-1 pl-2 text-xl font-semibold leading-tight tracking-tight text-foreground tabular-nums">
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 pl-2 text-[10.5px] leading-tight text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

function Pagina() {
  const [vista, setVista] = useState<"kanban" | "lista">("kanban");
  const [escopo, setEscopo] = useState<Escopo>("todas");
  const [q, setQ] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");
  const [prioridadeFiltro, setPrioridadeFiltro] = useState<string>("todas");
  const [responsavelFiltro, setResponsavelFiltro] = useState<string>("todos");
  const [clienteFiltro, setClienteFiltro] = useState<string>("todos");
  const [analistaFiltro, setAnalistaFiltro] = useState<string>("todos");
  const [corretorFiltro, setCorretorFiltro] = useState<string>("todos");
  const [imobiliariaFiltro, setImobiliariaFiltro] = useState<string>("todos");
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(10);

  const navigate = useNavigate();
  const escalarFn = useServerFn(escalarDemanda);
  const excluir = useServerFn(excluirDemanda);

  const escopoServidor: "minhas" | "equipe" = escopo === "minhas" ? "minhas" : "equipe";

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["demandas", escopoServidor, q],
    queryFn: () => listarDemandas({ data: { escopo: escopoServidor, q: q || undefined } }),
  });

  const todos = data ?? [];

  function opcoesUnicas(getId: (d: (typeof todos)[number]) => string | null, getNome: (d: (typeof todos)[number]) => string | null) {
    const m = new Map<string, string>();
    todos.forEach((d) => {
      const id = getId(d);
      const nome = getNome(d);
      if (id && nome && !m.has(id)) m.set(id, nome);
    });
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }
  const responsaveis = useMemo(() => opcoesUnicas((d) => d.responsavel_id, (d) => d.nome_responsavel), [todos]);
  const clientes = useMemo(() => opcoesUnicas((d) => d.cliente_id, (d) => d.nome_cliente), [todos]);
  const analistas = useMemo(() => opcoesUnicas((d) => d.analista_id, (d) => d.nome_analista), [todos]);
  const corretores = useMemo(() => opcoesUnicas((d) => d.corretor_id, (d) => d.nome_corretor), [todos]);
  const imobiliarias = useMemo(() => opcoesUnicas((d) => d.imobiliaria_id, (d) => d.nome_imobiliaria), [todos]);

  const filtrados = useMemo(() => {
    return todos.filter((d) => {
      if (statusFiltro !== "todos" && d.status !== statusFiltro) return false;
      if (prioridadeFiltro !== "todas" && d.prioridade !== prioridadeFiltro) return false;
      if (responsavelFiltro !== "todos" && d.responsavel_id !== responsavelFiltro) return false;
      if (clienteFiltro !== "todos" && d.cliente_id !== clienteFiltro) return false;
      if (analistaFiltro !== "todos" && d.analista_id !== analistaFiltro) return false;
      if (corretorFiltro !== "todos" && d.corretor_id !== corretorFiltro) return false;
      if (imobiliariaFiltro !== "todos" && d.imobiliaria_id !== imobiliariaFiltro) return false;
      return true;
    });
  }, [todos, statusFiltro, prioridadeFiltro, responsavelFiltro, clienteFiltro, analistaFiltro, corretorFiltro, imobiliariaFiltro]);

  const stats = useMemo(() => {
    const base = todos;
    const abertasList = base.filter(
      (d) => d.status !== "concluida" && d.status !== "cancelada",
    );
    const agora = Date.now();
    const em24h = agora + 24 * 3600_000;
    const vencendo = abertasList.filter(
      (d) => !atrasada(d) && d.prazo_sla && new Date(d.prazo_sla).getTime() <= em24h,
    ).length;
    const criticas = abertasList.filter((d) => d.prioridade === "p1").length;
    const atrasadas = base.filter(atrasada).length;
    const concluidas = base.filter((d) => d.status === "concluida").length;
    const emDia = base.length
      ? Math.round(((base.length - atrasadas) / base.length) * 100)
      : 100;
    const pctTotal = base.length
      ? Math.round((base.filter((d) => d.status === "em_andamento").length / base.length) * 100)
      : 0;
    return {
      total: base.length,
      abertas: abertasList.length,
      andamento: base.filter((d) => d.status === "em_andamento").length,
      pctTotal,
      vencendo,
      criticas,
      atrasadas,
      concluidas,
      slaEmDia: emDia,
    };
  }, [todos]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = (paginaAtual - 1) * porPagina;
  const pageItens = filtrados.slice(inicio, inicio + porPagina);
  const mostrandoDe = filtrados.length === 0 ? 0 : inicio + 1;
  const mostrandoAte = Math.min(inicio + porPagina, filtrados.length);

  async function verificarSla() {
    try {
      const r = await escalarFn({});
      toast.success(
        r.escalonadas > 0
          ? `${r.escalonadas} demanda(s) escalonada(s).`
          : "Nenhuma demanda vencida.",
      );
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao verificar SLA.");
    }
  }

  async function handleExcluir(id: string) {
    try {
      await excluir({ data: { id } });
      toast.success("Demanda excluída.");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível excluir a demanda.");
    }
  }

  function limparFiltros() {
    setQ("");
    setStatusFiltro("todos");
    setPrioridadeFiltro("todas");
    setResponsavelFiltro("todos");
    setClienteFiltro("todos");
    setAnalistaFiltro("todos");
    setCorretorFiltro("todos");
    setImobiliariaFiltro("todos");
    setPagina(1);
  }

  function exportarCsv() {
    const rows = [
      ["Nº", "Título", "Cliente", "Responsável", "Prioridade", "Status", "Prazo SLA"],
      ...filtrados.map((d) => [
        d.numero ?? "",
        d.titulo,
        d.nome_cliente ?? "",
        d.nome_responsavel ?? "",
        PRIORIDADE_MAP[d.prioridade]?.label ?? d.prioridade,
        statusDemanda(d.status).label,
        d.prazo_sla ? new Date(d.prazo_sla).toLocaleString("pt-BR") : "",
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `demandas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const KAN_COLS: { status: string; label: string; dot: string }[] = [
    { status: "aberta", label: "Aberta", dot: "bg-primary" },
    { status: "em_andamento", label: "Em andamento", dot: "bg-warning" },
    { status: "aguardando", label: "Aguardando retorno", dot: "bg-primary" },
    { status: "concluida", label: "Concluída", dot: "bg-success" },
  ];

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Cabeçalho compacto */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
            Demandas
          </h1>
          <span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
            {stats.total} demanda{stats.total === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={verificarSla} className="hidden md:inline-flex">
            <AlertTriangle className="mr-1.5 h-4 w-4" /> Verificar SLA
          </Button>
          <NovaDemandaDialog onCriada={refetch} />
        </div>
      </div>

      {/* Pill Minhas / Gerais + filtros + toggle vista */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full border border-border bg-card p-0.5 shadow-sm">
          {(["minhas", "todas"] as Escopo[]).map((e) => (
            <button
              key={e}
              onClick={() => { setEscopo(e); setPagina(1); }}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                escopo === e
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {e === "minhas" ? "Minhas" : "Gerais"}
            </button>
          ))}
        </div>

        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPagina(1); }}
            placeholder="Buscar demanda…"
            className="h-9 rounded-full pl-9"
          />
        </div>

        <div className="hidden flex-wrap items-center gap-2 md:flex">
          <MiniSelect
            value={responsavelFiltro}
            onValueChange={(v) => { setResponsavelFiltro(v); setPagina(1); }}
            placeholder="Responsável"
            options={[{ value: "todos", label: "Todos" }, ...responsaveis.map(([id, n]) => ({ value: id, label: n }))]}
          />
          <MiniSelect
            value={prioridadeFiltro}
            onValueChange={(v) => { setPrioridadeFiltro(v); setPagina(1); }}
            placeholder="Prioridade"
            options={[
              { value: "todas", label: "Todas" },
              { value: "p1", label: "Alta" },
              { value: "p2", label: "Média" },
              { value: "p3", label: "Baixa" },
            ]}
          />
          <MiniSelect
            value={clienteFiltro}
            onValueChange={(v) => { setClienteFiltro(v); setPagina(1); }}
            placeholder="Cliente"
            options={[{ value: "todos", label: "Todos" }, ...clientes.map(([id, n]) => ({ value: id, label: n }))]}
          />
          <MiniSelect
            value={statusFiltro}
            onValueChange={(v) => { setStatusFiltro(v); setPagina(1); }}
            placeholder="Status"
            options={[
              { value: "todos", label: "Todos" },
              { value: "aberta", label: "Aberta" },
              { value: "em_andamento", label: "Em andamento" },
              { value: "aguardando", label: "Aguardando" },
              { value: "concluida", label: "Concluída" },
              { value: "cancelada", label: "Cancelada" },
            ]}
          />
          <Button variant="ghost" size="sm" onClick={limparFiltros} className="text-muted-foreground">
            <FilterX className="mr-1.5 h-4 w-4" /> Limpar filtros
          </Button>
        </div>

        <div className="ml-auto inline-flex overflow-hidden rounded-full border border-border bg-card p-0.5 shadow-sm">
          <button
            onClick={() => setVista("kanban")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              vista === "kanban"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <KanbanSquare className="h-3.5 w-3.5" /> Kanban
          </button>
          <button
            onClick={() => setVista("lista")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              vista === "lista"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ListIcon className="h-3.5 w-3.5" /> Lista
          </button>
        </div>
      </div>

      {/* Faixa de KPIs (5) */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Total de demandas"
          value={stats.total}
          icon={<Inbox className="h-3.5 w-3.5" />}
          accent="var(--primary)"
        />
        <KpiCard
          label="Em andamento"
          value={stats.andamento}
          icon={<Loader2 className="h-3.5 w-3.5" />}
          accent="var(--warning)"
        />
        <KpiCard
          label="SLA crítico"
          value={stats.atrasadas}
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          accent="var(--destructive)"
        />
        <KpiCard
          label="Aguardando retorno"
          value={todos.filter((d) => d.status === "aguardando").length}
          icon={<Clock className="h-3.5 w-3.5" />}
          accent="var(--warning)"
        />
        <KpiCard
          label="Concluídas"
          value={stats.concluidas}
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          accent="var(--success)"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[420px] animate-pulse rounded-2xl bg-muted/40" />
          ))}
        </div>
      ) : vista === "kanban" ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {KAN_COLS.map((col) => {
            const itens = filtrados.filter((d) => d.status === col.status);
            return (
              <div
                key={col.status}
                className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card"
              >
                <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
                  <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <span className={cn("size-2 rounded-full", col.dot)} />
                    {col.label}
                    <span className="ml-1 text-xs font-medium text-muted-foreground tabular-nums">
                      {itens.length}
                    </span>
                  </span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
                <div className="brand-scroll flex-1 space-y-2.5 p-2.5">
                  {itens.length === 0 ? (
                    <div className="grid place-items-center rounded-xl border border-dashed border-border/60 px-3 py-8 text-center text-[11px] text-muted-foreground">
                      Sem demandas
                    </div>
                  ) : (
                    itens.slice(0, 20).map((d) => {
                      const info = cardStatusInfo(d);
                      const critico = info.tone === "danger";
                      return (
                        <button
                          key={d.id}
                          onClick={() =>
                            navigate({ to: "/operacional/demandas/$id", params: { id: d.id } })
                          }
                          className={cn(
                            "group block w-full rounded-xl border bg-background p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
                            critico
                              ? "border-destructive/40 ring-1 ring-destructive/25"
                              : "border-border hover:border-primary/40",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[10.5px] font-medium tracking-wide text-muted-foreground">
                              {d.numero ?? "—"}
                            </span>
                            <PrioridadeBadge prioridade={d.prioridade} />
                          </div>
                          <div className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                            {d.titulo}
                          </div>
                          {d.nome_cliente && (
                            <div className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                              {d.nome_cliente}
                            </div>
                          )}
                          {d.nome_responsavel && (
                            <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-foreground">
                              <OpAvatar nome={d.nome_responsavel} className="size-5 text-[9px]" />
                              <span className="line-clamp-1">{d.nome_responsavel}</span>
                            </div>
                          )}
                          <div className="mt-2 flex items-center gap-1.5 text-[11px]">
                            {info.tone === "danger" && (
                              <AlertTriangle className="h-3 w-3 shrink-0 text-destructive" />
                            )}
                            {info.tone === "warning" && (
                              <Clock className="h-3 w-3 shrink-0 text-warning" />
                            )}
                            {info.tone === "success" && (
                              <CheckCircle2 className="h-3 w-3 shrink-0 text-success" />
                            )}
                            {info.tone === "muted" && (
                              <CircleDot className="h-3 w-3 shrink-0 text-muted-foreground" />
                            )}
                            <span
                              className={cn(
                                "line-clamp-1",
                                info.tone === "danger" && "font-medium text-destructive",
                                info.tone === "warning" && "font-medium text-warning",
                                info.tone === "success" && "text-success",
                                info.tone === "muted" && "text-muted-foreground",
                              )}
                            >
                              {info.texto}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
                <button
                  onClick={() => {
                    // dispara o mesmo diálogo global — atalho por coluna
                    const btn = document.querySelector<HTMLButtonElement>(
                      "[data-nova-demanda-trigger]",
                    );
                    btn?.click();
                  }}
                  className="flex items-center justify-center gap-1.5 border-t border-border py-3 text-xs font-medium text-primary transition-colors hover:bg-primary/5"
                >
                  <Plus className="h-3.5 w-3.5" /> Criar demanda
                </button>
              </div>
            );
          })}
        </div>
      ) : pageItens.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-14 text-center shadow-card">
          <div className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
            <Inbox className="h-7 w-7" />
          </div>
          <p className="text-sm font-medium text-foreground">Nenhuma demanda encontrada</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Ajuste os filtros ou crie uma nova demanda para começar.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          <div className="hidden overflow-x-auto xl:block">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">ID</th>
                  <th className="px-3 py-3">Título</th>
                  <th className="px-3 py-3">Cliente</th>
                  <th className="px-3 py-3">Responsável</th>
                  <th className="px-3 py-3">Prioridade</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">SLA</th>
                  <th className="px-3 py-3">Prazo</th>
                  <th className="px-3 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pageItens.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() =>
                      navigate({ to: "/operacional/demandas/$id", params: { id: d.id } })
                    }
                    className="cursor-pointer transition-colors hover:bg-accent/40"
                  >
                    <td className="px-5 py-3 align-middle">
                      <span className="inline-flex items-center rounded-md border border-border bg-muted/50 px-2 py-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                        {d.numero ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <div className="min-w-0">
                        <div className="line-clamp-1 font-medium text-foreground">{d.titulo}</div>
                        <div className="line-clamp-1 text-[11px] text-muted-foreground">
                          {d.tipo ? d.tipo.replace(/_/g, " ") : "—"}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-middle">
                      {d.nome_cliente ? (
                        <div className="flex items-center gap-2">
                          <OpAvatar nome={d.nome_cliente} />
                          <div className="line-clamp-1 text-foreground">{d.nome_cliente}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 align-middle">
                      {d.nome_responsavel ? (
                        <div className="flex items-center gap-2">
                          <OpAvatar nome={d.nome_responsavel} />
                          <div className="line-clamp-1 text-foreground">{d.nome_responsavel}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <PrioridadeBadge prioridade={d.prioridade} />
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <StatusPill status={d.status} />
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <SlaRing
                        inicio={d.sla_inicio}
                        prazo={d.prazo_sla}
                        concluida={d.status === "concluida"}
                      />
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <PrazoCell prazo={d.prazo_sla} status={d.status} />
                    </td>
                    <td className="px-3 py-3 text-right align-middle" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              navigate({ to: "/operacional/demandas/$id", params: { id: d.id } })
                            }
                          >
                            Abrir detalhes
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleExcluir(d.id)}
                          >
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile / tablet */}
          <ul className="divide-y divide-border xl:hidden">
            {pageItens.map((d) => (
              <li key={d.id} className="relative">
                <Link
                  to="/operacional/demandas/$id"
                  params={{ id: d.id }}
                  className="flex flex-col gap-3 p-4 transition-colors hover:bg-accent/40 active:bg-accent/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                          {d.numero ?? "—"}
                        </span>
                        <PrioridadeBadge prioridade={d.prioridade} />
                      </div>
                      <div className="mt-1.5 line-clamp-2 text-sm font-medium text-foreground">
                        {d.titulo}
                      </div>
                    </div>
                    <StatusPill status={d.status} />
                  </div>
                  {d.nome_cliente && (
                    <div className="text-[11px] text-muted-foreground">{d.nome_cliente}</div>
                  )}
                </Link>
              </li>
            ))}
          </ul>

          {/* Paginação */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 text-xs text-muted-foreground">
            <span>
              Mostrando {mostrandoDe} a {mostrandoAte} de {filtrados.length} demandas
            </span>
            <div className="flex items-center gap-3">
              <Paginacao pagina={paginaAtual} total={totalPaginas} onChange={setPagina} />
              <Select
                value={String(porPagina)}
                onValueChange={(v) => { setPorPagina(Number(v)); setPagina(1); }}
              >
                <SelectTrigger className="h-8 w-[130px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[5, 10, 20, 50].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} por página
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={exportarCsv} className="gap-1.5">
                <Download className="h-4 w-4" /> Exportar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniSelect({
  value,
  onValueChange,
  placeholder,
  options,
}: {
  value: string;
  onValueChange: (v: string) => void;
  placeholder?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-9 min-w-[130px] rounded-full border-border bg-card text-xs">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-xs">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onValueChange,
  placeholder,
  options,
}: {
  label: string;
  value: string;
  onValueChange: (v: string) => void;
  placeholder?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <FilterField label={label}>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterField>
  );
}

function Paginacao({
  pagina,
  total,
  onChange,
}: {
  pagina: number;
  total: number;
  onChange: (p: number) => void;
}) {
  const paginas: (number | "…")[] = [];
  if (total <= 7) {
    for (let i = 1; i <= total; i++) paginas.push(i);
  } else {
    paginas.push(1);
    if (pagina > 3) paginas.push("…");
    for (let i = Math.max(2, pagina - 1); i <= Math.min(total - 1, pagina + 1); i++)
      paginas.push(i);
    if (pagina < total - 2) paginas.push("…");
    paginas.push(total);
  }
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon"
        className="h-7 w-7"
        disabled={pagina <= 1}
        onClick={() => onChange(pagina - 1)}
      >
        ‹
      </Button>
      {paginas.map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} className="px-1 text-muted-foreground">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={cn(
              "h-7 min-w-7 rounded-md px-2 text-xs font-medium tabular-nums transition-colors",
              p === pagina
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {p}
          </button>
        ),
      )}
      <Button
        variant="outline"
        size="icon"
        className="h-7 w-7"
        disabled={pagina >= total}
        onClick={() => onChange(pagina + 1)}
      >
        ›
      </Button>
    </div>
  );
}
