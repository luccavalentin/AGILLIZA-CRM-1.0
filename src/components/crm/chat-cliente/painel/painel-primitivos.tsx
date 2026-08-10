import { Link } from "@tanstack/react-router";
import type { FileText } from "lucide-react";

export function LinhaResumo({
  rotulo,
  valor,
}: {
  rotulo: string;
  valor: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{rotulo}</span>
      <span className="min-w-0 truncate text-right font-medium text-foreground">{valor}</span>
    </div>
  );
}

export function BotaoAcao({
  to,
  params,
  icon: Icon,
  children,
}: {
  to: string;
  params?: Record<string, string>;
  icon: typeof FileText;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      params={params}
      className="flex items-center gap-2 rounded-xl border border-border/60 bg-background px-3 py-2.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
    >
      <Icon className="size-4 shrink-0 text-primary" />
      <span className="truncate">{children}</span>
    </Link>
  );
}
