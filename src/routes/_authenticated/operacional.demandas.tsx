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
  ArrowUpRight,
} from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  listarDemandas,
  escalarDemanda,
  excluirDemanda,
} from "@/lib/operacional/demandas.functions";
import { NovaDemandaDialog } from "@/components/operacional/nova-demanda-dialog";
import { SlaCountdown } from "@/components/operacional/sla-countdown";
import { ToneBadge } from "@/components/crm/tone-badge";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { PRIORIDADE, statusDemanda } from "@/components/operacional/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/operacional/demandas")({
  head: () => ({ meta: [{ title: "Demandas — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.demandas"),
  component: Pagina,
});

function iniciais(nome?: string | null): string {
  if (!nome) return "—";
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

function atrasada(d: any): boolean {
  if (d.status === "concluida" || d.status === "cancelada" || !d.prazo_sla) return false;
  return new Date(d.prazo_sla).getTime() < Date.now();
}

function Pagina() {
  const [escopo, setEscopo] = useState<"minhas" | "equipe">("equipe");
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const escalarFn = useServerFn(escalarDemanda);
  const excluir = useServerFn(excluirDemanda);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["demandas", escopo, q],
    queryFn: () => listarDemandas({ data: { escopo, q: q || undefined } }),
  });

  const itens = data ?? [];

  const stats = useMemo(() => {
    return {
      total: itens.length,
      andamento: itens.filter((d: any) => d.status === "em_andamento").length,
      atrasadas: itens.filter(atrasada).length,
      concluidas: itens.filter((d: any) => d.status === "concluida").length,
    };
  }, [itens]);

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

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Demandas</h1>
          <p className="text-sm text-muted-foreground">
            Solicitações formais entre equipes, com SLA e escalonamento.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total"
          value={stats.total}
          icon={<Inbox className="h-4 w-4" />}
          tint="text-primary bg-primary/10"
        />
        <StatCard
          label="Em andamento"
          value={stats.andamento}
          icon={<Loader2 className="h-4 w-4" />}
          tint="text-sky-600 bg-sky-500/10 dark:text-sky-400"
        />
        <StatCard
          label="Atrasadas"
          value={stats.atrasadas}
          icon={<Flame className="h-4 w-4" />}
          tint="text-destructive bg-destructive/10"
          alerta={stats.atrasadas > 0}
        />
        <StatCard
          label="Concluídas"
          value={stats.concluidas}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tint="text-emerald-600 bg-emerald-500/10 dark:text-emerald-400"
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={escopo} onValueChange={(v) => setEscopo(v as any)}>
          <TabsList>
            <TabsTrigger value="minhas">Minhas</TabsTrigger>
            <TabsTrigger value="equipe">Equipe</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por título…"
            className="pl-9"
          />
        </div>
      </div>

      {/* Lista */}
      <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/60" />
            ))}
          </div>
        ) : itens.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-14 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Inbox className="h-7 w-7" />
            </div>
            <p className="text-sm font-medium text-foreground">Nenhuma demanda encontrada</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Crie uma nova demanda para registrar uma solicitação entre equipes.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border/70 bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Nº</th>
                <th className="px-4 py-3">Título</th>
                <th className="hidden px-4 py-3 md:table-cell">Cliente</th>
                <th className="hidden px-4 py-3 lg:table-cell">Responsável</th>
                <th className="px-4 py-3">SLA</th>
                <th className="hidden px-4 py-3 sm:table-cell">Prioridade</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {itens.map((d) => {
                const p = PRIORIDADE[d.prioridade];
                const late = atrasada(d);
                return (
                  <tr
                    key={d.id}
                    onClick={() =>
                      navigate({ to: "/operacional/demandas/$id", params: { id: d.id } })
                    }
                    className={cn(
                      "group cursor-pointer transition-colors hover:bg-accent/40",
                      late && "bg-destructive/[0.04]",
                    )}
                  >
                    <td className="px-4 py-3 align-middle">
                      <Link
                        to="/operacional/demandas/$id"
                        params={{ id: d.id }}
                        className="tabular-nums text-muted-foreground hover:text-foreground"
                      >
                        {d.numero}
                      </Link>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <Link
                        to="/operacional/demandas/$id"
                        params={{ id: d.id }}
                        className="flex items-center gap-1.5 font-medium text-foreground hover:text-primary"
                      >
                        <span className="line-clamp-1">{d.titulo}</span>
                        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 align-middle text-muted-foreground md:table-cell">
                      {d.nome_cliente ?? "—"}
                    </td>
                    <td className="hidden px-4 py-3 align-middle lg:table-cell">
                      <div className="flex items-center gap-2">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-primary/50 text-[10px] font-semibold text-primary-foreground">
                          {iniciais(d.nome_responsavel)}
                        </span>
                        <span className="truncate text-muted-foreground">
                          {d.nome_responsavel ?? "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <SlaCountdown
                        inicio={d.sla_inicio}
                        prazo={d.prazo_sla}
                        concluida={d.status === "concluida"}
                        concluidaEm={d.concluida_em}
                      />
                    </td>
                    <td className="hidden px-4 py-3 align-middle sm:table-cell">
                      <span className="inline-flex items-center gap-2">
                        <span className={cn("inline-block h-1.5 w-8 rounded-full", p.bar)} />
                        <span className="text-xs text-muted-foreground">{p.label}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <ToneBadge tone={statusDemanda(d.status).tone}>
                        {statusDemanda(d.status).label}
                      </ToneBadge>
                    </td>
                    <td className="px-4 py-3 text-right align-middle">
                      <ConfirmDelete
                        titulo="Excluir demanda"
                        descricao={`A demanda ${d.numero} será removida permanentemente.`}
                        onConfirm={() => handleExcluir(d.id)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tint,
  alerta,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tint: string;
  alerta?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm",
        alerta && "border-destructive/40",
      )}
    >
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", tint)}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-semibold leading-none tracking-tight text-foreground">
          {value}
        </p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
