import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { RefreshCw, ArrowUpRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { corDoBanco } from "@/lib/bancos/cores";
import { BancoLogo } from "@/components/bancos/banco-logo";

/** Tendência vs. período anterior equivalente. */
export interface MetricDelta {
  pct: number;
  dir: "up" | "down" | "flat";
  bom: boolean;
  /** Sem base anterior para comparar: exibe "novo" em vez de percentual. */
  novo?: boolean;
}

/** Badge de tendência percentual comparando com o período anterior. */
function DeltaBadge({ delta }: { delta: MetricDelta }) {
  // Sem base anterior para comparar → não há % significativa: não exibe nada.
  if (delta.novo) return null;
  const Icon =
    delta.dir === "up"
      ? TrendingUp
      : delta.dir === "down"
        ? TrendingDown
        : Minus;

  // Cor semântica: "bom" indica se subir é positivo (ex.: contratos) ou não (ex.: recusadas).
  const positivo = delta.dir === "flat" ? null : (delta.dir === "up") === delta.bom;
  const cor =
    positivo === null
      ? "text-muted-foreground bg-muted/60"
      : positivo
        ? "text-success bg-[color-mix(in_oklab,var(--success)_12%,transparent)]"
        : "text-destructive bg-[color-mix(in_oklab,var(--destructive)_12%,transparent)]";
  const sinal = delta.dir === "up" ? "+" : delta.dir === "down" ? "−" : "";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
        cor,
      )}
      title="Comparado ao período anterior equivalente"
    >
      <Icon className="h-3 w-3" />
      {delta.dir === "flat"
        ? "estável"
        : `${sinal}${delta.pct.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo",  maximumFractionDigits: 0 })}%`}

    </span>
  );
}

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

/** Cor CSS bruta do tom, usada em inline styles (borda esquerda tonal). */
const toneVar: Record<Tone, string> = {
  brand: "var(--primary)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--destructive)",
  neutral: "var(--muted-foreground)",
};

/** Wash de fundo sutil por tom (usa a própria cor semântica via color-mix). */
const toneWash: Record<Tone, string> = {
  brand: "color-mix(in oklab, var(--primary) 8%, transparent)",
  success: "color-mix(in oklab, var(--success) 9%, transparent)",
  warning: "color-mix(in oklab, var(--warning) 10%, transparent)",
  danger: "color-mix(in oklab, var(--destructive) 9%, transparent)",
  neutral: "color-mix(in oklab, var(--muted-foreground) 6%, transparent)",
};

const toneIconBg: Record<Tone, string> = {
  brand: "color-mix(in oklab, var(--primary) 12%, transparent)",
  success: "color-mix(in oklab, var(--success) 14%, transparent)",
  warning: "color-mix(in oklab, var(--warning) 16%, transparent)",
  danger: "color-mix(in oklab, var(--destructive) 14%, transparent)",
  neutral: "color-mix(in oklab, var(--muted-foreground) 10%, transparent)",
};


/** Cabeçalho da página de painel: eyebrow, título, descrição, chip de atualização e ações. */
export function PanelHeader({
  eyebrow,
  titulo,
  descricao,
  atualizadoEm,
  onRefresh,
  actions,
  variant = "light",
}: {
  eyebrow: string;
  titulo: string;
  descricao: string;
  atualizadoEm?: string;
  onRefresh?: () => void;
  actions?: ReactNode;
  variant?: "light" | "dark";
}) {
  const dark = variant === "dark";
  return (
    <div className={cn(dark ? "op-hero-dark" : "op-hero", "p-4 md:p-6")}>
      <div className="relative grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">

        <div className="min-w-0">
          <p
            className={cn(
              "flex min-w-0 items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] sm:text-[11px] sm:tracking-[0.18em]",
              dark ? "text-white/70" : "text-primary",
            )}
          >
            <span
              className={cn(
                "inline-block h-1 w-5 shrink-0 rounded-full sm:w-6",
                dark ? "bg-white/80" : "bg-primary",
              )}
            />
            <span className="truncate">{eyebrow}</span>
          </p>
          <h1
            className={cn(
              "mt-2 text-2xl font-semibold leading-tight tracking-tight sm:text-[28px]",
              dark ? "text-white" : "text-foreground",
            )}
          >
            {titulo}
          </h1>
          <p className={cn("mt-1.5 max-w-xl text-sm", dark ? "text-white/70" : "text-muted-foreground")}>
            {descricao}
          </p>
        </div>
        <div
          className={cn(
            "grid min-w-0 grid-cols-1 gap-2 text-foreground sm:flex sm:flex-wrap sm:items-center sm:justify-end",
            dark &&
              "sm:rounded-2xl sm:border sm:border-white/10 sm:bg-white/[0.06] sm:p-1.5 sm:backdrop-blur-md sm:gap-1.5",
          )}
        >
          {atualizadoEm && (
            <span
              className={cn(
                "inline-flex min-w-0 items-center justify-center gap-1.5 rounded-full border px-3 py-1 text-[11px] tabular-nums sm:justify-start",
                dark
                  ? "border-white/10 bg-white/[0.06] text-white/85"
                  : "border-border bg-background/60 text-muted-foreground",
              )}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
              </span>
              Atualizado {atualizadoEm}
            </span>
          )}
          {actions}
          {onRefresh && (
            <Button
              variant={dark ? "secondary" : "outline"}
              size="icon"
              onClick={onRefresh}
              aria-label="Atualizar"
              className={cn(dark && "border-white/10 bg-white/10 text-white hover:bg-white/20")}
            >
              <RefreshCw className="h-3.5 w-3.5 opacity-80" />
            </Button>
          )}
        </div>

      </div>
    </div>
  );
}

