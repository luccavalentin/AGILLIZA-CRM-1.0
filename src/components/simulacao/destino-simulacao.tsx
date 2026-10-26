import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2,
  Check,
  ChevronsUpDown,
  Info,
  Link2,
  Loader2,
  MapPin,
  UserRound,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Icone3D } from "@/components/ui/icone-3d";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { buscarContasDoFiltro } from "@/lib/plataforma/filtro-base.functions";
import { iniciais, tipoDaConta, type ContaFiltro } from "@/lib/plataforma/filtro-base";
import { definirContaDestino, type ContaDestino } from "@/lib/simulacao/destino-conta";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * "Onde simular" (C29): Sua base (padrão) ou a conta de um assinante. Na conta, a simulação nasce
 * no Agilliza pelo fluxo de sempre e também na carteira do assinante (que passa a vê-la).
 * Só aparece para quem atende as contas (`saas.contas`). O destino fica na URL (`?conta=`).
 */
export function DestinoSimulacao({
  contaId,
  onConta,
  className,
}: {
  contaId: string | null;
  onConta: (id: string | null) => void;
  className?: string;
}) {
  const pode = usePermissao("saas.contas", "view");
  const buscarFn = useServerFn(buscarContasDoFiltro);
  const resolvida = useQuery({
    queryKey: ["destino-simulacao-conta", contaId],
    queryFn: () => buscarFn({ data: { id: contaId, pagina: 1, porPagina: 5 } }),
    enabled: pode && !!contaId,
    staleTime: 5 * 60_000,
  });
  const conta: ContaFiltro | null = resolvida.data?.contas?.[0] ?? null;
  // LGPD (auditoria de 26/10/2026): escolher a conta copia o cliente para a carteira dela.
  // Um clique errado no combobox não pode virar compartilhamento: confirmação com o nome da conta.
  const [pendente, setPendente] = useState<ContaDestino | null>(null);

  // O fluxo de envio lê o destino daqui; ao sair da tela, volta para a sua base.
  useEffect(() => {
    if (!pode || !contaId) definirContaDestino(null);
    else if (conta) definirContaDestino({ id: conta.id, nome: conta.nome, tipo: conta.tipo });
  }, [pode, contaId, conta]);
  useEffect(() => () => definirContaDestino(null), []);

  if (!pode) return null;
  const naConta = !!contaId;
  const contaInvalida = naConta && resolvida.isSuccess && !conta;

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-3 shadow-sm transition-colors sm:p-4",
        naConta ? "border-primary/30 bg-primary/[0.03]" : "border-border/60",
        className,
      )}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          <Icone3D icone={MapPin} tamanho="md" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Onde simular</p>
            <p className="truncate text-xs text-muted-foreground">
              {naConta
                ? `A simulação também nasce na carteira de ${conta?.nome ?? "assinante"}.`
                : "Na sua base (padrão) ou na base de um assinante."}
            </p>
          </div>
        </div>
        <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center md:w-auto">
          <div
            role="tablist"
            aria-label="Onde simular"
            className="flex w-full gap-1 rounded-xl border border-border/60 bg-muted/60 p-1 sm:w-auto"
          >
            <BotaoAba ativo={!naConta} onClick={() => onConta(null)} Icone={Building2}>
              Sua base
            </BotaoAba>
            <BotaoAba ativo={naConta} onClick={() => !naConta && setTimeout(() => abrirSeletor(), 0)} Icone={Users}>
              Assinante
            </BotaoAba>
          </div>
          <SeletorDeConta
            conta={conta}
            carregando={naConta && resolvida.isLoading}
            onEscolher={(c) => (c.id === contaId ? undefined : setPendente(c))}
          />
        </div>
      </div>
      <AlertDialog open={!!pendente} onOpenChange={(o) => !o && setPendente(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Simular para {pendente?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              O cliente desta simulação (nome, CPF, renda, contatos e dados do cônjuge) será copiado
              para a carteira de <strong>{pendente?.nome}</strong> e ficará visível para a equipe
              dessa conta. Confirme só se o cliente é atendido por ela.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendente) onConta(pendente.id);
                setPendente(null);
              }}
            >
              Simular para esta conta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {contaInvalida && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
          <Info className="size-3.5" /> Conta não encontrada. Escolha outra ou volte para a sua base.
        </p>
      )}
    </div>
  );
}

