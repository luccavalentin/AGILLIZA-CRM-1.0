import { FileText, Folder, Pencil, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DocumentoPasta } from "@/lib/crm/documento-pastas.functions";

export function CardPasta({
  pasta,
  onOpen,
  onRenomear,
  onExcluir,
  compact,
}: {
  pasta: DocumentoPasta;
  onOpen: (p: DocumentoPasta) => void;
  onRenomear: (p: DocumentoPasta) => void;
  onExcluir: (p: DocumentoPasta) => void;
  /** Oculta o chip "criado por" (usado em subpastas dentro de pasta). */
  compact?: boolean;
}) {
  return (
    <div className="group relative flex items-center gap-3 overflow-hidden rounded-xl border border-border/70 bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      <span className="pointer-events-none absolute inset-x-0 top-0 h-0.5 scale-x-0 bg-gradient-to-r from-primary/60 to-primary/10 transition-transform group-hover:scale-x-100" />
      <button
        type="button"
        onClick={() => onOpen(pasta)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary shadow-inner ring-1 ring-inset ring-border/40 transition-colors group-hover:from-primary/25">
          <Folder className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{pasta.nome}</p>
          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <FileText className="size-3" /> {pasta.total_documentos} documento(s)
          </p>
          {!compact && pasta.criado_por_nome ? (
            <span className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-primary">
              <User className="size-3 shrink-0" />
              <span className="truncate">{pasta.criado_por_nome}</span>
            </span>
          ) : null}
        </div>
      </button>
      <div className="flex shrink-0 items-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
        <Button
          size="icon"
          variant="ghost"
          className="size-8"
          title="Renomear pasta"
          onClick={() => onRenomear(pasta)}
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-8 hover:bg-destructive/10"
          title="Excluir pasta"
          onClick={() => onExcluir(pasta)}
        >
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