/** Funil de conversão vertical (etapas com largura proporcional). */
export function ConversionFunnel({ etapas }: { etapas: { label: string; valor: number }[] }) {
  const base = Math.max(1, etapas[0]?.valor ?? 1);
  const tons: Tone[] = ["brand", "brand", "success", "success"];
  return (
    <div className="space-y-2.5">
      {etapas.map((e, idx) => {
        const pctBase = (e.valor / base) * 100;
        const largura = Math.max(24, pctBase);
        const tone = tons[idx] ?? "brand";
        return (
          <div key={e.label} className="flex items-center gap-3">
            <div className="flex-1">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate text-xs font-medium text-foreground">{e.label}</span>
                <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                  {pctBase.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo",  maximumFractionDigits: 0 })}%
                </span>
              </div>
              <div className="flex h-9 items-center">
                <div
                  className={cn(
                    "flex h-full items-center justify-end rounded-md px-3 text-sm font-semibold tabular-nums text-white transition-all duration-500",
                    toneBar[tone],
                  )}
                  style={{ width: `${largura}%` }}
                >
                  {e.valor.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                </div>
              </div>
            </div>
          </div>
        );
      })}
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
    <div className="flex min-w-0 items-center gap-3 overflow-hidden">
      <h2 className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70 sm:tracking-[0.16em]">
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
  delta,
}: {
  label: string;
  valor: string;
  hint?: string;
  tone?: Tone;
  icon?: LucideIcon;
  to?: string;
  delta?: MetricDelta;
}) {
  const conteudo = (
    <Card
      className={cn(
        "group relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border-border/70 p-3.5 shadow-sm transition-all duration-300 sm:p-4",
        to &&
          "cursor-pointer hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/[0.06]",
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-16 opacity-70"
        style={{
          background: `linear-gradient(180deg, ${toneWash[tone]}, transparent 100%)`,
        }}
      />
      <div className="relative flex items-start justify-between gap-2">
        {Icon ? (
          <span
            className={cn(
              "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              toneText[tone],
            )}
            style={{ background: toneIconBg[tone] }}
          >
            <Icon className="h-4 w-4" strokeWidth={2} />
          </span>
        ) : (
          <span
            className={cn("h-8 w-1 shrink-0 rounded-full", toneBar[tone])}
          />
        )}
        {to && (
          <ArrowUpRight className="h-4 w-4 text-muted-foreground/40 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
        )}
      </div>
      <p className="relative mt-2.5 min-w-0 truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground sm:text-[11px] sm:tracking-[0.14em]">
        {label}
      </p>
      <p className="relative mt-0.5 min-w-0 truncate font-mono text-[clamp(1.2rem,5vw,1.5rem)] font-semibold leading-none tracking-tight tabular-nums text-foreground">
        {valor}
      </p>
      {(delta || hint) && (
        <div className="relative mt-1.5 flex min-w-0 items-center gap-2">
          {delta && <DeltaBadge delta={delta} />}
          {hint && <p className="min-w-0 truncate text-[11px] font-medium text-muted-foreground/90">{hint}</p>}
        </div>
      )}
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
        "group relative h-full min-w-0 overflow-hidden rounded-xl border-l-4 p-3.5 pl-4 shadow-sm transition-all duration-300",
        to &&
          "cursor-pointer hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5",
      )}
      style={{ borderLeftColor: toneVar[tone] }}
    >
      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/90 sm:tracking-[0.12em]">
        {label}
      </p>
      <p className="mt-1.5 min-w-0 truncate font-mono text-[clamp(1rem,6vw,1.25rem)] font-semibold tracking-tight tabular-nums text-foreground sm:text-xl">
        {valor}
      </p>
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
    <Card className="flex h-full min-w-0 flex-col p-4 shadow-sm transition-shadow duration-300 hover:shadow-md sm:p-5">
      <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="min-w-0">
          <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
            <span className="inline-block h-4 w-1 shrink-0 rounded-full bg-gradient-to-b from-primary to-primary/50" />
            <span className="truncate">{titulo}</span>
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
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-sm">
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
              <span className="shrink-0 font-mono tabular-nums text-foreground">
                {i.display ?? i.valor.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
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
      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors"
      style={{ background: toneWash[tone] }}
    >
      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", toneDot[tone])} />
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-medium leading-snug text-foreground">{titulo}</p>
        {descricao && <p className="mt-0.5 break-words text-xs leading-snug text-muted-foreground">{descricao}</p>}
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
