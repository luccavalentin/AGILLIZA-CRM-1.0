/**
 * Cartão do kanban de propostas (C34): cliente, banco com a logo oficial, valor,
 * dias parado na etapa com alerta de prazo, responsável e ações rápidas.
 */
import type { CSSProperties, ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Clock,
  ExternalLink,
  MoreHorizontal,
  PlayCircle,
  XCircle,
} from "lucide-react";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { corDoBanco } from "@/lib/bancos/cores";
import { OpAvatar } from "@/components/operacional/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NivelSla } from "@/lib/propostas/kanban-propostas";
import { formatBRL } from "@/lib/simulacao/format";
import { cn } from "@/lib/utils";

export const TOM_SELO: Record<string, string> = {
  success: "bg-success/10 text-success",
  info: "bg-primary/10 text-primary",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
  muted: "bg-muted text-muted-foreground",
};

const TOM_SLA: Record<NivelSla, string> = {
  ok: "border-border bg-muted/50 text-muted-foreground",
  alerta: "border-warning/35 bg-warning/10 text-warning",
  critico: "border-destructive/35 bg-destructive/10 text-destructive",
  sem: "border-border bg-muted/40 text-muted-foreground",
};

function textoDias(dias: number): string {
  if (dias <= 0) return "hoje";
  if (dias === 1) return "1 dia";
  return `${dias} dias`;
}

export interface AcaoRapida {
  rotulo: string;
  icone?: "avancar" | "continuar" | "abrir" | "cancelar";
  perigo?: boolean;
  onSelect: () => void;
}

const ICONE_ACAO = {
  avancar: ArrowRight,
  continuar: PlayCircle,
  abrir: ExternalLink,
  cancelar: XCircle,
};

export function CartaoProposta({
  cliente,
  documento,
  numero,
  numeroSecundario,
  selo,
  banco,
  valor,
  dias,
  nivel,
  responsavel,
  conta,
  marcador,
  arrastavel,
  arrastando,
  onArrastar,
  onSoltarFim,
  onAbrir,
  acoes,
}: {
  cliente: string;
  documento?: string | null;
  numero: string;
  numeroSecundario?: string | null;
  selo: { rotulo: string; tom: string };
  banco: string | null;
  valor: number | string | null;
  dias: number | null;
  nivel: NivelSla;
  responsavel?: string | null;
  /** Conta do assinante (quando a proposta é do Agilliza Tech). */
  conta?: string | null;
  marcador?: ReactNode;
  arrastavel: boolean;
  arrastando?: boolean;
  onArrastar?: () => void;
  onSoltarFim?: () => void;
  onAbrir: () => void;
  acoes?: AcaoRapida[];
}) {
  return (
    <article
      draggable={arrastavel}
      onDragStart={(e) => {
        if (!arrastavel) return;
        e.dataTransfer.effectAllowed = "move";
        onArrastar?.();
      }}
      onDragEnd={() => onSoltarFim?.()}
      onClick={onAbrir}
      onKeyDown={(e) => {
        if (e.key === "Enter") onAbrir();
      }}
      tabIndex={0}
      role="button"
      aria-label={`Proposta de ${cliente}`}
      style={{ "--banco": corDoBanco(banco) } as CSSProperties}
      className={cn(
        "group relative min-w-0 overflow-hidden rounded-xl border border-border/80 bg-card p-3 pl-3.5 text-sm shadow-sm outline-none transition",
        "hover:-translate-y-0.5 hover:border-[color-mix(in_oklab,var(--banco)_45%,var(--border))] hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring",
        "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-[var(--banco)] before:opacity-60",
        nivel === "critico" && "ring-1 ring-destructive/25",
        arrastavel ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        arrastando && "opacity-50",
      )}
    >
      <div className="flex items-start gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-bold uppercase text-primary">
          {(cliente ?? "?").trim().charAt(0) || "?"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-tight text-foreground">{cliente}</p>
          {documento && (
            <p className="truncate text-[11px] tabular-nums text-muted-foreground">{documento}</p>
          )}
        </div>
        {acoes && acoes.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Ações rápidas"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                className="-mr-1 -mt-1 grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuLabel className="text-[11px] text-muted-foreground">Ações rápidas</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {acoes.map((a, i) => {
                const Icone = a.icone ? ICONE_ACAO[a.icone] : ArrowRight;
                return (
                  <DropdownMenuItem
                    key={i}
                    onSelect={() => a.onSelect()}
                    className={cn("gap-2 text-[13px]", a.perigo && "text-destructive focus:text-destructive")}
                  >
                    <Icone className="h-3.5 w-3.5" />
                    {a.rotulo}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className={cn("inline-block rounded-full px-2 py-0.5 text-[10px] font-medium", TOM_SELO[selo.tom] ?? TOM_SELO.muted)}>
          {selo.rotulo}
        </span>
        {dias !== null && nivel !== "sem" && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
              TOM_SLA[nivel],
            )}
            title={
              nivel === "critico"
                ? "Parada além do prazo crítico desta etapa"
                : nivel === "alerta"
                  ? "Perto do prazo desta etapa"
                  : "Dentro do prazo da etapa"
            }
          >
            {nivel === "ok" ? <Clock className="h-2.5 w-2.5" /> : <AlertTriangle className="h-2.5 w-2.5" />}
            {textoDias(dias)} parada
          </span>
        )}
        {marcador}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="rounded bg-primary/10 px-1.5 py-0.5 font-bold tabular-nums text-primary">{numero}</span>
        {numeroSecundario && <span className="tabular-nums text-muted-foreground">{numeroSecundario}</span>}
      </div>

      {conta && (
        <p className="mt-1.5 flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
          <Building2 className="h-3 w-3 shrink-0" />
          <span className="truncate">{conta}</span>
        </p>
      )}

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/60 pt-2.5">
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-foreground">
          <BancoLogo nome={banco} size="xs" className="shrink-0" />
          <span className="truncate">{banco ?? "Sem banco"}</span>
        </span>
        <span className="shrink-0 text-[13px] font-bold tabular-nums text-foreground">
          {formatBRL(Number(valor) || 0)}
        </span>
      </div>
      {responsavel && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <OpAvatar nome={responsavel} className="size-5 text-[9px]" />
          <span className="truncate">{responsavel}</span>
        </div>
      )}
    </article>
  );
}
