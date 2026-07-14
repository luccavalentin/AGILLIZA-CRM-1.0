import type { ReactNode } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface MultiOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

/** Seletor multi-valor com busca, usado nos filtros de relatório. */
export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Selecionar",
  className,
  emptyText = "Nada encontrado.",
}: {
  options: MultiOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
  emptyText?: string;
}) {
  const toggle = (value: string) =>
    onChange(
      selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value],
    );

  const activeOne = selected.length === 1 ? options.find((o) => o.value === selected[0]) : null;
  const label =
    selected.length === 0
      ? placeholder
      : activeOne
        ? activeOne.label
        : `${selected.length} selecionados`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn(
            "h-9 justify-between gap-2 font-normal",
            selected.length === 0 && "text-muted-foreground",
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            {activeOne?.icon}
            <span className="truncate">{label}</span>
          </span>
          {selected.length > 0 ? (
            <X
              className="h-3.5 w-3.5 shrink-0 opacity-60 hover:opacity-100"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange([]);
              }}
            />
          ) : (
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar…" className="h-9" />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => {
                const active = selected.includes(o.value);
                return (
                  <CommandItem key={o.value} value={o.label} onSelect={() => toggle(o.value)}>
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        active ? "bg-primary text-primary-foreground" : "opacity-60",
                      )}
                    >
                      {active && <Check className="h-3 w-3" />}
                    </div>
                    {o.icon ? <span className="mr-2 flex shrink-0 items-center">{o.icon}</span> : null}
                    <span className="truncate">{o.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Chips dos valores selecionados, com remoção individual. */
export function MultiSelectChips({
  prefix,
  options,
  selected,
  onChange,
}: {
  prefix: string;
  options: MultiOption[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  if (selected.length === 0) return null;
  return (
    <>
      {selected.map((v) => (
        <Badge key={v} variant="secondary" className="gap-1">
          {prefix}: {options.find((o) => o.value === v)?.label ?? v}
          <button
            type="button"
            aria-label="Remover filtro"
            onClick={() => onChange(selected.filter((x) => x !== v))}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
    </>
  );
}
