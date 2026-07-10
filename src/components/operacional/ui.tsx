import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PRIORIDADE, type Prioridade } from "@/components/operacional/status";

/** Cabeçalho hero refinado para os hubs de Tarefas e Demandas. */
export function OpHero({
  icon,
  eyebrow,
  titulo,
  descricao,
  acoes,
}: {
  icon: ReactNode;
  eyebrow: string;
  titulo: string;
  descricao: string;
  acoes?: ReactNode;
}) {
  return (
    <div className="op-hero p-5 md:p-7">
      <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="flex min-w-0 items-start gap-3.5 md:gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20 md:size-12">
            {icon}
          </span>
          <div className="min-w-0 space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/80">
              {eyebrow}
            </span>
            <h1 className="truncate text-xl font-bold tracking-tight text-foreground md:text-2xl">
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

/** KPI animado com acento colorido. */
export function OpStat({
  label,
  value,
  icon,
  accent = "var(--primary)",
  tint,
  alerta,
}: {
  label: string;
  value: number | string;
  icon: ReactNode;
  accent?: string;
  tint: string;
  alerta?: boolean;
}) {
  return (
    <div
      className={cn("op-stat p-4", alerta && "ring-1 ring-destructive/40")}
      style={{ ["--op-accent" as string]: accent }}
    >
      <div className="flex items-center gap-3">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tint)}>
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-none tracking-tight text-foreground tabular-nums">
            {value}
          </p>
          <p className="mt-1.5 truncate text-xs font-medium text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  );
}

/** Chip de prioridade compacto e legível. */
export function PriorityChip({ prioridade }: { prioridade: Prioridade }) {
  const p = PRIORIDADE[prioridade];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
      <span className={cn("size-1.5 rounded-full", p.bar)} />
      {p.label}
    </span>
  );
}

/** Iniciais de um nome para avatares. */
export function iniciais(nome?: string | null): string {
  if (!nome) return "—";
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

/** Avatar circular com gradiente da marca. */
export function OpAvatar({ nome, className }: { nome?: string | null; className?: string }) {
  return (
    <span
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary/80 to-primary/50 text-[10px] font-semibold text-primary-foreground shadow-sm",
        className,
      )}
    >
      {iniciais(nome)}
    </span>
  );
}
