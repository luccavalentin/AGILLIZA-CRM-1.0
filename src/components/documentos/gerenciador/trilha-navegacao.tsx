import { useState } from "react";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Migalha } from "@/lib/documentos/arquivos.functions";
import { MIME_NO } from "./no-card";

/**
 * Trilha da pasta atual. Cada parte também recebe item arrastado (mover para cima na
 * árvore sem abrir o diálogo).
 */
export function TrilhaNavegacao({
  trilha,
  pasta,
  onNavegar,
  onSoltarEm,
  podeSoltarNaRaiz,
}: {
  trilha: Migalha[];
  pasta: string | null;
  onNavegar: (id: string | null) => void;
  onSoltarEm: (idArrastado: string, destino: string | null) => void;
  podeSoltarNaRaiz: boolean;
}) {
  const [alvo, setAlvo] = useState<string | null>(null);
  const soltavel = (destino: string | null, pode: boolean) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!pode || !e.dataTransfer.types.includes(MIME_NO)) return;
      e.preventDefault();
      setAlvo(destino ?? "raiz");
    },
    onDragLeave: () => setAlvo(null),
    onDrop: (e: React.DragEvent) => {
      const id = e.dataTransfer.getData(MIME_NO);
      setAlvo(null);
      if (!pode || !id) return;
      e.preventDefault();
      onSoltarEm(id, destino);
    },
  });

  return (
    <nav
      aria-label="Pasta atual"
      className="flex min-w-0 items-center gap-0.5 overflow-x-auto text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <button
        type="button"
        {...soltavel(null, podeSoltarNaRaiz)}
        className={cn(
          "flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 transition-colors",
          pasta ? "text-muted-foreground hover:bg-muted hover:text-foreground" : "font-semibold text-foreground",
          alvo === "raiz" && "bg-primary/10 text-primary ring-1 ring-primary",
        )}
        onClick={() => onNavegar(null)}
      >
        <Home className="h-4 w-4" /> Meus arquivos
      </button>
      {trilha.map((m, i, arr) => {
        const ultima = i === arr.length - 1;
        return (
          <span key={m.id} className="flex shrink-0 items-center gap-0.5">
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
            <button
              type="button"
              {...soltavel(m.id, !ultima && m.nivel >= 2)}
              className={cn(
                "max-w-[11rem] truncate rounded-md px-2 py-1 transition-colors",
                ultima
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                alvo === m.id && "bg-primary/10 text-primary ring-1 ring-primary",
              )}
              onClick={() => onNavegar(m.id)}
              aria-current={ultima ? "page" : undefined}
            >
              {m.nome}
            </button>
          </span>
        );
      })}
    </nav>
  );
}
