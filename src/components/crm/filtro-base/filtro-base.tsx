import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2,
  Check,
  ChevronsUpDown,
  Layers,
  Link2,
  Loader2,
  Network,
  RotateCcw,
  UserRound,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { buscarContasDoFiltro } from "@/lib/plataforma/filtro-base.functions";
import {
  filtroAtivo,
  iniciais,
  rotuloDoFiltro,
  tipoDaConta,
  type ContaFiltro,
  type FiltroBase as Filtro,
} from "@/lib/plataforma/filtro-base";
import type { UsoFiltroBase } from "./use-filtro-base";
import { Icone3D } from "@/components/ui/icone-3d";

/**
 * Barra "Sua base | Assinantes" (C07, C08, C27/C28, C29, C30). Compacta: o segmentado escolhe a
 * base e o combobox ao lado escolhe o recorte (tudo, só o Agilliza, vinculados ou uma conta;
 * todos os assinantes ou um). Busca e página no servidor — milhares de contas não vêm de uma vez.
 * No celular, o segmentado ocupa a largura e o combobox desce para a linha de baixo.
 */
export function FiltroBase({
  uso,
  className,
  /** Telas que não mostram a base do Agilliza junto (ex.: escolher onde simular). */
  semMisturar = false,
}: {
  uso: UsoFiltroBase;
  className?: string;
  semMisturar?: boolean;
}) {
  const { pode, filtro, definir, conta } = uso;
  if (!pode) return null;
  return (
    <div
      data-tour="filtro-base"
      className={cn(
        "flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center",
        className,
      )}
    >
      <Segmentado
        valor={filtro.base}
        onValor={(b) =>
          definir(b === "sua" ? { base: "sua", origem: "tudo", contaId: null } : { base: "assinantes", contaId: null })
        }
      />
      <SeletorDeRecorte uso={uso} semMisturar={semMisturar} />
      {filtroAtivo(filtro) && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => definir({ base: "sua", origem: "tudo", contaId: null })}
          className="h-9 gap-1.5 self-start rounded-lg px-2.5 text-xs text-muted-foreground hover:text-foreground sm:self-auto"
          aria-label={`Limpar filtro (${rotuloDoFiltro(filtro, conta)})`}
        >
          <RotateCcw className="size-3.5" /> Limpar
        </Button>
      )}
    </div>
  );
}

