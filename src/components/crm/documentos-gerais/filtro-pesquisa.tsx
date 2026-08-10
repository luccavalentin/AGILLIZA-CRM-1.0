import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { titulo } from "./helpers";

export type FiltroOpcao = { id: string; nome: string };

export function FiltroPesquisa({
  label,
  value,
  todosValue,
  todosLabel,
  placeholder,
  opcoes,
  opcoesFixas = [],
  onChange,
}: {
  label: string;
  value: string;
  todosValue: string;
  todosLabel: string;
  placeholder: string;
  opcoes: FiltroOpcao[];
  opcoesFixas?: FiltroOpcao[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const itens = useMemo(() => {
    const map = new Map<string, FiltroOpcao>();
    for (const item of opcoesFixas) map.set(item.id, item);
    for (const item of opcoes) map.set(item.id, item);
    return Array.from(map.values()).sort((a, b) =>
      titulo(a.nome).localeCompare(titulo(b.nome), "pt-BR"),
    );
  }, [opcoes, opcoesFixas]);
  const selecionado =
    value === todosValue ? todosLabel : titulo(itens.find((i) => i.id === value)?.nome);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label={label}
          className={cn(
            "group flex h-10 min-w-[210px] max-w-full flex-1 items-center justify-between gap-2 rounded-xl border border-border/70 bg-card px-3 text-left text-sm shadow-sm transition-all sm:flex-none lg:w-[220px]",
            "hover:border-primary/35 hover:bg-accent/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === todosValue ? "text-muted-foreground" : "text-foreground",
          )}
        >
          <span className="min-w-0 flex-1 truncate">
            {selecionado && selecionado !== "—" ? selecionado : todosLabel}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] overflow-hidden rounded-xl border-border/70 p-0 shadow-lg"
      >
        <Command
          filter={(itemValue, search) => {
            const normalize = (s: string) =>
              s
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase();
            return normalize(itemValue).includes(normalize(search)) ? 1 : 0;
          }}
        >
          <CommandInput placeholder={placeholder} className="h-10" />
          <CommandList className="max-h-72">
            <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={todosLabel}
                onSelect={() => {
                  onChange(todosValue);
                  setOpen(false);
                }}
                className="py-2.5"
              >
                <Check
                  className={cn("size-4", value === todosValue ? "opacity-100" : "opacity-0")}
                />
                <span className="truncate font-medium">{todosLabel}</span>
              </CommandItem>
              {itens.map((item) => {
                const nome = titulo(item.nome);
                return (
                  <CommandItem
                    key={item.id}
                    value={`${nome} ${item.id}`}
                    onSelect={() => {
                      onChange(item.id);
                      setOpen(false);
                    }}
                    className="py-2.5"
                  >
                    <Check
                      className={cn("size-4", value === item.id ? "opacity-100" : "opacity-0")}
                    />
                    <span className="truncate">{nome}</span>
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
