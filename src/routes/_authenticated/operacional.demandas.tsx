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
import { statusDemanda, type Prioridade } from "@/components/operacional/status";
import { OpHero, OpStat, PriorityChip, OpAvatar } from "@/components/operacional/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/operacional/demandas")({
  head: () => ({ meta: [{ title: "Demandas — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.demandas"),
  component: Pagina,
});

function atrasada(d: { status: string; prazo_sla: string | null }): boolean {
  if (d.status === "concluida" || d.status === "cancelada" || !d.prazo_sla) return false;
  return new Date(d.prazo_sla).getTime() < Date.now();
}

function Pagina() {
  const [escopo, setEscopo] = useState<"minhas" | "equipe">("minhas");
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
    const abertasList = itens.filter(
      (d) => d.status !== "concluida" && d.status !== "cancelada",
    );
    const agora = Date.now();
    const em24h = agora + 24 * 3600_000;
    const vencendo = abertasList.filter(
      (d) => !atrasada(d) && d.prazo_sla && new Date(d.prazo_sla).getTime() <= em24h,
    ).length;
    const criticas = abertasList.filter((d) =>
      ["alta", "urgente", "critica"].includes((d.prioridade ?? "").toLowerCase()),
    ).length;
    const emDia = abertasList.length
      ? Math.round(((abertasList.length - abertasList.filter(atrasada).length) / abertasList.length) * 100)
      : 100;
    return {
      total: itens.length,
      abertas: abertasList.length,
      andamento: itens.filter((d) => d.status === "em_andamento").length,
      vencendo,
      criticas,
      atrasadas: itens.filter(atrasada).length,
      concluidas: itens.filter((d) => d.status === "concluida").length,
      slaEmDia: emDia,
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
      <OpHero
        icon={<Inbox className="h-6 w-6" />}
        eyebrow="Operacional"
        titulo="Demandas"
        descricao="Solicitações formais entre equipes, com SLA e escalonamento."
        acoes={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={verificarSla}
              className="bg-card/60 backdrop-blur"
            >
              <AlertTriangle className="mr-1.5 h-4 w-4" /> Verificar SLA
            </Button>
            <Button asChild variant="outline" size="sm" className="bg-card/60 backdrop-blur">
              <Link to="/operacional/demandas/kanban">
                <KanbanSquare className="mr-1.5 h-4 w-4" /> Kanban
              </Link>
            </Button>
            <NovaDemandaDialog onCriada={refetch} />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <OpStat
          label="Total"
          value={stats.total}
          hint={`${stats.abertas} em aberto`}
          icon={<Inbox className="h-5 w-5" />}
        />
        <OpStat
          label="Em andamento"
          value={stats.andamento}
          icon={<Loader2 className="h-5 w-5" />}
          accent="var(--warning)"
        />
        <OpStat
          label="Vencendo em 24h"
          value={stats.vencendo}
          hint="Prazo se aproximando"
          icon={<AlertTriangle className="h-5 w-5" />}
          accent="var(--warning)"
          alerta={stats.vencendo > 0}
        />
        <OpStat
          label="Alta prioridade"
          value={stats.criticas}
          hint="Em aberto"
          icon={<Flame className="h-5 w-5" />}
          accent="var(--primary)"
        />
        <OpStat
          label="Atrasadas"
          value={stats.atrasadas}
          hint="SLA vencido"
          icon={<Flame className="h-5 w-5" />}
          accent="var(--destructive)"
          alerta={stats.atrasadas > 0}
        />
        <OpStat
          label="SLA em dia"
          value={`${stats.slaEmDia}%`}
          hint={`${stats.concluidas} concluídas`}
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="var(--success)"
        />
      </div>


      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={escopo} onValueChange={(v) => setEscopo(v as "minhas" | "equipe")}>
          <TabsList>
            <TabsTrigger value="minhas">Minhas</TabsTrigger>
            <TabsTrigger value="equipe">Todas</TabsTrigger>
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

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-muted/60" />
            ))}
          </div>
        ) : itens.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-14 text-center">
            <div className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
              <Inbox className="h-7 w-7" />
            </div>
            <p className="text-sm font-medium text-foreground">Nenhuma demanda encontrada</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Crie uma nova demanda para registrar uma solicitação entre equipes.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <table className="hidden w-full text-sm md:table">
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
                  const late = atrasada(d);
                  return (
                    <tr
                      key={d.id}
                      onClick={() =>
                        navigate({ to: "/operacional/demandas/$id", params: { id: d.id } })
                      }
                      className={cn(
                        "op-row group cursor-pointer hover:bg-accent/40",
                        late && "bg-destructive/[0.04]",
                      )}
                      style={{
                        ["--op-accent" as string]: late
                          ? "var(--destructive)"
                          : "var(--primary)",
                      }}
                    >
                      <td className="px-4 py-3 align-middle tabular-nums text-muted-foreground">
                        {d.numero}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <span className="flex items-center gap-1.5 font-medium text-foreground">
                          <span className="line-clamp-1">{d.titulo}</span>
                          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 align-middle text-muted-foreground md:table-cell">
                        {d.nome_cliente ?? "—"}
                      </td>
                      <td className="hidden px-4 py-3 align-middle lg:table-cell">
                        <div className="flex items-center gap-2">
                          <OpAvatar nome={d.nome_responsavel} />
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
                        <PriorityChip prioridade={d.prioridade as Prioridade} />
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <ToneBadge tone={statusDemanda(d.status).tone}>
                          {statusDemanda(d.status).label}
                        </ToneBadge>
                      </td>
                      <td
                        className="px-4 py-3 text-right align-middle"
                        onClick={(e) => e.stopPropagation()}
                      >
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

            {/* Mobile */}
            <ul className="divide-y divide-border/60 md:hidden">
              {itens.map((d) => {
                const late = atrasada(d);
                return (
                  <li key={d.id}>
                    <Link
                      to="/operacional/demandas/$id"
                      params={{ id: d.id }}
                      className={cn(
                        "op-row flex flex-col gap-2 p-4 active:bg-accent/40",
                        late && "bg-destructive/[0.04]",
                      )}
                      style={{
                        ["--op-accent" as string]: late
                          ? "var(--destructive)"
                          : "var(--primary)",
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="line-clamp-2 font-medium text-foreground">{d.titulo}</span>
                        <ToneBadge tone={statusDemanda(d.status).tone}>
                          {statusDemanda(d.status).label}
                        </ToneBadge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                        <span className="tabular-nums">{d.numero}</span>
                        <PriorityChip prioridade={d.prioridade as Prioridade} />
                        <SlaCountdown
                          inicio={d.sla_inicio}
                          prazo={d.prazo_sla}
                          concluida={d.status === "concluida"}
                          concluidaEm={d.concluida_em}
                        />
                      </div>
                      {d.nome_responsavel && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <OpAvatar nome={d.nome_responsavel} className="size-5 text-[9px]" />
                          {d.nome_responsavel}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
