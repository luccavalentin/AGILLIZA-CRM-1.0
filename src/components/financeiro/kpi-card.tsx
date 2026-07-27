import type { LucideIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type KpiTone = "success" | "warning" | "brand" | "danger";

const toneClasses: Record<KpiTone, { icon: string; ring: string; bar: string; wash: string }> = {
  success: {
    icon: "text-success",
    ring: "bg-success/10",
    bar: "bg-success",
    wash: "color-mix(in oklab, var(--success) 8%, transparent)",
  },
  warning: {
    icon: "text-warning-foreground",
    ring: "bg-warning/15",
    bar: "bg-warning",
    wash: "color-mix(in oklab, var(--warning) 9%, transparent)",
  },
  brand: {
    icon: "text-primary",
    ring: "bg-primary/10",
    bar: "bg-primary",
    wash: "color-mix(in oklab, var(--primary) 7%, transparent)",
  },
  danger: {
    icon: "text-destructive",
    ring: "bg-destructive/10",
    bar: "bg-destructive",
    wash: "color-mix(in oklab, var(--destructive) 8%, transparent)",
  },
};

export function ReportKpiCard({
  titulo,
  valor,
  icon: Icon,
  tone,
  sub,
  to,
  onClick,
}: {
  titulo: string;
  valor: string;
  icon: LucideIcon;
  tone: KpiTone;
  sub?: string;
  to?: string;
  /** Se fornecido, o card vira botão (ignora `to`). Use `to` como link "Ver todos" no diálogo. */
  onClick?: () => void;
}) {
  const c = toneClasses[tone];
  const clicavel = !!onClick || !!to;
  const conteudo = (
    <Card
      className={cn(
        "group relative h-full min-w-0 overflow-hidden p-4 pl-5 transition-all duration-300",
        clicavel &&
          "cursor-pointer hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10",
      )}
      style={{ background: `linear-gradient(135deg, ${c.wash}, transparent 62%)` }}
    >
      <span className={cn("absolute left-0 top-0 h-full w-[3px] rounded-r", c.bar)} />
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ring-border/50",
            c.ring,
          )}
        >
          <Icon className={cn("h-5 w-5", c.icon)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground sm:text-[11px]">
              {titulo}
            </p>
            {clicavel && (
              <ArrowUpRight className="h-4 w-4 text-muted-foreground/40 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
            )}
          </div>
          <p className="mt-1 truncate font-mono text-xl font-semibold tracking-tight tabular-nums text-foreground">
            {valor}
          </p>
          {sub && <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>}
        </div>
      </div>
    </Card>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`Ver detalhamento de ${titulo}`}
        className="block w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {conteudo}
      </button>
    );
  }
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
