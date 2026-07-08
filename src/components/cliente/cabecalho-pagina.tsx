import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Cabeçalho de página do portal do cliente.
 * Padrão sóbrio e refinado: faixa sutil com o tom primário da Agilliza,
 * ícone em selo, título e subtítulo. Usado em todas as telas do portal
 * para dar consistência e sofisticação.
 */
export function CabecalhoPagina({
  icon: Icon,
  titulo,
  subtitulo,
  acao,
  className,
}: {
  icon: LucideIcon;
  titulo: string;
  subtitulo?: string;
  acao?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-primary/[0.07] via-card to-card p-5 sm:p-6",
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-primary/10 blur-2xl"
      />
      <div className="relative grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 sm:gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15 sm:h-12 sm:w-12">
          <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            {titulo}
          </h1>
          {subtitulo && (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{subtitulo}</p>
          )}
        </div>
        {acao && <div className="col-span-2 sm:col-span-1 sm:ml-auto">{acao}</div>}
      </div>
    </div>
  );
}
