import { FileText, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export type AbaPropostas = "agilliza" | "assinantes";

/**
 * Operacional › Propostas: as propostas do Agilliza e, ao lado, a fila das propostas
 * enviadas pelos assinantes (corretores e imobiliárias), com o contador de pendentes.
 * A aba aparece para todos; sem permissão, ela explica o que pedir ao administrador.
 */
export function AbasPropostas({
  aba,
  onAba,
  pendentes,
}: {
  aba: AbaPropostas;
  onAba: (a: AbaPropostas) => void;
  pendentes: number | null;
}) {
  const item = (
    id: AbaPropostas,
    rotulo: React.ReactNode,
    icone: React.ReactNode,
    extra?: React.ReactNode,
  ) => (
    <button
      type="button"
      role="tab"
      aria-selected={aba === id}
      onClick={() => onAba(id)}
      className={cn(
        "relative inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors sm:flex-none sm:px-4",
        aba === id
          ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icone}
      <span className="truncate">{rotulo}</span>
      {extra}
    </button>
  );
  return (
    <div
      role="tablist"
      aria-label="Origem das propostas"
      className="flex w-full gap-1 rounded-xl bg-muted/70 p-1 sm:inline-flex sm:w-auto"
    >
      {item("agilliza", "Agilliza", <FileText className="size-4 shrink-0" />)}
      {item(
        "assinantes",
        <>
          <span className="sm:hidden">Assinantes</span>
          <span className="hidden sm:inline">Dos assinantes</span>
        </>,
        <Inbox className="size-4 shrink-0" />,
        pendentes !== null && pendentes > 0 ? (
          <span
            className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold tabular-nums text-primary-foreground"
            aria-label={`${pendentes} pendentes`}
          >
            {pendentes > 99 ? "99+" : pendentes}
          </span>
        ) : null,
      )}
    </div>
  );
}
