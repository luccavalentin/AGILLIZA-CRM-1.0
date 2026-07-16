import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { type ReactNode } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  User,
  FileText,
  Calculator,
  Users2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  obterDemanda,
  moverStatusDemanda,
  transicaoDemandaPermitida,
  type DemandaStatus,
} from "@/lib/operacional/demandas.functions";
import { DemandaChatTab } from "@/components/operacional/demanda-chat";
import { TransferirDialog } from "@/components/operacional/transferir-dialog";
import { EditarDemandaDialog } from "@/components/operacional/editar-demanda-dialog";
import { statusDemanda } from "@/components/operacional/status";
import { PriorityChip, OpAvatar } from "@/components/operacional/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/operacional/demandas_/$id")({
  head: () => ({ meta: [{ title: "Demanda — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.demandas"),
  component: Pagina,
});

function Pagina() {
  const { id } = useParams({ from: "/_authenticated/operacional/demandas_/$id" });
  const qc = useQueryClient();
  const moverFn = useServerFn(moverStatusDemanda);

  const { data, refetch } = useQuery({
    queryKey: ["demanda", id],
    queryFn: () => obterDemanda({ data: { id } }),
  });

  async function trocarStatus(novo: DemandaStatus) {
    if (!data?.demanda) return;
    if (!transicaoDemandaPermitida(data.demanda.status as DemandaStatus, novo)) {
      toast.error("Transição de status não permitida.");
      return;
    }
    try {
      await moverFn({ data: { id, status: novo } });
      refetch();
      qc.invalidateQueries({ queryKey: ["demandas"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao mover status.");
    }
  }

  if (!data)
    return (
      <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
    );
  const d = data.demanda as any;
  if (!d)
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Demanda não encontrada.</p>
        <Button asChild variant="outline" size="sm" className="mt-3">
          <Link to="/operacional/demandas">
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
          </Link>
        </Button>
      </div>
    );

  const cfg = statusDemanda(d.status as DemandaStatus);
  const restante = d.prazo_sla ? new Date(d.prazo_sla).getTime() - Date.now() : null;
  const slaTone =
    d.status === "concluida"
      ? "text-success"
      : restante === null
        ? "text-muted-foreground"
        : restante < 0
          ? "text-destructive"
          : restante < 24 * 3600_000
            ? "text-warning"
            : "text-muted-foreground";

  return (
    <div className="grid min-h-[calc(100vh-6rem)] gap-4 p-4 md:p-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      {/* ============ Coluna esquerda: resumo & vínculos ============ */}
      <aside className="space-y-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
            <Link to="/operacional/demandas">
              <ArrowLeft className="mr-1 h-4 w-4" /> Demandas
            </Link>
          </Button>
          <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {d.numero ?? "DEM-—"}
              </span>
              <PriorityChip prioridade={d.prioridade} />
              <Badge variant="outline">{cfg.label}</Badge>
            </div>
            <h1 className="mt-2 text-lg font-bold leading-tight text-foreground">{d.titulo}</h1>
            {d.descricao && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                {d.descricao}
              </p>
            )}

            <div className="mt-4 space-y-2 border-t border-border/60 pt-3">
              <Linha icone={<User className="h-3.5 w-3.5" />} label="Responsável">
                <OpAvatar nome={data.nome_responsavel} className="size-5 text-[9px]" />
                <span>{data.nome_responsavel ?? "—"}</span>
              </Linha>
              <Linha icone={<Users2 className="h-3.5 w-3.5" />} label="Solicitante">
                <span>{data.nome_criador ?? "—"}</span>
              </Linha>
              <Linha
                icone={
                  restante !== null && restante < 0 ? (
                    <AlertTriangle className="h-3.5 w-3.5" />
                  ) : d.status === "concluida" ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <Clock className="h-3.5 w-3.5" />
                  )
                }
                label="SLA"
              >
                <span className={cn("tabular-nums", slaTone)}>
                  {d.prazo_sla
                    ? new Date(d.prazo_sla).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Sem prazo"}
                </span>
              </Linha>
            </div>
          </div>
        </div>

        {/* Vínculos */}
        {(d.cliente_id || d.proposta_id || d.simulacao_id) && (
          <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Vínculos
            </p>
            <div className="space-y-2 text-sm">
              {d.cliente_id && (
                <VinculoRow
                  icone={<User className="h-4 w-4 text-primary" />}
                  label={d.clientes?.nome ?? "Cliente"}
                  sub={d.clientes?.numero_cliente}
                  to={`/crm/clientes/${d.cliente_id}`}
                />
              )}
              {d.proposta_id && (
                <VinculoRow
                  icone={<FileText className="h-4 w-4 text-primary" />}
                  label="Proposta"
                  sub={null}
                  to={`/operacional/propostas/${d.proposta_id}`}
                />
              )}
              {d.simulacao_id && (
                <VinculoRow
                  icone={<Calculator className="h-4 w-4 text-primary" />}
                  label="Simulação"
                  sub={null}
                  to={`/operacional/simulacoes/${d.simulacao_id}`}
                />
              )}
            </div>
          </div>
        )}

        {/* Ações — status, transferência, edição inline (título, prioridade, SLA) */}
        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Ações
          </p>
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">Status</label>
            <Select
              value={d.status}
              onValueChange={(v) => trocarStatus(v as DemandaStatus)}
              disabled={!data.permissoes?.pode_mover_status}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aberta">Aberta</SelectItem>
                <SelectItem value="em_andamento">Em andamento</SelectItem>
                <SelectItem value="aguardando">Aguardando</SelectItem>
                <SelectItem value="concluida">Concluída</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.permissoes?.pode_editar && (
              <EditarDemandaDialog
                demanda={{
                  id: d.id,
                  titulo: d.titulo,
                  descricao: d.descricao ?? null,
                  prioridade: d.prioridade,
                  sla_horas: d.sla_horas ?? null,
                }}
                onSalva={() => {
                  refetch();
                  qc.invalidateQueries({ queryKey: ["demandas"] });
                }}
              />
            )}
            {data.permissoes?.pode_transferir && (
              <TransferirDialog
                demandaId={id}
                onTransferida={() => {
                  refetch();
                  qc.invalidateQueries({ queryKey: ["demandas"] });
                }}
              />
            )}
          </div>
          <p className="pt-1 text-[10.5px] leading-relaxed text-muted-foreground">
            Ajuste prioridade, título e prazo (SLA) diretamente em “Editar”.
          </p>
        </div>
      </aside>

      <section className="min-h-0">
        <DemandaChatTab
          demandaId={id}
          info={{
            numero: d.numero,
            titulo: d.titulo,
            statusLabel: cfg.label,
          }}
        />
      </section>
    </div>
  );
}

function Linha({
  icone,
  label,
  children,
}: {
  icone: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="flex w-24 items-center gap-1.5 text-muted-foreground">
        {icone}
        {label}
      </span>
      <span className="flex flex-1 items-center gap-1.5 text-sm text-foreground">{children}</span>
    </div>
  );
}

function VinculoRow({
  icone,
  label,
  sub,
  to,
}: {
  icone: ReactNode;
  label: string;
  sub?: string | null;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/50 px-2.5 py-2 transition hover:border-primary/40 hover:bg-primary/5"
    >
      {icone}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{label}</span>
        {sub && <span className="block truncate text-[11px] text-muted-foreground">{sub}</span>}
      </span>
      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
    </Link>
  );
}
