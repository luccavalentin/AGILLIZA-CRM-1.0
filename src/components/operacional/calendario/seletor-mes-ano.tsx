import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MESES } from "./utils";

interface SeletorMesAnoProps {
  ref: Date;
  onChange: (d: Date) => void;
}

/** Título clicável do calendário que abre um seletor de mês e ano. */
export function SeletorMesAno({ ref, onChange }: SeletorMesAnoProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto gap-2 px-2 py-1 text-base font-medium text-foreground hover:bg-accent"
        >
          {MESES[ref.getMonth()]} {ref.getFullYear()}
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3 p-3">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onChange(new Date(ref.getFullYear() - 1, ref.getMonth(), 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold tabular-nums">{ref.getFullYear()}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onChange(new Date(ref.getFullYear() + 1, ref.getMonth(), 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {MESES.map((m, i) => (
            <Button
              key={m}
              variant={i === ref.getMonth() ? "default" : "ghost"}
              size="sm"
              className="h-8 text-xs"
              onClick={() => onChange(new Date(ref.getFullYear(), i, 1))}
            >
              {m.slice(0, 3)}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
