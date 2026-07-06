import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ReportKpi } from "@/lib/relatorios/shared";

const toneBar: Record<NonNullable<ReportKpi["tone"]>, string> = {
  brand: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  neutral: "bg-muted-foreground/40",
};

/** KPI sóbrio de relatório: número monoespaçado + barra lateral 2px de tom. */
export function ReportKpiCard({ kpi }: { kpi: ReportKpi }) {
  const tone = kpi.tone ?? "neutral";
  return (
    <Card className="relative overflow-hidden p-3.5 pl-4">
      <span className={cn("absolute left-0 top-0 h-full w-[2px]", toneBar[tone])} />
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {kpi.label}
      </p>
      <p className="mt-1.5 font-mono text-2xl font-semibold leading-none tabular-nums text-foreground">
        {kpi.valor}
      </p>
      {kpi.hint && <p className="mt-1 truncate text-xs text-muted-foreground">{kpi.hint}</p>}
    </Card>
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
    <Card className="flex flex-col p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-foreground">{titulo}</h3>
          {subtitulo && <p className="text-xs text-muted-foreground">{subtitulo}</p>}
        </div>
        {action}
      </div>
      <div className="h-64 w-full">{children}</div>
    </Card>
  );
}
