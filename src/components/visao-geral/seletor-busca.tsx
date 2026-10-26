import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
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

export interface OpcaoBusca {
  id: string;
  nome: string;
  detalhe?: string | null;
}

/**
 * Seletor com busca do Painel geral (assinante, usuário). Com `onBusca`, quem filtra é o
 * servidor (assinantes são milhares); sem ele, filtra a lista recebida.
 */
export function SeletorBusca({
  valor,
  rotuloValor,
  opcoes,
  aoEscolher,
  onBusca,
  carregando,
  vazio,
  todos,
  rotulo,
  icone,
  desabilitado,
  dica,
  className,
}: {
  valor?: string;
  /** Nome do valor escolhido quando ele não está na página de opções. */
  rotuloValor?: string | null;
  opcoes: OpcaoBusca[];
  aoEscolher: (id: string | undefined) => void;
  onBusca?: (termo: string) => void;
  carregando?: boolean;
  vazio: string;
  /** Texto do "todos" (sem filtro). */
  todos: string;
  rotulo: string;
  icone?: React.ReactNode;
  desabilitado?: boolean;
  dica?: string;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const escolhido = opcoes.find((o) => o.id === valor);
  const texto = escolhido?.nome ?? (valor ? (rotuloValor ?? "Selecionado") : todos);
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={aberto}
          aria-label={rotulo}
          title={dica}
          disabled={desabilitado}
          data-depth="off"
          className={cn(
            "h-9 min-w-0 justify-between gap-2 px-2.5 font-normal",
            valor && "border-primary/40 bg-accent/60 text-foreground",
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            {icone}
            <span className="truncate">{texto}</span>
          </span>
          {valor ? (
            <span
              role="button"
              tabIndex={0}
              aria-label={`Limpar ${rotulo.toLowerCase()}`}
              data-depth="off"
              className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                aoEscolher(undefined);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  aoEscolher(undefined);
                }
              }}
            >
              <X className="size-3.5" />
            </span>
          ) : (
            <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,320px)] p-0" align="start">
        <Command shouldFilter={!onBusca}>
          <CommandInput placeholder={`Buscar ${rotulo.toLowerCase()}…`} onValueChange={onBusca} />
          <CommandList>
            <CommandEmpty>{carregando ? "Buscando…" : vazio}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={`__todos ${todos}`}
                onSelect={() => {
                  aoEscolher(undefined);
                  setAberto(false);
                }}
              >
                <Check className={cn("size-4", valor ? "opacity-0" : "opacity-100")} />
                {todos}
              </CommandItem>
              {opcoes.map((o) => (
                <CommandItem
                  key={o.id}
                  value={`${o.nome} ${o.detalhe ?? ""} ${o.id}`}
                  onSelect={() => {
                    aoEscolher(o.id);
                    setAberto(false);
                  }}
                >
                  <Check className={cn("size-4", valor === o.id ? "opacity-100" : "opacity-0")} />
                  <span className="min-w-0 flex-1 truncate">{o.nome}</span>
                  {o.detalhe && (
                    <span className="max-w-[45%] shrink-0 truncate text-xs text-muted-foreground">
                      {o.detalhe}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
