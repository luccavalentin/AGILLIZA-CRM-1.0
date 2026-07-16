import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PRIORIDADE, type Prioridade } from "@/components/operacional/status";

/** Cabeçalho sóbrio para os hubs de Tarefas e Demandas. */
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
      className="op-hero p-5 md:p-6"
      style={accent ? { ["--op-accent" as string]: accent } : undefined}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-background text-primary md:size-11">
            {icon}
          </span>
          <div className="min-w-0 space-y-0.5">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {eyebrow}
            </span>
            <h1 className="truncate text-xl font-semibold tracking-tight text-foreground md:text-[1.6rem]">
              {titulo}
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground">{descricao}</p>
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


/** KPI sóbrio com fina régua de acento à esquerda. */
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
      className={cn("op-stat p-4", alerta && "op-stat--alerta")}
      style={{ ["--op-accent" as string]: accent }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p
            className={cn(
              "mt-2 truncate font-semibold leading-none tracking-tight text-foreground tabular-nums",
              typeof value === "string" ? "text-lg" : "text-2xl",
            )}
          >
            {value}
          </p>
          {hint && <p className="mt-1.5 truncate text-[11px] text-muted-foreground">{hint}</p>}
        </div>
        <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-muted/40 text-muted-foreground">
          {icon}
        </span>
      </div>
    </div>
  );
}


/** Chip de prioridade preenchido (P1/P2/P3 · rótulo). */
export function PriorityChip({ prioridade }: { prioridade: Prioridade }) {
  const p = PRIORIDADE[prioridade];
  const suf: Record<Prioridade, string> = {
    p1: "Urgente",
    p2: "Alta",
    p3: "Normal",
  };
  const classes: Record<Prioridade, string> = {
    p1: "bg-destructive/15 text-destructive ring-1 ring-inset ring-destructive/30",
    p2: "bg-warning/15 text-warning ring-1 ring-inset ring-warning/30",
    p3: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        classes[prioridade],
      )}
    >
      <span className={cn("size-1.5 rounded-full", p.bar)} />
      {p.label} · {suf[prioridade]}
    </span>
  );
}

/** Iniciais de um nome para avatares. */
export function iniciais(nome?: string | null): string {
  if (!nome) return "—";
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

/** Avatar circular sóbrio. */
export function OpAvatar({ nome, className }: { nome?: string | null; className?: string }) {
  return (
    <span
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-full border border-border bg-muted text-[10px] font-semibold text-foreground/80",
        className,
      )}
    >
      {iniciais(nome)}
    </span>
  );
}
