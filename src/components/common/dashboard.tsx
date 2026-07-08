import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { RefreshCw, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { corDoBanco } from "@/lib/bancos/cores";
import { BancoLogo } from "@/components/bancos/banco-logo";

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

const toneText: Record<Tone, string> = {
  brand: "text-primary",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
  neutral: "text-muted-foreground",
};

/** Wash de fundo sutil por tom (usa a própria cor semântica via color-mix). */
const toneWash: Record<Tone, string> = {
  brand: "color-mix(in oklab, var(--primary) 7%, transparent)",
  success: "color-mix(in oklab, var(--success) 8%, transparent)",
  warning: "color-mix(in oklab, var(--warning) 9%, transparent)",
  danger: "color-mix(in oklab, var(--destructive) 8%, transparent)",
  neutral: "transparent",
};

const toneGlow: Record<Tone, string> = {
  brand: "color-mix(in oklab, var(--primary) 22%, transparent)",
  success: "color-mix(in oklab, var(--success) 24%, transparent)",
  warning: "color-mix(in oklab, var(--warning) 26%, transparent)",
  danger: "color-mix(in oklab, var(--destructive) 24%, transparent)",
  neutral: "color-mix(in oklab, var(--muted-foreground) 18%, transparent)",
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
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 md:p-6">
      {/* Halo de marca no canto */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full opacity-70 blur-2xl"
        style={{ background: "color-mix(in oklab, var(--primary) 12%, transparent)" }}
      />
      <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            <span className="inline-block h-1 w-6 rounded-full bg-primary" />
            {eyebrow}
          </p>
          <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight text-foreground">
            {titulo}
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">{descricao}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {atualizadoEm && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1 text-[11px] tabular-nums text-muted-foreground">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
              </span>
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
    <div className="flex items-center gap-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/70">
        {children}
      </h2>
      <span className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
    </div>
  );
}

/** Número grande executivo com barra lateral de tom. */
export function HeroMetric({
  label,
  valor,
  hint,
  tone = "neutral",
  icon: Icon,
  to,
}: {
  label: string;
  valor: string;
  hint?: string;
  tone?: Tone;
  icon?: LucideIcon;
  to?: string;
}) {
  const conteudo = (
    <Card
      className={cn(
        "group relative h-full overflow-hidden p-4 pl-5 transition-all duration-200",
        to &&
          "cursor-pointer hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5",
      )}
      style={{ background: `linear-gradient(135deg, ${toneWash[tone]}, transparent 60%)` }}
    >
      <span
        className={cn("absolute left-0 top-0 h-full w-[3px]", toneBar[tone])}
        style={{ boxShadow: `0 0 12px ${toneGlow[tone]}` }}
      />
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
        {Icon ? (
          <span
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-md",
              toneText[tone],
            )}
            style={{ background: toneWash[tone] }}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
        ) : to ? (
          <ArrowUpRight className="h-4 w-4 text-muted-foreground/40 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
        ) : null}
      </div>
      <p className="mt-3 font-mono text-[32px] font-semibold leading-none tabular-nums text-foreground">
        {valor}
      </p>
      {hint && <p className="mt-2 truncate text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
  return to ? (
    <Link
      to={to}
      className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {conteudo}
    </Link>
  ) : (
    conteudo
  );
}

/** Métrica secundária compacta em linha única. */
export function MiniMetric({
  label,
  valor,
  tone = "neutral",
  to,
}: {
  label: string;
  valor: string;
  tone?: Tone;
  to?: string;
}) {
  const conteudo = (
    <Card
      className={cn(
        "group relative h-full overflow-hidden p-3 pl-4 transition-all duration-200",
        to &&
          "cursor-pointer hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md hover:shadow-primary/5",
      )}
    >
      <span className={cn("absolute left-0 top-0 h-full w-[2px]", toneBar[tone])} />
      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-foreground">{valor}</p>
    </Card>
  );
  return to ? (
    <Link
      to={to}
      className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {conteudo}
    </Link>
  ) : (
    conteudo
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
    <Card className="flex h-full flex-col p-5">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="inline-block h-3.5 w-1 rounded-full bg-primary" />
            {titulo}
          </h3>
          {subtitulo && <p className="mt-1 pl-3 text-xs text-muted-foreground">{subtitulo}</p>}
        </div>
        {abrirTo && (
          <Link
            to={abrirTo}
            className="group inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-primary hover:underline"
          >
            Abrir
            <ArrowUpRight className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>
      {children}
    </Card>
  );
}

/** Lista chave-valor com barra proporcional discreta (ranking). */
export function MetricList({
  items,
  colorByBank = false,
}: {
  items: { label: string; valor: number; display?: string }[];
  /** Usa a cor de marca do banco em cada barra/indicador. */
  colorByBank?: boolean;
}) {
  const max = Math.max(1, ...items.map((i) => i.valor));
  if (!items.length)
    return <p className="py-6 text-center text-sm text-muted-foreground">Sem dados no período.</p>;
  return (
    <ul className="space-y-3">
      {items.map((i, idx) => {
        const cor = colorByBank ? corDoBanco(i.label) : undefined;
        return (
          <li key={i.label}>
            <div className="flex items-center justify-between text-sm">
              <span className="flex min-w-0 items-center gap-2 text-foreground">
                {colorByBank ? (
                  <BancoLogo nome={i.label} size="xs" />
                ) : (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-[10px] font-semibold tabular-nums text-muted-foreground">
                    {idx + 1}
                  </span>
                )}
                <span className="truncate font-medium">{i.label}</span>
              </span>
              <span className="ml-2 font-mono tabular-nums text-foreground">
                {i.display ?? i.valor.toLocaleString("pt-BR")}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(i.valor / max) * 100}%`,
                  background:
                    cor ??
                    "linear-gradient(90deg, color-mix(in oklab, var(--primary) 55%, transparent), var(--primary))",
                }}
              />
            </div>
          </li>
        );
      })}
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
    <div
      className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors"
      style={{ background: toneWash[tone] }}
    >
      <span className={cn("h-2 w-2 shrink-0 rounded-full", toneDot[tone])} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{titulo}</p>
        {descricao && <p className="truncate text-xs text-muted-foreground">{descricao}</p>}
      </div>
      {contador != null && (
        <span
          className={cn(
            "rounded-md px-2 py-0.5 font-mono text-sm font-semibold tabular-nums",
            toneText[tone],
          )}
          style={{ background: toneWash[tone] }}
        >
          {contador}
        </span>
      )}
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
