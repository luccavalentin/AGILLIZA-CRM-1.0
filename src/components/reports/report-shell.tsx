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
    <div className="mx-auto w-full max-w-7xl space-y-5 p-4 md:p-6">
      <header className="op-hero p-5 md:p-6">
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3.5 md:gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20 md:size-12">
              <BarChart3 className="h-6 w-6" />
            </span>
            <div className="min-w-0 space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/80">
                Relatórios · {modulo}
              </span>
              <h1 className="truncate text-xl font-bold tracking-tight text-foreground md:text-2xl">
                {titulo}
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground">{descricao}</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {metaChips.map((m) => (
                  <span
                    key={m}
                    className="inline-flex items-center rounded-full border border-border/70 bg-card/70 px-2.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground backdrop-blur-sm"
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
