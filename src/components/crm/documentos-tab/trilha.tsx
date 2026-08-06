import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DocumentoPasta } from "@/lib/crm/documento-pastas.functions";

export function Trilha({
  cadeia,
  onRaiz,
  onNavegar,
}: {
  cadeia: DocumentoPasta[];
  onRaiz: () => void;
  onNavegar: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm">
      <Button variant="ghost" size="sm" onClick={onRaiz}>
        <ChevronLeft className="size-4" />
        Pastas
      </Button>
      {cadeia.map((p, idx) => (
        <span key={p.id} className="flex items-center gap-1.5">
          <span className="text-muted-foreground">/</span>
          {idx === cadeia.length - 1 ? (
            <span className="font-medium text-foreground">{p.nome}</span>
          ) : (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => onNavegar(p.id)}
            >
              {p.nome}
            </button>
          )}
        </span>
      ))}
    </div>
  );
}
