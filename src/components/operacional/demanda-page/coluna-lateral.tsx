import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import type { QueryClient } from "@tanstack/react-query";
import {

  AlertTriangle,
  ArrowLeft,
  Calculator,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  Pencil,
  Repeat,
  User,
  UserPlus,
  Users2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EditarDemandaDialog } from "@/components/operacional/editar-demanda-dialog";
import { TransferirDialog } from "@/components/operacional/transferir-dialog";
import { AdicionarParticipanteDialog } from "@/components/operacional/adicionar-participante-dialog";
import { statusDemanda } from "@/components/operacional/status";
import { PriorityChip, OpAvatar } from "@/components/operacional/ui";
import type { DemandaStatus } from "@/lib/operacional/demandas.functions";
import { cn } from "@/lib/utils";
import { Linha, VinculoRow } from "./ui";
import { STATUS_PILL_CLS, formatarTempoAberto } from "./helpers";

export function ColunaLateral({
  id,
  data,
  d,
  participantesIds,
  copiado,
  onCopiarNumero,
  onTrocarStatus,
  refetch,
  qc,
}: {
  id: string;
  data: any;
  d: any;
  participantesIds: string[];
  copiado: boolean;
  onCopiarNumero: () => void;
  onTrocarStatus: (v: DemandaStatus) => void;
  refetch: () => void;
  qc: QueryClient;
}) {
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
  const slaVencido = restante !== null && restante < 0 && d.status !== "concluida";
  const slaVencidoHa =
    slaVencido && restante !== null
      ? formatarTempoAberto(new Date(Date.now() + restante).toISOString())
      : null;
  const statusCls = STATUS_PILL_CLS[d.status as string] ?? STATUS_PILL_CLS.aberta;

  return (
    <aside className="space-y-4">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="-ml-2 h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
      >
        <Link to="/operacional/demandas">
          <ArrowLeft className="h-4 w-4" /> Voltar para demandas
        </Link>
      </Button>

      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {d.numero ?? "DEM-—"}
          </span>
          <button
            type="button"
            onClick={onCopiarNumero}
            className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Copiar número"
          >
            {copiado ? <Check className="size-3" /> : <Copy className="size-3" />}
          </button>
          <PriorityChip prioridade={d.prioridade} />
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
              statusCls,
            )}
          >
            {cfg.label}
          </span>
        </div>
        <h1 className="mt-3 text-lg font-bold leading-tight text-foreground">{d.titulo}</h1>
        {d.descricao && (
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {d.descricao}
          </p>
        )}

        <div className="mt-4 space-y-2.5 border-t border-border/60 pt-4">
          <Linha icone={<User className="h-3.5 w-3.5" />} label="Responsável">
            <OpAvatar nome={data.nome_responsavel} className="size-5 text-[9px]" />
            <span className="truncate">{data.nome_responsavel ?? "—"}</span>
          </Linha>
          <Linha icone={<Users2 className="h-3.5 w-3.5" />} label="Solicitante">
            <OpAvatar nome={data.nome_criador} className="size-5 text-[9px]" />
            <span className="truncate">{data.nome_criador ?? "—"}</span>
          </Linha>
          <div className="flex items-start gap-2 text-xs">
            <span className="flex w-24 shrink-0 items-center gap-1.5 pt-0.5 text-muted-foreground">
              {slaVencido ? (
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              ) : d.status === "concluida" ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <Clock className="h-3.5 w-3.5" />
              )}
              SLA
            </span>
            <div className="flex-1">
              <p className={cn("text-sm font-semibold tabular-nums", slaTone)}>
                {slaVencido
                  ? `Vencido há ${slaVencidoHa}`
                  : d.prazo_sla
                    ? new Date(d.prazo_sla).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Sem prazo"}
              </p>
              {d.prazo_sla && (
                <p className="text-[11px] text-muted-foreground">
                  Prazo era{" "}
                  {new Date(d.prazo_sla).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {(d.cliente_id || d.proposta_id || d.simulacao_id) && (
        <div className="space-y-2">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Vínculos
          </p>
          <div className="space-y-2">
            {d.cliente_id && (
              <VinculoRow
                icone={<User className="h-4 w-4 text-primary" />}
                label="Cliente"
                nome={d.clientes?.nome ?? "Cliente"}
                sub={d.clientes?.numero_cliente}
                to={`/crm/clientes/${d.cliente_id}`}
              />
            )}
            {d.proposta_id && (
              <VinculoRow
                icone={<FileText className="h-4 w-4 text-primary" />}
                label="Proposta"
                nome={
                  d.propostas?.numero_proposta ? `#${d.propostas.numero_proposta}` : "Proposta"
                }
                sub={
                  d.propostas?.created_at
                    ? `Criada em ${new Date(d.propostas.created_at).toLocaleDateString("pt-BR")}`
                    : null
                }
                to={`/operacional/propostas/${d.proposta_id}`}
              />
            )}
            {d.simulacao_id && (
              <VinculoRow
                icone={<Calculator className="h-4 w-4 text-primary" />}
                label="Simulação"
                nome={
                  d.simulacoes?.numero_simulacao
                    ? `#${d.simulacoes.numero_simulacao}`
                    : "Simulação"
                }
                sub={
                  d.simulacoes?.updated_at
                    ? `Atualizada em ${new Date(d.simulacoes.updated_at).toLocaleDateString("pt-BR")}`
                    : null
                }
                to={`/operacional/simulacoes/${d.simulacao_id}`}
              />
            )}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Ações
        </p>
        <div className="space-y-1.5">
          <label className="px-1 text-[11px] text-muted-foreground">Status da demanda</label>
          <Select
            value={d.status}
            onValueChange={(v) => onTrocarStatus(v as DemandaStatus)}
            disabled={!data.permissoes?.pode_mover_status}
          >
            <SelectTrigger className="w-full">
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

        <div className="space-y-2">
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
              trigger={
                <Button className="w-full justify-center gap-2">
                  <Pencil className="h-4 w-4" /> Editar demanda
                </Button>
              }
            />
          )}
          {data.permissoes?.pode_transferir && (
            <TransferirDialog
              demandaId={id}
              onTransferida={() => {
                refetch();
                qc.invalidateQueries({ queryKey: ["demandas"] });
              }}
              trigger={
                <Button variant="outline" className="w-full justify-center gap-2">
                  <Repeat className="h-4 w-4" /> Transferir responsável
                </Button>
              }
            />
          )}
          {data.permissoes?.pode_editar && (
            <AdicionarParticipanteDialog
              demandaId={id}
              jaParticipantes={participantesIds}
              onAdicionado={() => {
                refetch();
                qc.invalidateQueries({ queryKey: ["demandas"] });
              }}
              trigger={
                <Button variant="outline" className="w-full justify-center gap-2">
                  <UserPlus className="h-4 w-4" /> Adicionar participante
                </Button>
              }
            />
          )}
        </div>
      </div>
    </aside>
  );
}
