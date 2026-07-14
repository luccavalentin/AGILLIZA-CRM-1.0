import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ReportKpi } from "@/lib/relatorios/shared";

const toneAccent: Record<NonNullable<ReportKpi["tone"]>, string> = {
  brand: "var(--primary)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--destructive)",
  neutral: "var(--muted-foreground)",
};

const toneTint: Record<NonNullable<ReportKpi["tone"]>, string> = {
  brand: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
};

/** KPI executivo de relatório: acento lateral de tom + valor monoespaçado, com elevação ao hover. */
export function ReportKpiCard({ kpi }: { kpi: ReportKpi }) {
  const tone = kpi.tone ?? "neutral";
  return (
    <div
      className="op-stat min-w-0 p-3 sm:p-4"
      style={{ ["--op-accent" as string]: toneAccent[tone] }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {kpi.label}
        </p>
        <span className={cn("size-1.5 shrink-0 rounded-full", toneTint[tone])} />
      </div>
      <p
        className="mt-2 truncate font-mono font-bold leading-tight tabular-nums text-foreground"
        style={{ fontSize: "clamp(1rem, 1.6vw, 1.35rem)" }}
        title={String(kpi.valor)}
      >
        {kpi.valor}
      </p>
      {kpi.hint && <p className="mt-1.5 truncate text-xs text-muted-foreground">{kpi.hint}</p>}
    </div>
  );
}

/** Moldura padrão de gráfico. */
export function ChartCard({
  titulo,
  subtitulo,
  action,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="flex flex-col p-4 shadow-[var(--shadow-card)]">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
          {subtitulo && <p className="text-xs text-muted-foreground">{subtitulo}</p>}
        </div>
        {action}
      </div>
      <div className="h-64 w-full">{children}</div>
    </Card>
  );
}
