import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
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
import { cn } from "@/lib/utils";

export interface UsuarioOpcao {
  id: string;
  nome?: string | null;
  email?: string | null;
}

/**
 * Campo de busca por usuário: conforme o usuário digita, filtra os usuários
 * cadastrados na base. O valor "todos" representa "Todos os usuários".
 */
export function UsuarioCombobox({
  value,
  onValueChange,
  usuarios,
  className,
  placeholder = "Todos os usuários",
}: {
  value: string;
  onValueChange: (v: string) => void;
  usuarios: UsuarioOpcao[];
  className?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const rotulo = (u: UsuarioOpcao) => u.nome ?? u.email ?? "—";
  const selecionado = value !== "todos" ? usuarios.find((u) => u.id === value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Buscar usuário"
          className={cn(
            "justify-between font-normal",
            !selecionado && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{selecionado ? rotulo(selecionado) : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar usuário…" />
          <CommandList>
            <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="todos os usuários"
                onSelect={() => {
                  onValueChange("todos");
                  setOpen(false);
                }}
              >
                <Check className={cn("h-4 w-4", value === "todos" ? "opacity-100" : "opacity-0")} />
                Todos os usuários
              </CommandItem>
              {usuarios.map((u) => (
                <CommandItem
                  key={u.id}
                  value={`${rotulo(u)} ${u.email ?? ""}`}
                  onSelect={() => {
                    onValueChange(u.id === value ? "todos" : u.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("h-4 w-4", value === u.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{rotulo(u)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
