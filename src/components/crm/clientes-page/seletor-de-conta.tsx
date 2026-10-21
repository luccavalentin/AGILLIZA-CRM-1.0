import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Check, ChevronsUpDown } from "lucide-react";
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
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { listarContasAssinantes, type ContaAssinante } from "@/lib/plataforma/contas.functions";

/**
 * "Conta": troca a base exibida entre a do próprio Agilliza e a de um corretor ou
 * imobiliária assinante. Só aparece para quem tem `saas.contas` (o servidor exige o mesmo).
 * O mesmo seletor serve às telas de Clientes, Simulações e Propostas.
 *
 * Com até milhares de assinantes, rolar uma lista não serve: o seletor busca por nome
 * (sem diferenciar acento nem maiúscula), agrupa em corretores e imobiliárias e desenha
 * no máximo `LIMITE` linhas — o resto aparece conforme a busca afunila. Antes as 2.000
 * linhas iam todas para a tela de uma vez (o filtro do `cmdk` não pagina).
 */
const LIMITE = 60;

const sem = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export function SeletorDeConta({
  conta,
  onConta,
}: {
  conta: ContaAssinante | null;
  onConta: (c: ContaAssinante | null) => void;
}) {
  const pode = usePermissao("saas.contas", "view");
  const listarFn = useServerFn(listarContasAssinantes);
  const contas = useQuery({
    queryKey: ["contas-assinantes"],
    queryFn: () => listarFn(),
    enabled: pode,
    staleTime: 5 * 60_000,
  });
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");

  // Nome normalizado calculado uma vez por carga, não a cada tecla.
  const indexadas = useMemo(
    () => (contas.data ?? []).map((c) => ({ conta: c, chave: sem(c.nome) })),
    [contas.data],
  );
  const termo = sem(busca.trim());
  const encontradas = useMemo(
    () => (termo ? indexadas.filter((c) => c.chave.includes(termo)) : indexadas),
    [indexadas, termo],
  );

  if (!pode) return null;

  const visiveis = encontradas.slice(0, LIMITE).map((c) => c.conta);
  const corretores = visiveis.filter((c) => c.tipo === "corretor");
  const imobiliarias = visiveis.filter((c) => c.tipo === "imobiliaria");
  const mostraBasePropria = !termo || "agilliza sua base".includes(termo);

  function escolher(c: ContaAssinante | null) {
    onConta(c);
    setAberto(false);
    setBusca("");
  }

  const item = (c: ContaAssinante) => (
    <CommandItem key={c.id} value={c.id} onSelect={() => escolher(c)} className="min-h-11">
      <Check className={cn("mr-2 size-4", conta?.id === c.id ? "opacity-100" : "opacity-0")} />
      <span className="truncate">{c.nome}</span>
    </CommandItem>
  );

  return (
    <Popover
      open={aberto}
      onOpenChange={(o) => {
        setAberto(o);
        if (!o) setBusca("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={aberto}
          aria-label="Conta"
          className="h-11 w-full justify-between rounded-xl font-normal sm:w-64"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Building2 className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{conta?.nome ?? "Agilliza (sua base)"}</span>
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-72 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={busca}
            onValueChange={setBusca}
            placeholder="Buscar corretor ou imobiliária…"
            className="text-base sm:text-sm"
          />
          <CommandList className="max-h-80">
            <CommandEmpty>Nenhuma conta encontrada.</CommandEmpty>
            {contas.isLoading && (
              <p className="px-3 py-2 text-xs text-muted-foreground">Carregando contas…</p>
            )}
            {contas.isError && (
              <div className="flex flex-col items-start gap-2 px-3 py-2 text-xs text-destructive">
                {mensagemDeErro(contas.error, "Não foi possível carregar as contas.")}
                <Button type="button" size="sm" variant="outline" onClick={() => contas.refetch()}>
                  Tentar de novo
                </Button>
              </div>
            )}
            {mostraBasePropria && (
              <CommandGroup>
                <CommandItem
                  value="__agilliza__"
                  onSelect={() => escolher(null)}
                  className="min-h-11"
                >
                  <Check className={cn("mr-2 size-4", conta ? "opacity-0" : "opacity-100")} />
                  Agilliza (sua base)
                </CommandItem>
              </CommandGroup>
            )}
            {corretores.length > 0 && (
              <CommandGroup heading="Corretores">{corretores.map(item)}</CommandGroup>
            )}
            {imobiliarias.length > 0 && (
              <CommandGroup heading="Imobiliárias">{imobiliarias.map(item)}</CommandGroup>
            )}
            {encontradas.length > LIMITE && (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                Mostrando {LIMITE} de {encontradas.length}. Digite parte do nome para encontrar
                as demais.
              </p>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
