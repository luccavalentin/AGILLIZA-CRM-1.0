import * as React from "react";
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface ComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  emptyText?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Seletor (dropdown) com busca a partir de opções pré-cadastradas.
 * Diferente do InputAutocomplete: não permite valores livres.
 */
export function Combobox({
  value,
  onValueChange,
  options,
  placeholder = "Selecione…",
  emptyText = "Nenhuma opção encontrada.",
  searchPlaceholder = "Buscar…",
  disabled,
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const uniqueOptions = React.useMemo(
    () => Array.from(new Set(options.filter((o) => o && o.trim().length > 0))),
    [options],
  );
  // Para listas grandes (ex.: todas as cidades do Brasil), filtramos e limitamos
  // a quantidade renderizada para manter o dropdown fluido.
  const isLarge = uniqueOptions.length > 200;
  const renderedOptions = React.useMemo(() => {
    if (!isLarge) return uniqueOptions;
    const norm = (s: string) =>
      s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    const term = norm(search.trim());
    const base = term ? uniqueOptions.filter((o) => norm(o).includes(term)) : uniqueOptions;
    return base.slice(0, 100);
  }, [uniqueOptions, isLarge, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn("relative", className)}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full justify-between font-normal pr-9",
              !value && "text-muted-foreground",
            )}
          >
            <span className="truncate">{value || placeholder}</span>
            {!value && <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
          </Button>
        </PopoverTrigger>
        {value && !disabled && (
          <button
            type="button"
            aria-label="Limpar seleção"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 opacity-60 hover:opacity-100"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onValueChange("");
            }}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={!isLarge}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={isLarge ? search : undefined}
            onValueChange={isLarge ? setSearch : undefined}
          />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {renderedOptions.map((opt) => (
                <CommandItem
                  key={opt}
                  value={opt}
                  onSelect={() => {
                    onValueChange(opt);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("h-4 w-4", value === opt ? "opacity-100" : "opacity-0")} />
                  {opt}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export interface AsyncOption {
  value: string;
  label: string;
  description?: string;
}

interface AsyncComboboxProps {
  value: string;
  onValueChange: (value: string, option?: AsyncOption) => void;
  onSearch: (term: string) => Promise<AsyncOption[]>;
  placeholder?: string;
  emptyText?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Seletor com busca assíncrona (ex.: puxar clientes do CRM enquanto digita).
 */
export function AsyncCombobox({
  value,
  onValueChange,
  onSearch,
  placeholder = "Selecione…",
  emptyText = "Nenhum resultado.",
  searchPlaceholder = "Buscar…",
  disabled,
  className,
}: AsyncComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [term, setTerm] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<AsyncOption[]>([]);

  React.useEffect(() => {
    if (!open) return;
    const t = term.trim();
    if (!t) {
      setResults([]);
      return;
    }
    let cancelado = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const r = await onSearch(t);
        if (!cancelado) setResults(r);
      } catch {
        if (!cancelado) setResults([]);
      } finally {
        if (!cancelado) setLoading(false);
      }
    }, 300);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [term, open, onSearch]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn("relative", className)}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full justify-between font-normal pr-9",
              !value && "text-muted-foreground",
            )}
          >
            <span className="truncate">{value || placeholder}</span>
            {!value && <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
          </Button>
        </PopoverTrigger>
        {value && !disabled && (
          <button
            type="button"
            aria-label="Limpar seleção"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 opacity-60 hover:opacity-100"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onValueChange("");
            }}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={searchPlaceholder} value={term} onValueChange={setTerm} />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Buscando…
              </div>
            ) : (
              <>
                <CommandEmpty>{term.trim() ? emptyText : "Digite para buscar."}</CommandEmpty>
                <CommandGroup>
                  {results.map((opt) => (
                    <CommandItem
                      key={opt.value}
                      value={opt.value}
                      onSelect={() => {
                        onValueChange(opt.label, opt);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn("h-4 w-4", value === opt.label ? "opacity-100" : "opacity-0")}
                      />
                      <div className="min-w-0">
                        <p className="truncate">{opt.label}</p>
                        {opt.description && (
                          <p className="truncate text-xs text-muted-foreground">
                            {opt.description}
                          </p>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
