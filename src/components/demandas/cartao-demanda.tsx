import { Link } from "@tanstack/react-router";
import { Hand, MessageCircle, UserRoundX } from "lucide-react";
import { cn } from "@/lib/utils";
import { OpAvatar } from "@/components/operacional/ui";
import type { DemandaCentralItem } from "@/lib/operacional/demandas-central.functions";
import { nomeTipoDemanda, ROTULO_MOTIVO_ATRIBUICAO } from "@/lib/operacional/demandas-regras";
import {
  BarraPrazo,
  OrigemChip,
  PrazoChip,
  PrioridadeMarca,
  StatusDemandaChip,
  TipoIcone,
} from "./pecas";

/**
 * Cartão da demanda (Central em grade e Kanban). Compacto: tipo, número, título, quem pediu
 * (conta/cliente), prazo, responsável e mensagens não lidas. Sem responsável → "Assumir".
 */
export function CartaoDemanda({
  d,
  tipos,
  mostrarStatus = true,
  onAssumir,
  assumindo,
  arrastavel,
  onDragStart,
  className,
}: {
  d: DemandaCentralItem;
  tipos?: { codigo: string; nome: string }[];
  mostrarStatus?: boolean;
  onAssumir?: (id: string) => void;
  assumindo?: boolean;
  arrastavel?: boolean;
  onDragStart?: (e: React.DragEvent, d: DemandaCentralItem) => void;
  className?: string;
}) {
  const quem = d.nome_cliente ?? (d.origem_tipo !== "interno" ? d.solicitante_nome : d.nome_criador);
  return (
    <article
      draggable={arrastavel}
      onDragStart={arrastavel ? (e) => onDragStart?.(e, d) : undefined}
      className={cn(
        "i3d-grupo group relative rounded-2xl border border-border/70 bg-card p-3 shadow-[0_1px_0_color-mix(in_oklab,#fff_70%,transparent)_inset,0_10px_24px_-20px_rgba(0,15,159,0.45)] transition",
        "hover:-translate-y-[1px] hover:border-primary/35 hover:shadow-[0_14px_30px_-20px_rgba(0,15,159,0.55)]",
        arrastavel && "cursor-grab active:cursor-grabbing",
        className,
      )}
    >
      <Link
        to="/operacional/demandas/$id"
        params={{ id: d.id }}
        className="absolute inset-0 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        aria-label={`Abrir demanda ${d.numero ?? ""} ${d.titulo}`}
      />
      <div className="flex items-start gap-2.5">
        <TipoIcone tipo={d.tipo} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
            <span className="font-semibold tabular-nums text-foreground/80">{d.numero ?? "DEM"}</span>
            <span aria-hidden>·</span>
            <span className="truncate">{nomeTipoDemanda(d.tipo, tipos)}</span>
            <PrioridadeMarca prioridade={d.prioridade} />
          </div>
          <h3 className="mt-0.5 line-clamp-2 text-[13px] font-semibold leading-snug text-foreground">{d.titulo}</h3>
          {quem && <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{quem}</p>}
        </div>
        {d.nao_lidas > 0 && (
          <span
            className="relative z-[1] inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground"
            title={`${d.nao_lidas} mensagem(ns) não lida(s)`}
          >
            <MessageCircle className="size-3" />
            {d.nao_lidas > 99 ? "99+" : d.nao_lidas}
          </span>
        )}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {mostrarStatus && <StatusDemandaChip status={d.status} />}
        <PrazoChip prazo={d.prazo_sla} status={d.status} />
        <OrigemChip origem={d.origem_tipo} conta={d.conta_nome} />
        {d.ref_codigo && (
          <span className="rounded-full bg-muted/70 px-2 py-[3px] text-[10.5px] font-medium tabular-nums text-muted-foreground ring-1 ring-inset ring-border">
            {d.ref_codigo}
          </span>
        )}
      </div>

      <div className="mt-2.5">
        <BarraPrazo inicio={d.sla_inicio} prazo={d.prazo_sla} status={d.status} />
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        {d.responsavel_id ? (
          <div className="flex min-w-0 items-center gap-1.5" title={d.atribuicao_motivo ? ROTULO_MOTIVO_ATRIBUICAO[d.atribuicao_motivo] : undefined}>
            <OpAvatar nome={d.nome_responsavel} className="size-6 text-[9px]" />
            <span className="truncate text-[11.5px] text-foreground/85">{d.nome_responsavel}</span>
            {d.atribuicao_motivo && (
              <span className="hidden truncate text-[10.5px] text-muted-foreground sm:inline">
                · {ROTULO_MOTIVO_ATRIBUICAO[d.atribuicao_motivo] ?? ""}
              </span>
            )}
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-warning">
            <UserRoundX className="size-3.5" />
            Sem responsável{d.nome_fila ? ` · ${d.nome_fila}` : ""}
          </span>
        )}
        {!d.responsavel_id && onAssumir && d.status === "aberta" && (
          <button
            type="button"
            onClick={() => onAssumir(d.id)}
            disabled={assumindo}
            className="relative z-[1] inline-flex h-7 shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 text-[11.5px] font-semibold text-primary-foreground shadow-[0_6px_14px_-8px_rgba(0,15,159,0.8)] transition hover:brightness-110 disabled:opacity-60"
          >
            <Hand className="size-3.5" />
            Assumir
          </button>
        )}
      </div>
    </article>
  );
}