/** Abre o combobox (aba "Assinante" sem conta escolhida). */
function abrirSeletor() {
  document.getElementById("destino-simulacao-conta")?.click();
}

function BotaoAba({
  ativo,
  onClick,
  Icone,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  Icone: typeof Users;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={ativo}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[10px] px-3.5 text-[13px] font-semibold transition-all duration-200 sm:flex-none",
        ativo
          ? "bg-background text-primary shadow-sm ring-1 ring-primary/15"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icone className="size-4 shrink-0" />
      {children}
    </button>
  );
}

function Avatar({ conta }: { conta: Pick<ContaFiltro, "nome" | "tipo"> }) {
  // Peça 3D do Agilliza com as iniciais da conta e o selo do tipo.
  return (
    <span aria-hidden className="relative inline-flex shrink-0">
      <Icone3D tom={conta.tipo === "imobiliaria" ? "marca" : "info"} tamanho="sm">
        <span className="relative z-[1] text-[10px] font-semibold">{iniciais(conta.nome)}</span>
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

function SeletorDeConta({
  conta,
  carregando,
  onEscolher,
}: {
  conta: ContaFiltro | null;
  carregando: boolean;
  onEscolher: (c: ContaDestino) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [termo, setTermo] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTermo(busca.trim()), 250);
    return () => clearTimeout(t);
  }, [busca]);
  const buscarFn = useServerFn(buscarContasDoFiltro);
  const contas = useInfiniteQuery({
    queryKey: ["destino-simulacao-contas", termo],
    queryFn: ({ pageParam }) =>
      buscarFn({ data: { termo: termo || null, pagina: pageParam, porPagina: 20 } }),
    initialPageParam: 1,
    getNextPageParam: (ultima, todas) =>
      todas.length * (ultima.porPagina || 20) < ultima.total ? todas.length + 1 : undefined,
    enabled: aberto,
    staleTime: 60_000,
  });
  const lista = useMemo(() => (contas.data?.pages ?? []).flatMap((p) => p.contas), [contas.data]);
  const total = contas.data?.pages?.[0]?.total ?? 0;

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
          id="destino-simulacao-conta"
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={aberto}
          aria-label="Escolher a conta do assinante"
          className="h-11 w-full min-w-0 justify-between gap-2 rounded-xl border-border/70 bg-card px-2.5 font-normal shadow-sm hover:border-primary/30 sm:h-10 sm:w-72"
        >
          <span className="flex min-w-0 items-center gap-2">
            {carregando ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : conta ? (
              <Avatar conta={conta} />
            ) : (
              <Users className="size-4 text-muted-foreground" />
            )}
            <span className={cn("truncate text-sm", !conta && "text-muted-foreground")}>
              {carregando ? "Carregando conta…" : (conta?.nome ?? "Escolher assinante…")}
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,22rem)] p-0" align="end">
        <Command shouldFilter={false}>
          <CommandInput
            value={busca}
            onValueChange={setBusca}
            placeholder="Nome, CRECI, e-mail ou CPF/CNPJ completo…"
            className="text-base sm:text-sm"
          />
          <CommandList className="max-h-[min(60vh,22rem)]">
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
                {termo ? "Nenhuma conta encontrada com essa busca." : "Nenhuma conta de assinante ainda."}
              </div>
            )}
            {lista.length > 0 && (
              <CommandGroup heading="Corretores e imobiliárias">
                {lista.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.id}
                    onSelect={() => {
                      onEscolher({ id: c.id, nome: c.nome, tipo: c.tipo });
                      setAberto(false);
                      setBusca("");
                    }}
                    className="min-h-12 gap-2.5 py-2"
                  >
                    <Avatar conta={c} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.nome}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {tipoDaConta(c.tipo)}
                        {c.creci ? ` · CRECI ${c.creci}${c.creci_uf ? `/${c.creci_uf}` : ""}` : ""}
                        {typeof c.clientes === "number"
                          ? ` · ${c.clientes} cliente${c.clientes === 1 ? "" : "s"}`
                          : ""}
                      </span>
                    </span>
                    {c.vinculo_agilliza && (
                      <Link2 className="size-3.5 shrink-0 text-primary" aria-label="Vinculada ao Agilliza" />
                    )}
                    <Check
                      className={cn("size-4 shrink-0 text-primary", conta?.id === c.id ? "opacity-100" : "opacity-0")}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
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
                  {contas.isFetchingNextPage && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
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
