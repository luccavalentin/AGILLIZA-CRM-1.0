import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Tone = "brand" | "success" | "warning" | "danger" | "neutral";

const toneBar: Record<Tone, string> = {
  brand: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  neutral: "bg-muted-foreground/40",
};

const toneDot: Record<Tone, string> = {
  brand: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  neutral: "bg-muted-foreground",
};

/** Cabeçalho da página de painel: eyebrow, título, descrição, chip de atualização e ações. */
export function PanelHeader({
  eyebrow,
  titulo,
  descricao,
  atualizadoEm,
  onRefresh,
  actions,
}: {
  eyebrow: string;
  titulo: string;
  descricao: string;
  atualizadoEm?: string;
  onRefresh?: () => void;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border pb-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{eyebrow}</p>
        <h1 className="mt-1 text-[26px] font-semibold leading-tight text-foreground">{titulo}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {atualizadoEm && (
          <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] tabular-nums text-muted-foreground">
            Atualizado {atualizadoEm}
          </span>
        )}
        {actions}
        {onRefresh && (
          <Button variant="outline" size="icon" onClick={onRefresh} aria-label="Atualizar">
            <RefreshCw className="h-3.5 w-3.5 opacity-70" />
          </Button>
        )}
      </div>
    </div>
  );
}

/** Barra fina de filtros do painel. */
export function PanelToolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

/** Separador entre grupos de seções. */
export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="border-b border-border pb-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </h2>
  );
}

/** Número grande executivo com barra lateral de tom. */
export function HeroMetric({
  label,
  valor,
  hint,
  tone = "neutral",
  icon: Icon,
}: {
  label: string;
  valor: string;
  hint?: string;
  tone?: Tone;
  icon?: LucideIcon;
}) {
  return (
    <Card className="relative overflow-hidden p-4 pl-5">
      <span className={cn("absolute left-0 top-0 h-full w-[3px]", toneBar[tone])} />
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        {Icon && <Icon className="h-3.5 w-3.5 opacity-70" />}
      </div>
      <p className="mt-2 font-mono text-[30px] font-semibold leading-none tabular-nums text-foreground">{valor}</p>
      {hint && <p className="mt-1.5 truncate text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

/** Métrica secundária compacta em linha única. */
export function MiniMetric({ label, valor, tone = "neutral" }: { label: string; valor: string; tone?: Tone }) {
  return (
    <Card className="relative overflow-hidden p-3 pl-4">
      <span className={cn("absolute left-0 top-0 h-full w-[2px]", toneBar[tone])} />
      <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">{valor}</p>
    </Card>
  );
}

/** Moldura padrão de gráfico/lista com título, subtítulo e link "Abrir". */
export function PanelCard({
  titulo,
  subtitulo,
  abrirTo,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  abrirTo?: string;
  children: ReactNode;
}) {
  return (
    <Card className="flex flex-col p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-foreground">{titulo}</h3>
          {subtitulo && <p className="text-xs text-muted-foreground">{subtitulo}</p>}
        </div>
        {abrirTo && (
          <Link to={abrirTo} className="shrink-0 text-xs font-medium text-primary hover:underline">
            Abrir
          </Link>
        )}
      </div>
      {children}
    </Card>
  );
}

/** Lista chave-valor com barra proporcional discreta (ranking). */
export function MetricList({ items }: { items: { label: string; valor: number; display?: string }[] }) {
  const max = Math.max(1, ...items.map((i) => i.valor));
  if (!items.length) return <p className="py-6 text-center text-sm text-muted-foreground">Sem dados no período.</p>;
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.label}>
          <div className="flex items-center justify-between text-sm">
            <span className="truncate text-foreground">{i.label}</span>
            <span className="ml-2 font-mono tabular-nums text-muted-foreground">{i.display ?? i.valor.toLocaleString("pt-BR")}</span>
          </div>
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary/70" style={{ width: `${(i.valor / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Item de alerta compacto. */
export function AlertRow({
  tone = "warning",
  titulo,
  descricao,
  contador,
  to,
}: {
  tone?: Tone;
  titulo: string;
  descricao?: string;
  contador?: number;
  to?: string;
}) {
  const conteudo = (
    <div className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5">
      <span className={cn("h-2 w-2 shrink-0 rounded-full", toneDot[tone])} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{titulo}</p>
        {descricao && <p className="truncate text-xs text-muted-foreground">{descricao}</p>}
      </div>
      {contador != null && <span className="font-mono text-sm tabular-nums text-muted-foreground">{contador}</span>}
    </div>
  );
  return to ? (
    <Link to={to} className="block transition-opacity hover:opacity-80">
      {conteudo}
    </Link>
  ) : (
    conteudo
  );
}
