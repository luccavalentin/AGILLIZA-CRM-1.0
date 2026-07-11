import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeletorMesAno } from "./seletor-mes-ano";

interface NavegacaoCalendarioProps {
  ref: Date;
  hoje: Date;
  onChange: (d: Date) => void;
}

/** Cabeçalho de navegação: seletor de mês/ano + botões anterior/hoje/próximo. */
export function NavegacaoCalendario({ ref, hoje, onChange }: NavegacaoCalendarioProps) {
  return (
    <div className="flex items-center justify-between">
      <SeletorMesAno ref={ref} onChange={onChange} />
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onChange(new Date(ref.getFullYear(), ref.getMonth() - 1, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(new Date(hoje.getFullYear(), hoje.getMonth(), 1))}
        >
          Hoje
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onChange(new Date(ref.getFullYear(), ref.getMonth() + 1, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
