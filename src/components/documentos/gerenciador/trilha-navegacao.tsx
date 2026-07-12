import { ChevronLeft, ChevronRight, Home, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Migalha } from "@/lib/documentos/arquivos.functions";

export interface TrilhaNavegacaoProps {
  trilha: Migalha[];
  pasta: string | null;
  onNavegar: (id: string | null) => void;
  busca: string;
  onBuscaChange: (valor: string) => void;
}

/** Breadcrumb do caminho atual + campo de busca da pasta. */
export function TrilhaNavegacao({
  trilha,
  pasta,
  onNavegar,
  busca,
  onBuscaChange,
}: TrilhaNavegacaoProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/70 p-2.5 shadow-sm backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      {pasta ? (
        <button
          className="flex shrink-0 items-center gap-1 self-start rounded-lg border border-border/60 bg-muted/50 px-2.5 py-1 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          onClick={() =>
            onNavegar(trilha.length >= 2 ? trilha[trilha.length - 2].id : null)
          }
        >
          <ChevronLeft className="h-4 w-4" /> <span className="whitespace-nowrap">Voltar</span>
        </button>
      ) : null}
      <div className="-mx-0.5 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-0.5 text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 transition-colors",
            pasta
              ? "text-muted-foreground hover:bg-muted hover:text-foreground"
              : "bg-primary/10 font-medium text-primary",
          )}
          onClick={() => onNavegar(null)}
        >
          <Home className="h-4 w-4" /> <span className="whitespace-nowrap">Início</span>
        </button>
        {trilha.map((m, i, arr) => (
          <span key={m.id} className="flex shrink-0 items-center gap-1">
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
            <button
              className={cn(
                "max-w-[10rem] truncate rounded-lg px-2 py-1 transition-colors",
                i === arr.length - 1
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              onClick={() => onNavegar(m.id)}
            >
              {m.nome}
            </button>
          </span>
        ))}
      </div>
      <div className="relative w-full shrink-0 sm:w-72">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => onBuscaChange(e.target.value)}
          placeholder="Buscar nesta pasta…"
          className="pl-9"
        />
      </div>
    </div>
  );
}
