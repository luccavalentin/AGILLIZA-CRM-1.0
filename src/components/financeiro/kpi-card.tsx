import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type KpiTone = "success" | "warning" | "brand" | "danger";

const toneClasses: Record<KpiTone, { icon: string; ring: string }> = {
  success: { icon: "text-success", ring: "bg-success/10" },
  warning: { icon: "text-warning-foreground", ring: "bg-warning/15" },
  brand: { icon: "text-primary", ring: "bg-primary/10" },
  danger: { icon: "text-destructive", ring: "bg-destructive/10" },
};

export function ReportKpiCard({
  titulo,
  valor,
  icon: Icon,
  tone,
  sub,
}: {
  titulo: string;
  valor: string;
  icon: LucideIcon;
  tone: KpiTone;
  sub?: string;
}) {
  const c = toneClasses[tone];
  return (
    <Card className="flex items-center gap-4 p-4">
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-lg", c.ring)}>
        <Icon className={cn("h-5 w-5", c.icon)} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</p>
        <p className="truncate text-lg font-semibold tabular-nums text-foreground">{valor}</p>
        {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
      </div>
    </Card>
  );
}
