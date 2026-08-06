import { ChevronRight, Folder, Users } from "lucide-react";
import { PASTA_BADGE, type ModoLista, type PastaNode, type PastaTipo } from "./helpers";

export function CardPasta({
  pasta,
  modo,
  IconePasta,
  onOpen,
}: {
  pasta: PastaNode;
  modo: ModoLista;
  IconePasta: (props: { tipo: PastaTipo; aberta?: boolean }) => React.JSX.Element;
  onOpen: () => void;
}) {
  const info = (
    <>
      {pasta.subpastas.length > 0 && (
        <span className="inline-flex items-center gap-1">
          <Folder className="h-3 w-3" /> {pasta.subpastas.length} pasta(s)
        </span>
      )}
      <span className="inline-flex items-center gap-1">
        <Users className="h-3 w-3" /> {pasta.total_clientes} cliente(s)
      </span>
    </>
  );

  if (modo === "lista") {
    return (
      <button
        onClick={onOpen}
        className="group flex items-center gap-3 rounded-xl border border-border/70 bg-card p-3 text-left transition-all hover:border-primary/40 hover:shadow-sm"
      >
        <IconePasta tipo={pasta.tipo} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-foreground">{pasta.nome}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {info}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </button>
    );
  }

  return (
    <button
      onClick={onOpen}
      className="group relative flex flex-col gap-2 overflow-hidden rounded-xl border border-border/70 bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <IconePasta tipo={pasta.tipo} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-foreground">{pasta.nome}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {PASTA_BADGE[pasta.tipo].label}
          </p>
        </div>
      </div>
      <div className="h-0.5 w-full rounded-full bg-primary/20">
        <div
          className="h-0.5 rounded-full bg-primary"
          style={{
            width: `${Math.min(100, (pasta.total_clientes / Math.max(1, pasta.total_clientes)) * 100)}%`,
          }}
        />
      </div>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
        {info}
      </p>
    </button>
  );
}
