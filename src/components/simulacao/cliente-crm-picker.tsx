import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Search, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { buscarClientesCRM } from "@/lib/simulacao/simulacoes.functions";
import { maskCpfCnpj } from "@/lib/simulacao/format";

export interface ClienteCRM {
  id: string;
  nome: string | null;
  documento: string | null;
  email: string | null;
  telefone_celular: string | null;
  data_nascimento: string | null;
  estado_civil: string | null;
  renda_total_declarada: number | null;
  tipo_pessoa: string | null;
  conjuge_nome: string | null;
  conjuge_cpf: string | null;
  conjuge_renda: number | null;
  conjuge_data_nascimento: string | null;
  conjuge_email: string | null;
  conjuge_celular: string | null;
}

export function ClienteCRMPicker({
  onSelect,
  selecionado,
}: {
  onSelect: (c: ClienteCRM) => void;
  selecionado?: string | null;
}) {
  const [aberto, setAberto] = useState(false);
  const [q, setQ] = useState("");

  const { data: clientes, isFetching } = useQuery({
    queryKey: ["buscar-clientes-crm", q],
    queryFn: () => buscarClientesCRM({ data: { q } }),
    enabled: q.trim().length >= 2,
  });

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-start gap-2">
          <UserRound className="h-4 w-4 text-muted-foreground" />
          {selecionado ? selecionado : "Puxar cliente do CRM"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <CommandInput
              value={q}
              onValueChange={setQ}
              placeholder="Buscar por nome ou CPF/CNPJ…"
              className="border-0"
            />
          </div>
          <CommandList>
            {q.trim().length < 2 ? (
              <div className="p-4 text-sm text-muted-foreground">Digite ao menos 2 caracteres.</div>
            ) : isFetching ? (
              <div className="p-4 text-sm text-muted-foreground">Buscando…</div>
            ) : (
              <>
                <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                <CommandGroup>
                  {(clientes ?? []).map((c) => (
                    <CommandItem
                      key={c.id}
                      value={c.id}
                      onSelect={() => {
                        onSelect(c as ClienteCRM);
                        setAberto(false);
                      }}
                      className="flex flex-col items-start gap-0.5"
                    >
                      <span className="flex w-full items-center justify-between">
                        <span className="font-medium">{c.nome ?? "Sem nome"}</span>
                        {selecionado === c.nome && <Check className="h-4 w-4" />}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {c.documento ? maskCpfCnpj(c.documento) : "—"}
                        {c.email ? ` · ${c.email}` : ""}
                      </span>
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
