import type { LucideIcon } from "lucide-react";

export function Kpi({
  icon: Icone,
  valor,
  rotulo,
}: {
  icon: LucideIcon;
  valor: string | number;
  rotulo: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
          <Icone className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xl font-bold leading-none tracking-tight text-foreground tabular-nums">
            {valor}
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{rotulo}</p>
        </div>
      </div>
    </div>
  );
}