function Segmentado({
  valor,
  onValor,
}: {
  valor: Filtro["base"];
  onValor: (b: Filtro["base"]) => void;
}) {
  const item = (id: Filtro["base"], rotulo: string, Icone: typeof Users) => (
    <button
      type="button"
      role="tab"
      aria-selected={valor === id}
      onClick={() => valor !== id && onValor(id)}
      className={cn(
        "relative inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[10px] px-3.5 text-[13px] font-semibold transition-all duration-200 sm:flex-none",
        valor === id
          ? "bg-background text-primary shadow-sm ring-1 ring-primary/15"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icone className="size-4 shrink-0" />
      <span className="truncate">{rotulo}</span>
    </button>
  );
  return (
    <div
      role="tablist"
      aria-label="Base exibida"
      className="flex w-full gap-1 rounded-xl border border-border/60 bg-muted/60 p-1 sm:inline-flex sm:w-auto"
    >
      {item("sua", "Sua base", Building2)}
      {item("assinantes", "Assinantes", Users)}
    </div>
  );
}

const sem = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

function AvatarConta({ conta, tamanho = "md" }: { conta: Pick<ContaFiltro, "nome" | "tipo">; tamanho?: "sm" | "md" }) {
  // Peça 3D do Agilliza com as iniciais da conta e o selo do tipo (imobiliária ou corretor).
  return (
    <span aria-hidden className="relative inline-flex shrink-0">
      <Icone3D tom={conta.tipo === "imobiliaria" ? "marca" : "info"} tamanho={tamanho === "sm" ? "xs" : "md"}>
        <span className={cn("relative z-[1] font-semibold", tamanho === "sm" ? "text-[9px]" : "text-[11px]")}>
          {iniciais(conta.nome)}
        </span>
      </Icone3D>
      <span className="absolute -bottom-1 -right-1 z-[2] grid size-3.5 place-items-center rounded-full bg-background ring-1 ring-border">
        {conta.tipo === "imobiliaria" ? (
          <Building2 className="size-2.5 text-muted-foreground" />
        ) : (
          <UserRound className="size-2.5 text-muted-foreground" />
        )}
      </span>
    </span>
  );
}

function SeletorDeRecorte({ uso, semMisturar }: { uso: UsoFiltroBase; semMisturar: boolean }) {
  const { filtro, definir, conta } = uso;
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [termo, setTermo] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTermo(busca.trim()), 250);
    return () => clearTimeout(t);
  }, [busca]);

  const grupo = filtro.base === "assinantes" ? "assinantes" : "vinculados";
  const buscarFn = useServerFn(buscarContasDoFiltro);
  const contas = useInfiniteQuery({
    queryKey: ["filtro-base-contas", grupo, termo],
    queryFn: ({ pageParam }) =>
      buscarFn({ data: { grupo, termo: termo || null, pagina: pageParam, porPagina: 20 } }),
    initialPageParam: 1,
    getNextPageParam: (ultima, todas) =>
      todas.length * (ultima.porPagina || 20) < ultima.total ? todas.length + 1 : undefined,
    enabled: aberto,
    staleTime: 60_000,
  });
  const lista = useMemo(() => (contas.data?.pages ?? []).flatMap((p) => p.contas), [contas.data]);
  const total = contas.data?.pages?.[0]?.total ?? 0;
  const imobiliarias = lista.filter((c) => c.tipo === "imobiliaria");
  const corretores = lista.filter((c) => c.tipo !== "imobiliaria");

  function escolher(f: Filtro) {
    definir(f);
    setAberto(false);
    setBusca("");
  }

  const t = sem(termo);
  const opcoesFixas: { valor: Filtro; rotulo: string; detalhe: string; Icone: typeof Users; ativo: boolean }[] =
    filtro.base === "assinantes"
      ? [
          {
            valor: { base: "assinantes", contaId: null },
            rotulo: "Todos os assinantes",
            detalhe: "Todas as licenças de corretores e imobiliárias",
            Icone: Users,
            ativo: !filtro.contaId,
          },
        ]
      : [
          ...(semMisturar
            ? []
            : [
                {
                  valor: { base: "sua", origem: "tudo", contaId: null } as Filtro,
                  rotulo: "Toda a sua base",
                  detalhe: "Agilliza, parceiros e corretores vinculados",
                  Icone: Layers,
                  ativo: filtro.base === "sua" && filtro.origem === "tudo",
                },
              ]),
          {
            valor: { base: "sua", origem: "agilliza", contaId: null },
            rotulo: "Só o Agilliza",
            detalhe: "Sua equipe e seus parceiros",
            Icone: Building2,
            ativo: filtro.base === "sua" && filtro.origem === "agilliza",
          },
          {
            valor: { base: "sua", origem: "vinculados", contaId: null },
            rotulo: "Todos os vinculados",
            detalhe: "Corretores e parceiros vinculados ao Agilliza",
            Icone: Network,
            ativo: filtro.base === "sua" && filtro.origem === "vinculados" && !filtro.contaId,
          },
        ];
  const fixasVisiveis = opcoesFixas.filter((o) => !t || sem(`${o.rotulo} ${o.detalhe}`).includes(t));

  const rotuloBotao =
    filtro.contaId && conta
      ? conta.nome
      : filtro.contaId
        ? "Carregando conta…"
        : (opcoesFixas.find((o) => o.ativo)?.rotulo ?? "Toda a sua base");

  const itemConta = (c: ContaFiltro) => {
    const ativo = filtro.contaId === c.id;
    const valor: Filtro =
      filtro.base === "assinantes"
        ? { base: "assinantes", contaId: c.id }
        : { base: "sua", origem: "vinculados", contaId: c.id };
    return (
      <CommandItem key={c.id} value={c.id} onSelect={() => escolher(valor)} className="min-h-12 gap-2.5 py-2">
        <AvatarConta conta={c} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{c.nome}</span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {tipoDaConta(c.tipo)}
            {c.creci ? ` · CRECI ${c.creci}${c.creci_uf ? `/${c.creci_uf}` : ""}` : ""}
            {typeof c.clientes === "number"
              ? ` · ${c.clientes} cliente${c.clientes === 1 ? "" : "s"}`
              : ""}
          </span>
        </span>
        {c.vinculo_agilliza && filtro.base === "assinantes" && (
          <Link2 className="size-3.5 shrink-0 text-primary" aria-label="Vinculada" />
        )}
        <Check className={cn("size-4 shrink-0 text-primary", ativo ? "opacity-100" : "opacity-0")} />
      </CommandItem>
    );
  };

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
          aria-label={filtro.base === "assinantes" ? "Escolher assinante" : "Recorte da sua base"}
          className="h-11 w-full min-w-0 justify-between gap-2 rounded-xl border-border/70 bg-card px-2.5 font-normal shadow-sm transition-colors hover:border-primary/30 sm:h-10 sm:w-72"
        >
          <span className="flex min-w-0 items-center gap-2">
            {filtro.contaId && conta ? (
              <AvatarConta conta={conta} tamanho="sm" />
            ) : (
              <Icone3D icone={filtro.base === "assinantes" ? Users : Layers} tamanho="xs" />
            )}
            <span className="truncate text-sm">{rotuloBotao}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,22rem)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={busca}
            onValueChange={setBusca}
            placeholder={
              filtro.base === "assinantes"
                ? "Nome, CRECI, e-mail ou CPF/CNPJ completo…"
                : "Buscar conta vinculada…"
            }
            className="text-base sm:text-sm"
          />
          <CommandList className="max-h-[min(60vh,22rem)]">
            {fixasVisiveis.length > 0 && (
              <CommandGroup>
                {fixasVisiveis.map((o) => (
                  <CommandItem
                    key={o.rotulo}
                    value={o.rotulo}
                    onSelect={() => escolher(o.valor)}
                    className="min-h-12 gap-2.5 py-2"
                  >
                    <Icone3D icone={o.Icone} tamanho="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{o.rotulo}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{o.detalhe}</span>
                    </span>
                    <Check className={cn("size-4 shrink-0 text-primary", o.ativo ? "opacity-100" : "opacity-0")} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandSeparator />
            {contas.isLoading && (
              <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Buscando contas…
              </div>
            )}
            {contas.isError && (
              <div className="flex flex-col items-start gap-2 px-3 py-3 text-xs text-destructive">
                {mensagemDeErro(contas.error, "Não foi possível carregar as contas.")}
                <Button type="button" size="sm" variant="outline" onClick={() => contas.refetch()}>
                  Tentar de novo
                </Button>
              </div>
            )}
            {!contas.isLoading && !contas.isError && lista.length === 0 && (
              <div className="flex flex-col items-center gap-1 px-3 py-6 text-center text-xs text-muted-foreground">
                <Users className="size-5 text-muted-foreground/60" />
                {termo
                  ? "Nenhuma conta encontrada com essa busca."
                  : filtro.base === "assinantes"
                    ? "Nenhum assinante ainda."
                    : "Nenhuma conta vinculada ao Agilliza ainda."}
              </div>
            )}
            {imobiliarias.length > 0 && <CommandGroup heading="Imobiliárias">{imobiliarias.map(itemConta)}</CommandGroup>}
            {corretores.length > 0 && <CommandGroup heading="Corretores">{corretores.map(itemConta)}</CommandGroup>}
            {contas.hasNextPage && (
              <div className="border-t border-border/60 p-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 w-full text-xs"
                  disabled={contas.isFetchingNextPage}
                  onClick={() => contas.fetchNextPage()}
                >
                  {contas.isFetchingNextPage ? (
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  ) : null}
                  Mostrar mais ({lista.length} de {total})
                </Button>
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Selo discreto do filtro aplicado, para o subtítulo das telas. */
export function DescricaoDoFiltro({ uso }: { uso: UsoFiltroBase }) {
  if (!uso.pode) return null;
  return <>{rotuloDoFiltro(uso.filtro, uso.conta)}</>;
}
