import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Paginação numérica com reticências. */
export function Paginador({
  pagina,
  totalPaginas,
  onIr,
}: {
  pagina: number;
  totalPaginas: number;
  onIr: (p: number) => void;
}) {
  const paginas: (number | "...")[] = [];
  const push = (v: number | "...") => paginas.push(v);
  if (totalPaginas <= 6) {
    for (let i = 1; i <= totalPaginas; i++) push(i);
  } else {
    push(1);
    if (pagina > 3) push("...");
    for (let i = Math.max(2, pagina - 1); i <= Math.min(totalPaginas - 1, pagina + 1); i++) push(i);
    if (pagina < totalPaginas - 2) push("...");
    push(totalPaginas);
  }
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={pagina <= 1}
        onClick={() => onIr(pagina - 1)}
        className="grid size-8 place-items-center rounded-lg border border-border/60 bg-card text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      {paginas.map((p, i) =>
        p === "..." ? (
          <span key={`e${i}`} className="px-2 text-xs text-muted-foreground">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onIr(p)}
            className={cn(
              "grid size-8 place-items-center rounded-lg border text-xs font-medium transition-colors",
              p === pagina
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border/60 bg-card text-foreground hover:bg-muted",
            )}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        disabled={pagina >= totalPaginas}
        onClick={() => onIr(pagina + 1)}
        className="grid size-8 place-items-center rounded-lg border border-border/60 bg-card text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
