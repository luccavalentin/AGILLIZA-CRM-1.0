/**
 * Peças visuais das Demandas (C36): selos de situação, prazo, origem e tipo.
 * Identidade Agilliza: azul da marca, vermelho só para atraso, traço fino.
 */
import type { ReactNode } from "react";
import {
  Building2,
  Calculator,
  CircleHelp,
  FileCheck2,
  FileSearch,
  FileText,
  Handshake,
  Landmark,
  Layers,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  consumoPrazo,
  estadoPrazo,
  ROTULO_ORIGEM,
  ROTULO_STATUS_CURTO,
  textoPrazo,
  type DemandaOrigem,
  type DemandaPrioridade,
  type DemandaStatus,
} from "@/lib/operacional/demandas-regras";

export const COR_STATUS: Record<DemandaStatus, { ponto: string; texto: string; fundo: string; barra: string }> = {
  aberta: { ponto: "bg-primary", texto: "text-primary", fundo: "bg-primary/8 ring-primary/20", barra: "bg-primary" },
  em_andamento: {
    ponto: "bg-[#2C4BFF]",
    texto: "text-[#2C4BFF]",
    fundo: "bg-[#2C4BFF]/8 ring-[#2C4BFF]/20",
    barra: "bg-[#2C4BFF]",
  },
  aguardando: { ponto: "bg-warning", texto: "text-warning", fundo: "bg-warning/10 ring-warning/25", barra: "bg-warning" },
  concluida: { ponto: "bg-success", texto: "text-success", fundo: "bg-success/10 ring-success/25", barra: "bg-success" },
  cancelada: {
    ponto: "bg-muted-foreground/60",
    texto: "text-muted-foreground",
    fundo: "bg-muted ring-border",
    barra: "bg-muted-foreground/50",
  },
};

export function StatusDemandaChip({ status, className }: { status: DemandaStatus; className?: string }) {
  const c = COR_STATUS[status] ?? COR_STATUS.aberta;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-[3px] text-[10.5px] font-semibold ring-1 ring-inset",
        c.fundo,
        c.texto,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", c.ponto)} />
      {ROTULO_STATUS_CURTO[status] ?? status}
    </span>
  );
}

export function PrazoChip({
  prazo,
  status,
  className,
}: {
  prazo: string | null | undefined;
  status: DemandaStatus;
  className?: string;
}) {
  const estado = estadoPrazo(prazo, status);
  if (estado === "encerrada") return null;
  const tom =
    estado === "atrasada"
      ? "bg-destructive/10 text-destructive ring-destructive/25"
      : estado === "vencendo"
        ? "bg-warning/10 text-warning ring-warning/25"
        : "bg-muted/70 text-muted-foreground ring-border";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-[3px] text-[10.5px] font-medium tabular-nums ring-1 ring-inset",
        tom,
        className,
      )}
      title={prazo ? `Prazo: ${new Date(prazo).toLocaleString("pt-BR")}` : undefined}
    >
      {textoPrazo(prazo, status)}
    </span>
  );
}

/** Barra fina do prazo consumido (vermelha só quando estourou). */
export function BarraPrazo({
  inicio,
  prazo,
  status,
}: {
  inicio: string | null | undefined;
  prazo: string | null | undefined;
  status: DemandaStatus;
}) {
  const estado = estadoPrazo(prazo, status);
  const f = consumoPrazo(inicio, prazo);
  if (estado === "encerrada" || f === null) return null;
  const cor = estado === "atrasada" ? "bg-destructive" : estado === "vencendo" ? "bg-warning" : "bg-primary/70";
  return (
    <div className="h-[3px] w-full overflow-hidden rounded-full bg-muted" aria-hidden>
      <div className={cn("h-full rounded-full transition-[width]", cor)} style={{ width: `${Math.round(f * 100)}%` }} />
    </div>
  );
}

const ICONE_ORIGEM: Record<DemandaOrigem, ReactNode> = {
  interno: <Building2 className="size-3" />,
  assinante: <Landmark className="size-3" />,
  vinculado: <Handshake className="size-3" />,
};

export function OrigemChip({
  origem,
  conta,
  className,
}: {
  origem: DemandaOrigem;
  conta?: string | null;
  className?: string;
}) {
  const tom =
    origem === "assinante"
      ? "bg-primary/8 text-primary ring-primary/20"
      : origem === "vinculado"
        ? "bg-[#00A3A3]/10 text-[#007F7F] ring-[#00A3A3]/25"
        : "bg-muted/70 text-muted-foreground ring-border";
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full px-2 py-[3px] text-[10.5px] font-medium ring-1 ring-inset",
        tom,
        className,
      )}
      title={conta ? `${ROTULO_ORIGEM[origem]}: ${conta}` : ROTULO_ORIGEM[origem]}
    >
      {ICONE_ORIGEM[origem]}
      <span className="truncate">{conta && origem !== "interno" ? conta : ROTULO_ORIGEM[origem]}</span>
    </span>
  );
}

const ICONE_TIPO: Record<string, ReactNode> = {
  consulta_ficha: <FileSearch className="size-4" />,
  simulacao: <Calculator className="size-4" />,
  proposta: <FileCheck2 className="size-4" />,
  documentacao: <FileText className="size-4" />,
  matricula: <Layers className="size-4" />,
  duvida: <CircleHelp className="size-4" />,
};

/** Ícone do tipo num selo com volume sutil (mesmo traço dos indicadores do Operacional). */
export function TipoIcone({ tipo, className }: { tipo: string; className?: string }) {
  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-xl border border-border/70 text-primary",
        className,
      )}
      style={{
        background: "linear-gradient(180deg, color-mix(in oklab, var(--primary) 9%, var(--card)), var(--card))",
        boxShadow:
          "inset 0 1px 0 color-mix(in oklab, #fff 60%, transparent), 0 6px 14px -10px color-mix(in oklab, var(--primary) 60%, transparent)",
      }}
      aria-hidden
    >
      {ICONE_TIPO[tipo] ?? <UserRound className="size-4" />}
    </span>
  );
}

export function PrioridadeMarca({ prioridade }: { prioridade: DemandaPrioridade }) {
  if (prioridade === "p2") return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-1.5 py-[2px] text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset",
        prioridade === "p1"
          ? "bg-destructive/10 text-destructive ring-destructive/25"
          : "bg-muted text-muted-foreground ring-border",
      )}
    >
      {prioridade === "p1" ? "Urgente" : "Baixa"}
    </span>
  );
}

/** Estado vazio desenhado. */
export function VazioDemandas({
  titulo,
  texto,
  acao,
  icone,
}: {
  titulo: string;
  texto: string;
  acao?: ReactNode;
  icone?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/40 px-6 py-12 text-center">
      <span
        className="mb-3 grid size-12 place-items-center rounded-2xl border border-border/70 text-primary"
        style={{
          background: "linear-gradient(180deg, color-mix(in oklab, var(--primary) 10%, var(--card)), var(--card))",
          boxShadow: "inset 0 1px 0 color-mix(in oklab, #fff 60%, transparent)",
        }}
      >
        {icone ?? <Layers className="size-5" />}
      </span>
      <p className="text-sm font-semibold text-foreground">{titulo}</p>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">{texto}</p>
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}
