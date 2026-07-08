import { ChevronRight, Home, Search } from "lucide-react";
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
    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/60 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-1 text-sm">
        <button
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-1 transition-colors",
            pasta
              ? "text-muted-foreground hover:bg-muted hover:text-foreground"
              : "bg-primary/10 font-medium text-primary",
          )}
          onClick={() => onNavegar(null)}
        >
          <Home className="h-4 w-4" /> Início
        </button>
        {trilha.map((m, i, arr) => (
          <span key={m.id} className="flex items-center gap-1">
            <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
            <button
              className={cn(
                "rounded-md px-2 py-1 transition-colors",
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
      <div className="relative sm:w-72">
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
