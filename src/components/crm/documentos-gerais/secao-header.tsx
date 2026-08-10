import { LayoutGrid, List } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ModoLista, OrdemChave } from "./helpers";

export function SecaoHeader({
  titulo,
  total,
  ordem,
  setOrdem,
  modo,
  setModo,
}: {
  titulo: string;
  total: number;
  ordem: OrdemChave;
  setOrdem: (o: OrdemChave) => void;
  modo: ModoLista;
  setModo: (m: ModoLista) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-foreground">{titulo}</h2>
        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
          {total.toLocaleString("pt-BR")}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="hidden text-xs text-muted-foreground sm:inline">Ordenar por:</span>
        <Select value={ordem} onValueChange={(v) => setOrdem(v as OrdemChave)}>
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="nome-asc">Nome (A-Z)</SelectItem>
            <SelectItem value="nome-desc">Nome (Z-A)</SelectItem>
            <SelectItem value="docs-desc">Mais documentos</SelectItem>
            <SelectItem value="docs-asc">Menos documentos</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex overflow-hidden rounded-lg border border-border/60">
          <button
            type="button"
            onClick={() => setModo("grid")}
            aria-label="Grade"
            className={cn(
              "grid size-9 place-items-center transition-colors",
              modo === "grid"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setModo("lista")}
            aria-label="Lista"
            className={cn(
              "grid size-9 place-items-center border-l border-border/60 transition-colors",
              modo === "lista"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
