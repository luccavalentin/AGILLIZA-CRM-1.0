import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AdicionarItem({ onAdd }: { onAdd: (label: string) => void }) {
  const [texto, setTexto] = useState("");
  const [aberto, setAberto] = useState(false);
  function confirmar() {
    const v = texto.trim();
    if (!v) return;
    onAdd(v);
    setTexto("");
    setAberto(false);
  }
  if (!aberto) {
    return (
      <div className="pt-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setAberto(true)}>
          <Plus className="size-4" /> Adicionar item
        </Button>
      </div>
    );
  }
  return (
    <div className="mt-2 flex items-center gap-2">
      <Input
        autoFocus
        value={texto}
        placeholder="Novo item do checklist…"
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            confirmar();
          } else if (e.key === "Escape") {
            setAberto(false);
            setTexto("");
          }
        }}
        className="h-9"
      />
      <Button type="button" size="sm" onClick={confirmar}>
        <Plus className="size-4" /> Incluir
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => {
          setAberto(false);
          setTexto("");
        }}
      >
        Cancelar
      </Button>
    </div>
  );
}
