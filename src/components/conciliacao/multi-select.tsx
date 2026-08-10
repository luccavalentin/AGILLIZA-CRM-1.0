import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface OpcaoMulti {
  value: string;
  label: string;
  icone?: React.ReactNode;
}

/** Seletor de múltipla escolha (checkbox list) usado nos filtros do comparativo. */
export function MultiSelect({
  opcoes,
  valores,
  onChange,
  placeholder = "Todos",
  className,
}: {
  opcoes: OpcaoMulti[];
  valores: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  className?: string;
}) {
  const alternar = (v: string) =>
    onChange(valores.includes(v) ? valores.filter((x) => x !== v) : [...valores, v]);

  const resumo =
    valores.length === 0
      ? placeholder
      : valores.length === 1
        ? (opcoes.find((o) => o.value === valores[0])?.label ?? valores[0])
        : `${valores.length} selecionados`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("h-9 justify-between gap-2 font-normal", className)}
        >
          <span className="truncate">{resumo}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        <div className="max-h-72 overflow-y-auto">
          {opcoes.map((o) => {
            const ativo = valores.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => alternar(o.value)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                <span
                  className={cn(
                    "grid size-4 shrink-0 place-items-center rounded border",
                    ativo ? "border-primary bg-primary text-primary-foreground" : "border-border",
                  )}
                >
                  {ativo && <Check className="h-3 w-3" />}
                </span>
                {o.icone}
                <span className="truncate">{o.label}</span>
              </button>
            );
          })}
        </div>
        {valores.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted"
          >
            Limpar seleção
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
