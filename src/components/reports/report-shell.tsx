import type { ReactNode } from "react";
import { Printer, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Cabeçalho executivo de relatório: hero da marca, meta em pílulas e barra de ações. */
export function ReportShell({
  modulo,
  titulo,
  descricao,
  metaChips,
  scopeSelector,
  exportButtons,
  filtros,
  children,
}: {
  modulo: string;
  titulo: string;
  descricao: string;
  metaChips: string[];
  scopeSelector?: ReactNode;
  exportButtons?: ReactNode;
  filtros?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-none space-y-4 p-4 md:p-6">
      <header className="op-hero px-4 py-3 md:px-5">
        <div className="relative flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/20">
              <BarChart3 className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/80">
                  Relatórios · {modulo}
                </span>
                <h1 className="truncate text-base font-bold tracking-tight text-foreground md:text-lg">
                  {titulo}
                </h1>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {metaChips.map((m) => (
                  <span
                    key={m}
                    className="inline-flex items-center rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground backdrop-blur-sm"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="print:hidden flex flex-wrap items-center gap-2 lg:justify-end">
            {scopeSelector}
            {exportButtons}
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="mr-1.5 h-3.5 w-3.5 opacity-70" /> Imprimir
            </Button>
          </div>
        </div>
      </header>
      {filtros && <div className="print:hidden">{filtros}</div>}
      {children}
    </div>
  );
}

/** Separador semântico entre seções do relatório. */
export function ReportSection({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {titulo}
        </h2>
        <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
      </div>
      {children}
    </section>
  );
}
