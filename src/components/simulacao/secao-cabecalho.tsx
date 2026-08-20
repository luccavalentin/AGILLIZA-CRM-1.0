import type { ReactNode } from "react";

/**
 * Cabeçalho padrão de seção usado nas telas de simulação (rápida e completa).
 * Ícone emoldurado + título, com um slot opcional de ação à direita.
 */
export function SecaoCabecalho({
  icone,
  titulo,
  descricao,
  acao,
}: {
  icone: ReactNode;
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border/60 bg-muted/30 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
          {icone}
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-foreground">{titulo}</h2>
          {descricao && <p className="truncate text-xs text-muted-foreground">{descricao}</p>}
        </div>
      </div>
      {acao && <div className="shrink-0">{acao}</div>}
    </div>
  );
}
