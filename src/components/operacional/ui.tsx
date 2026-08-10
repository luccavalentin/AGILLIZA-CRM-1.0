import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PRIORIDADE, type Prioridade } from "@/components/operacional/status";

/** Cabeçalho editorial dos hubs de Tarefas e Demandas. */
export function OpHero({
  icon,
  eyebrow,
  titulo,
  descricao,
  acoes,
  accent,
}: {
  icon: ReactNode;
  eyebrow: string;
  titulo: string;
  descricao: string;
  acoes?: ReactNode;
  /** Cor de acento (ex.: cor de marca do banco). Padrão: azul da marca. */
  accent?: string;
}) {
  return (
    <div
      className="op-hero p-6 md:p-7"
      style={accent ? { ["--op-accent" as string]: accent } : undefined}
    >
      <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-start gap-5 sm:flex sm:flex-wrap sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span
            className="relative grid size-12 shrink-0 place-items-center rounded-2xl border border-border/70 bg-card text-[color:var(--op-accent,var(--primary))] shadow-[inset_0_1px_0_color-mix(in_oklab,#fff_60%,transparent),0_10px_24px_-14px_color-mix(in_oklab,var(--op-accent,var(--primary))_55%,transparent)] md:size-[3.25rem]"
          >
            <span
              aria-hidden
              className="absolute inset-0 rounded-2xl opacity-70"
              style={{
                background:
                  "radial-gradient(120% 120% at 30% 20%, color-mix(in oklab, var(--op-accent, var(--primary)) 14%, transparent), transparent 65%)",
              }}
            />
            <span className="relative">{icon}</span>
          </span>
          <div className="min-w-0 space-y-1">
            <span className="inline-flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              <span
                aria-hidden
                className="h-px w-6"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, color-mix(in oklab, var(--op-accent, var(--primary)) 60%, transparent))",
                }}
              />
              {eyebrow}
            </span>
            <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground md:text-[1.75rem]">
              {titulo}
            </h1>
            <p className="max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
              {descricao}
            </p>
          </div>
        </div>
        {acoes && (
          <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-auto sm:justify-end">
            {acoes}
          </div>
        )}
      </div>
    </div>
  );
}


/** KPI editorial com barra de acento vertical e número em destaque tipográfico. */
export function OpStat({
  label,
  value,
  icon,
  accent = "var(--primary)",
  alerta,
  hint,
}: {
  label: string;
  value: number | string;
  icon: ReactNode;
  accent?: string;
  /** mantido por compatibilidade; não usado no novo layout sóbrio. */
  tint?: string;
  alerta?: boolean;
  /** Texto de apoio abaixo do valor (contexto extra). */
  hint?: string;
}) {
  return (
    <div
      className={cn("op-stat p-4 md:p-[1.05rem]", alerta && "op-stat--alerta")}
      style={{ ["--op-accent" as string]: accent }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </p>
          <p
            className={cn(
              "mt-2.5 truncate font-semibold leading-none tracking-tight text-foreground tabular-nums",
              typeof value === "string" ? "text-xl" : "text-[1.7rem]",
            )}
            style={{
              fontFeatureSettings: '"tnum" 1, "cv11" 1',
            }}
          >
            {value}
          </p>
          {hint && (
            <p className="mt-2 truncate text-[11px] text-muted-foreground/90">
              {hint}
            </p>
          )}
        </div>
        <span
          className="grid size-9 shrink-0 place-items-center rounded-xl border border-border/70 text-[color:var(--op-accent,var(--primary))]"
          style={{
            background:
              "linear-gradient(180deg, color-mix(in oklab, var(--op-accent, var(--primary)) 10%, var(--card)), var(--card))",
            boxShadow:
              "inset 0 1px 0 color-mix(in oklab, #fff 55%, transparent)",
          }}
        >
          {icon}
        </span>
      </div>
    </div>
  );
}


/** Chip de prioridade refinado (ponto colorido + rótulo, tom monocromático). */
export function PriorityChip({ prioridade }: { prioridade: Prioridade }) {
  const p = PRIORIDADE[prioridade];
  const suf: Record<Prioridade, string> = {
    p1: "Urgente",
    p2: "Alta",
    p3: "Normal",
  };
  const classes: Record<Prioridade, string> = {
    p1: "text-destructive ring-destructive/25 bg-destructive/8",
    p2: "text-warning ring-warning/25 bg-warning/8",
    p3: "text-muted-foreground ring-border bg-muted/60",
  };
  const dot: Record<Prioridade, string> = {
    p1: "bg-destructive shadow-[0_0_0_2px_color-mix(in_oklab,var(--destructive)_20%,transparent)]",
    p2: "bg-warning shadow-[0_0_0_2px_color-mix(in_oklab,var(--warning)_20%,transparent)]",
    p3: "bg-muted-foreground/50",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-[3px] text-[10.5px] font-semibold uppercase tracking-wide ring-1 ring-inset",
        classes[prioridade],
      )}
    >
      <span className={cn("size-1.5 rounded-full", dot[prioridade])} />
      <span className="tabular-nums">{p.label}</span>
      <span className="text-[10px] font-medium normal-case tracking-normal opacity-80">
        · {suf[prioridade]}
      </span>
    </span>
  );
}

/** Iniciais de um nome para avatares. */
export function iniciais(nome?: string | null): string {
  if (!nome) return "—";
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

/** Avatar circular refinado com gradiente suave e anel sutil. */
export function OpAvatar({ nome, className }: { nome?: string | null; className?: string }) {
  return (
    <span
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-semibold text-foreground/85 ring-1 ring-border/80",
        "shadow-[inset_0_1px_0_color-mix(in_oklab,#fff_65%,transparent)]",
        className,
      )}
      style={{
        background:
          "linear-gradient(180deg, color-mix(in oklab, var(--primary) 8%, var(--card)) 0%, var(--muted) 100%)",
      }}
      title={nome ?? undefined}
    >
      {iniciais(nome)}
    </span>
  );
}
