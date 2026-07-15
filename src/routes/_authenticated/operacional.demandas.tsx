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
} from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  listarDemandas,
  escalarDemanda,
  excluirDemanda,
} from "@/lib/operacional/demandas.functions";
import { listarColegas, buscarClientesOpcoes } from "@/lib/operacional/shared.functions";
import { listarParceiros } from "@/lib/crm/parceiros.functions";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
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
  const [escopo, setEscopo] = useState<Escopo>("minhas");
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

  return (
    <div className="space-y-5 p-4 md:p-6">
      {/* Hero */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-card sm:flex sm:flex-wrap sm:items-center sm:justify-between md:p-6">
        <div className="flex min-w-0 items-center gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Inbox className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
              Demandas
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Solicitações formais entre equipes, com SLA e escalonamento.
            </p>
          </div>
        </div>
        <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-auto">
          <Button variant="outline" size="sm" onClick={verificarSla}>
            <AlertTriangle className="mr-1.5 h-4 w-4" /> Verificar SLA
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/operacional/demandas/kanban">
              <KanbanSquare className="mr-1.5 h-4 w-4" /> Kanban
            </Link>
          </Button>
          <NovaDemandaDialog onCriada={refetch} />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Total"
          value={stats.total}
          hint={`${stats.abertas} em aberto`}
          icon={<Inbox className="h-4 w-4" />}
          accent="var(--primary)"
        />
        <KpiCard
          label="Em andamento"
          value={stats.andamento}
          hint={`${stats.pctTotal}% do total`}
          icon={<Loader2 className="h-4 w-4" />}
          accent="var(--warning)"
        />
        <KpiCard
          label="Vencendo em 24h"
          value={stats.vencendo}
          hint="Prazo próximo"
          icon={<AlertTriangle className="h-4 w-4" />}
          accent="var(--destructive)"
        />
        <KpiCard
          label="Alta prioridade"
          value={stats.criticas}
          hint="Requer atenção"
          icon={<Flame className="h-4 w-4" />}
          accent="var(--destructive)"
        />
        <KpiCard
          label="Atrasadas"
          value={stats.atrasadas}
          hint="SLA vencido"
          icon={<AlertTriangle className="h-4 w-4" />}
          accent="var(--destructive)"
        />
        <KpiCard
          label="SLA em dia"
          value={`${stats.slaEmDia}%`}
          hint={`${stats.concluidas} concluídas`}
          icon={<CheckCircle2 className="h-4 w-4" />}
          accent="var(--success)"
        />
      </div>

      {/* Filtros */}
      <div className="rounded-2xl border border-border bg-card p-3 shadow-card md:p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPagina(1);
                }}
                placeholder="Buscar por título, cliente, responsável ou ID…"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={limparFiltros}>
                <FilterX className="mr-1.5 h-4 w-4" /> Limpar
              </Button>
              <Button size="sm" onClick={exportarCsv} className="gap-1.5">
                <Download className="h-4 w-4" /> Exportar
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <FilterSelect
              label="Status"
              value={statusFiltro}
              onValueChange={(v) => { setStatusFiltro(v); setPagina(1); }}
              placeholder="Todos"
              options={[
                { value: "todos", label: "Todos" },
                { value: "aberta", label: "Aberta" },
                { value: "em_andamento", label: "Em andamento" },
                { value: "aguardando", label: "Aguardando" },
                { value: "concluida", label: "Concluída" },
                { value: "cancelada", label: "Cancelada" },
              ]}
            />
            <FilterSelect
              label="Prioridade"
              value={prioridadeFiltro}
              onValueChange={(v) => { setPrioridadeFiltro(v); setPagina(1); }}
              placeholder="Todas"
              options={[
                { value: "todas", label: "Todas" },
                { value: "p1", label: "Alta" },
                { value: "p2", label: "Média" },
                { value: "p3", label: "Baixa" },
              ]}
            />
            <FilterSelect
              label="Cliente"
              value={clienteFiltro}
              onValueChange={(v) => { setClienteFiltro(v); setPagina(1); }}
              placeholder="Todos"
              options={[{ value: "todos", label: "Todos" }, ...clientes.map(([id, n]) => ({ value: id, label: n }))]}
            />
            <FilterSelect
              label="Responsável"
              value={responsavelFiltro}
              onValueChange={(v) => { setResponsavelFiltro(v); setPagina(1); }}
              placeholder="Todos"
              options={[{ value: "todos", label: "Todos" }, ...responsaveis.map(([id, n]) => ({ value: id, label: n }))]}
            />
            <FilterSelect
              label="Analista"
              value={analistaFiltro}
              onValueChange={(v) => { setAnalistaFiltro(v); setPagina(1); }}
              placeholder="Todos"
              options={[{ value: "todos", label: "Todos" }, ...analistas.map(([id, n]) => ({ value: id, label: n }))]}
            />
            <FilterSelect
              label="Corretor"
              value={corretorFiltro}
              onValueChange={(v) => { setCorretorFiltro(v); setPagina(1); }}
              placeholder="Todos"
              options={[{ value: "todos", label: "Todos" }, ...corretores.map(([id, n]) => ({ value: id, label: n }))]}
            />
            <FilterSelect
              label="Imobiliária"
              value={imobiliariaFiltro}
              onValueChange={(v) => { setImobiliariaFiltro(v); setPagina(1); }}
              placeholder="Todas"
              options={[{ value: "todos", label: "Todas" }, ...imobiliarias.map(([id, n]) => ({ value: id, label: n }))]}
            />
          </div>
        </div>
      </div>

      {/* Abas + Tabela */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="flex items-center gap-6 border-b border-border px-5 pt-3">
          {(["minhas", "todas"] as Escopo[]).map((e) => (
            <button
              key={e}
              onClick={() => {
                setEscopo(e);
                setPagina(1);
              }}
              className={cn(
                "-mb-px border-b-2 pb-3 pt-1 text-sm font-medium transition-colors",
                escopo === e
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {e === "minhas" ? "Minhas demandas" : "Todas"}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/60" />
            ))}
          </div>
        ) : pageItens.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-14 text-center">
            <div className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
              <Inbox className="h-7 w-7" />
            </div>
            <p className="text-sm font-medium text-foreground">Nenhuma demanda encontrada</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Ajuste os filtros ou crie uma nova demanda para começar.
            </p>
          </div>
        ) : (
          <>
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
                          <div className="line-clamp-1 font-medium text-foreground">
                            {d.titulo}
                          </div>
                          <div className="line-clamp-1 text-[11px] text-muted-foreground">
                            {d.tipo ? d.tipo.replace(/_/g, " ") : "—"}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-middle">
                        {d.nome_cliente ? (
                          <div className="flex items-center gap-2">
                            <OpAvatar nome={d.nome_cliente} />
                            <div className="min-w-0">
                              <div className="line-clamp-1 text-foreground">{d.nome_cliente}</div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 align-middle">
                        {d.nome_responsavel ? (
                          <div className="flex items-center gap-2">
                            <OpAvatar nome={d.nome_responsavel} />
                            <div className="min-w-0">
                              <div className="line-clamp-1 text-foreground">
                                {d.nome_responsavel}
                              </div>
                            </div>
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
                      <td
                        className="px-3 py-3 text-right align-middle"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                navigate({
                                  to: "/operacional/demandas/$id",
                                  params: { id: d.id },
                                })
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

            {/* Mobile */}
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
                        {d.tipo && (
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            {d.tipo.replace(/_/g, " ")}
                          </div>
                        )}
                      </div>
                      <StatusPill status={d.status} />
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {d.nome_cliente && (
                        <div className="flex min-w-0 items-center gap-2">
                          <OpAvatar nome={d.nome_cliente} />
                          <div className="min-w-0">
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              Cliente
                            </div>
                            <div className="line-clamp-1 text-xs text-foreground">
                              {d.nome_cliente}
                            </div>
                          </div>
                        </div>
                      )}
                      {d.nome_responsavel && (
                        <div className="flex min-w-0 items-center gap-2">
                          <OpAvatar nome={d.nome_responsavel} />
                          <div className="min-w-0">
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              Responsável
                            </div>
                            <div className="line-clamp-1 text-xs text-foreground">
                              {d.nome_responsavel}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-2.5">
                      <SlaRing
                        inicio={d.sla_inicio}
                        prazo={d.prazo_sla}
                        concluida={d.status === "concluida"}
                      />
                      <PrazoCell prazo={d.prazo_sla} status={d.status} />
                    </div>
                  </Link>
                  <div className="absolute right-2 top-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            navigate({
                              to: "/operacional/demandas/$id",
                              params: { id: d.id },
                            })
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
                  </div>
                </li>
              ))}
            </ul>

            {/* Paginação */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 text-xs text-muted-foreground">
              <span>
                Mostrando {mostrandoDe} a {mostrandoAte} de {filtrados.length} demandas
              </span>
              <div className="flex items-center gap-3">
                <Paginacao
                  pagina={paginaAtual}
                  total={totalPaginas}
                  onChange={setPagina}
                />
                <Select
                  value={String(porPagina)}
                  onValueChange={(v) => {
                    setPorPagina(Number(v));
                    setPagina(1);
                  }}
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
              </div>
            </div>
          </>
        )}
      </div>
    </div>
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
