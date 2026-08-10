import type { ReactNode } from "react";

/** Cabeçalho hero unificado (fundo da marca, compacto). */
export function AdminHero({
  icon,
  titulo,
  descricao,
  acoes,
  secao = "Administrativo",
}: {
  icon: ReactNode;
  titulo: string;
  descricao?: string;
  acoes?: ReactNode;
  secao?: string;
}) {
  return (
    <div className="op-hero px-4 py-3.5 md:px-5 md:py-4">
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/20 md:size-10">
            {icon}
          </span>
          <div className="min-w-0 space-y-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/80">
              {secao}
            </span>
            <h1 className="truncate text-base font-bold tracking-tight text-foreground md:text-lg">
              {titulo}
            </h1>
            {descricao && (
              <p className="max-w-2xl text-xs text-muted-foreground md:text-sm">{descricao}</p>
            )}
          </div>
        </div>
        {acoes && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{acoes}</div>}
      </div>
    </div>
  );
}
