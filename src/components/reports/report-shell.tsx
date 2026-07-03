import type { ReactNode } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Cabeçalho executivo de relatório com meta (período · escopo · registros) e botão imprimir. */
export function ReportShell({
  modulo,
  titulo,
  descricao,
  meta,
  scopeSelector,
  exportButtons,
  filtros,
  children,
}: {
  modulo: string;
  titulo: string;
  descricao: string;
  meta: string;
  scopeSelector?: ReactNode;
  exportButtons?: ReactNode;
  filtros?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 p-4 md:p-6">
      <header className="flex flex-col gap-3 border-b border-border pb-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Relatórios · {modulo}</p>
          <h1 className="mt-1 text-[26px] font-semibold leading-tight text-foreground">{titulo}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>
          <p className="mt-2 text-xs tabular-nums text-muted-foreground">{meta}</p>
        </div>
        <div className="print:hidden flex flex-wrap items-center gap-2">
          {scopeSelector}
          {exportButtons}
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-3.5 w-3.5 opacity-70" /> Imprimir
          </Button>
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
      <h2 className="border-b border-border pb-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{titulo}</h2>
      {children}
    </section>
  );
}
