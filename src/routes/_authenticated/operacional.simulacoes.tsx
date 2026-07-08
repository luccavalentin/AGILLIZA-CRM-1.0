import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Search,
  Calculator,
  MoreHorizontal,
  Eye,
  Copy,
  Trash2,
  Download,
  Pencil,
  Send,
  ListChecks,
  Building2,
  Clock,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  listarSimulacoes,
  excluirSimulacao,
  obterSimulacao,
} from "@/lib/simulacao/simulacoes.functions";
import { criarProposta } from "@/lib/propostas/propostas.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SimulacaoStatusBadge } from "@/components/simulacao/status-badge";
import { BancosSimulados } from "@/components/simulacao/bancos-simulados";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { corDoBanco } from "@/lib/bancos/cores";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { formatBRL } from "@/lib/simulacao/format";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";


export const Route = createFileRoute("/_authenticated/operacional/simulacoes")({
  head: () => ({ meta: [{ title: "Simulações — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.simulacoes"),
  component: Pagina,
  errorComponent: () => (
    <div className="p-6 text-sm text-muted-foreground">
      Não foi possível carregar as simulações.
    </div>
  ),
});

function Pagina() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const excluir = useServerFn(excluirSimulacao);
  const criar = useServerFn(criarProposta);

  const obter = useServerFn(obterSimulacao);
  const [escopo, setEscopo] = useState<"todas" | "minhas">("todas");
  const [q, setQ] = useState("");
  const [busca, setBusca] = useState("");
  const [desde, setDesde] = useState("");
  const [ate, setAte] = useState("");

  // Envio de proposta: diálogo para escolher UM banco por vez.
  const [envio, setEnvio] = useState<{
    id: string;
    numero: string;
    bancos: any[];
  } | null>(null);
  const [envioCarregando, setEnvioCarregando] = useState(false);
  const [bancoSelecionado, setBancoSelecionado] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);


  const { data, isLoading } = useQuery({
    queryKey: ["simulacoes", escopo, busca, desde, ate],
    queryFn: () =>
      listarSimulacoes({
        data: {
          escopo,
          q: busca || undefined,
          desde: desde || undefined,
          ate: ate || undefined,
          pagina: 1,
          porPagina: 30,
        },
      }),
  });

  async function handleExcluir(id: string) {
    try {
      await excluir({ data: { id } });
      toast.success("Simulação excluída.");
      queryClient.invalidateQueries({ queryKey: ["simulacoes"] });
    } catch {
      toast.error("Não foi possível excluir a simulação.");
    }
  }

  function handleDuplicar(id: string) {
    router.navigate({
      to: "/operacional/simulacoes/completa",
      search: { duplicar: id },
    });
  }

  async function handleBaixarComparativo(id: string) {
    try {
      const dados = await obter({ data: { id } });
      const { baixarSimulacaoPDF } = await import("@/lib/simulacao/simulacao-pdf");
      baixarSimulacaoPDF({ simulacao: dados.simulacao, bancos: dados.bancos });
    } catch {
      toast.error("Não foi possível gerar o PDF da simulação.");
    }
  }

  async function handleBaixarDetalhada(id: string) {
    try {
      const dados = await obter({ data: { id } });
      const { baixarSimulacaoDetalhadaPDF } = await import("@/lib/simulacao/simulacao-pdf");
      baixarSimulacaoDetalhadaPDF({ simulacao: dados.simulacao, bancos: dados.bancos });
    } catch {
      toast.error("Não foi possível gerar o PDF da simulação.");
    }
  }

  async function handleEditar(id: string) {
    try {
      const { simulacao } = await obter({ data: { id } });
      sessionStorage.setItem("simulacao_wizard", JSON.stringify(simulacao));
      toast.info("Dados carregados no formulário para edição.");
      router.navigate({ to: "/operacional/simulacoes/completa" });
    } catch {
      toast.error("Não foi possível abrir a simulação para edição.");
    }
  }

  async function handleEnviarProposta(id: string, numero: string) {
    setEnvio({ id, numero, bancos: [] });
    setBancoSelecionado(null);
    setEnvioCarregando(true);
    try {
      const dados = await obter({ data: { id } });
      const simulados = (dados.bancos ?? []).filter(
        (b: any) => b.status_banco === "simulada" && b.banco_id,
      );
      setEnvio({ id, numero, bancos: simulados });
      if (simulados.length === 1) setBancoSelecionado(simulados[0].banco_id);
    } catch {
      toast.error("Não foi possível carregar os bancos da simulação.");
      setEnvio(null);
    } finally {
      setEnvioCarregando(false);
    }
  }

  async function confirmarEnvio() {
    if (!envio || !bancoSelecionado) return;
    setEnviando(true);
    try {
      const res = await criar({
        data: { simulacao_id: envio.id, banco_id: bancoSelecionado },
      });
      toast.success(`Proposta ${res.numero_proposta} criada.`);
      setEnvio(null);
      router.navigate({
        to: "/operacional/propostas/$id",
        params: { id: res.proposta_id },
        search: { complementar: 1 },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar a proposta.");
    } finally {
      setEnviando(false);
    }
  }


  const itens = data?.itens ?? [];
  const kpiTotal = data?.total ?? itens.length;
  const kpiValor = itens.reduce((acc, s) => acc + (Number(s.valor_imovel) || 0), 0);
  const kpiBancos = itens.reduce(
    (acc, s) => acc + (Array.isArray(s.bancos) ? s.bancos.length : 0),
    0,
  );
  const prazos = itens.map((s) => Number(s.prazo)).filter((n) => n > 0);
  const kpiPrazo = prazos.length
    ? Math.round(prazos.reduce((a, b) => a + b, 0) / prazos.length)
    : 0;
  const kpis = [
    { label: "Simulações", valor: String(kpiTotal), icon: ListChecks },
    { label: "Volume em imóveis", valor: formatBRL(kpiValor), icon: Wallet },
    { label: "Cotações em bancos", valor: String(kpiBancos), icon: Building2 },
    { label: "Prazo médio", valor: kpiPrazo ? `${kpiPrazo} meses` : "—", icon: Clock },
  ];

  return (

    <div className="mx-auto w-full max-w-[1600px] space-y-6 p-4 md:p-6">
      {/* Cabeçalho */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-primary/5 p-5 shadow-sm md:p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-primary/80">
              Consultar simulações
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">Simulações</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Financiamento imobiliário e home equity, em um só lugar.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              asChild
              variant="outline"
              className="group h-11 gap-2.5 border-border/70 bg-card px-4 shadow-sm transition-all hover:border-primary/40 hover:bg-accent hover:shadow-md"
            >
              <Link to="/operacional/simulacoes/nova" search={{ modo: "rapida" }}>
                <span className="flex flex-col items-start leading-tight">
                  <span className="text-sm font-semibold">Simulação rápida</span>
                  <span className="text-[11px] font-normal text-muted-foreground">
                    Cálculo imediato
                  </span>
                </span>
              </Link>
            </Button>
            <Button
              asChild
              className="group h-11 gap-2.5 px-4 shadow-sm transition-all hover:shadow-md"
            >
              <Link to="/operacional/simulacoes/completa">
                <span className="flex flex-col items-start leading-tight">
                  <span className="text-sm font-semibold">Simulação completa</span>
                  <span className="text-[11px] font-normal text-primary-foreground/70">
                    Envio aos bancos
                  </span>
                </span>
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <k.icon className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold tabular-nums text-foreground">{k.valor}</p>
              <p className="truncate text-xs text-muted-foreground">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Barra de filtros */}
      <div className="rounded-xl border border-border/60 bg-card p-3 shadow-sm md:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={escopo} onValueChange={(v) => setEscopo(v as "todas" | "minhas")}>
            <TabsList>
              <TabsTrigger value="todas">Gerais</TabsTrigger>
              <TabsTrigger value="minhas">Minhas</TabsTrigger>
            </TabsList>
          </Tabs>
          <form
            className="flex w-full max-w-sm items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setBusca(q);
            }}
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Número, cliente ou documento"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary">
              Buscar
            </Button>
          </form>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-border/50 pt-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">De</label>
            <Input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Até</label>
            <Input
              type="date"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
              className="w-40"
            />
          </div>
          {(desde || ate) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDesde("");
                setAte("");
              }}
            >
              Limpar datas
            </Button>
          )}
        </div>
      </div>


      {/* Ações reutilizáveis por item */}
      {(() => null)()}

      {/* Tabela (telas médias e maiores) */}
      <div className="hidden overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-border/60 bg-muted/40 hover:bg-muted/40">
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Número</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cliente</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Produto</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bancos simulados</TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Valor imóvel</TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prazo</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</TableHead>
              <TableHead className="w-12 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ações</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && (data?.itens.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={8}>
                  <div className="flex flex-col items-center gap-3 py-12 text-center">
                    <Calculator className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Nenhuma simulação encontrada.</p>
                    <Button asChild size="sm">
                      <Link to="/operacional/simulacoes/completa">Criar primeira simulação</Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {data?.itens.map((s) => (
              <TableRow
                key={s.id}
                className="cursor-pointer"
                onClick={() =>
                  router.navigate({ to: "/operacional/simulacoes/$id", params: { id: s.id } })
                }
              >
                <TableCell className="font-medium">{s.numero_simulacao}</TableCell>
                <TableCell>{s.nome_cliente ?? "—"}</TableCell>
                <TableCell>
                  {s.produto === "home_equity"
                    ? "Home Equity"
                    : s.produto === "financiamento_imobiliario"
                      ? "Financiamento"
                      : "—"}
                </TableCell>
                <TableCell>
                  <BancosSimulados bancos={s.bancos} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatBRL(s.valor_imovel)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {s.prazo ? `${s.prazo}m` : "—"}
                </TableCell>
                <TableCell>
                  <SimulacaoStatusBadge status={s.status} />
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <AcoesSimulacao
                    onVisualizar={() =>
                      router.navigate({
                        to: "/operacional/simulacoes/$id",
                        params: { id: s.id },
                      })
                    }
                    onEditar={() => handleEditar(s.id)}
                    onBaixarComparativo={() => handleBaixarComparativo(s.id)}
                    onBaixarDetalhada={() => handleBaixarDetalhada(s.id)}
                    onDuplicar={() => handleDuplicar(s.id)}
                    onEnviarProposta={() => handleEnviarProposta(s.id, s.numero_simulacao)}
                    onExcluir={() => handleExcluir(s.id)}
                    numero={s.numero_simulacao}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Cartões (telas pequenas) */}
      <div className="space-y-3 md:hidden">
        {isLoading && (
          <p className="py-10 text-center text-sm text-muted-foreground">Carregando…</p>
        )}
        {!isLoading && (data?.itens.length ?? 0) === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-border py-12 text-center">
            <Calculator className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhuma simulação encontrada.</p>
            <Button asChild size="sm">
              <Link to="/operacional/simulacoes/completa">Criar primeira simulação</Link>
            </Button>
          </div>
        )}
        {data?.itens.map((s) => (
          <div
            key={s.id}
            className="cursor-pointer rounded-lg border border-border p-4"
            onClick={() =>
              router.navigate({ to: "/operacional/simulacoes/$id", params: { id: s.id } })
            }
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{s.numero_simulacao}</p>
                <p className="truncate text-sm text-muted-foreground">{s.nome_cliente ?? "—"}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <SimulacaoStatusBadge status={s.status} />
                <AcoesSimulacao
                  onVisualizar={() =>
                    router.navigate({
                      to: "/operacional/simulacoes/$id",
                      params: { id: s.id },
                    })
                  }
                  onEditar={() => handleEditar(s.id)}
                  onBaixarComparativo={() => handleBaixarComparativo(s.id)}
                  onBaixarDetalhada={() => handleBaixarDetalhada(s.id)}
                  onDuplicar={() => handleDuplicar(s.id)}
                  onEnviarProposta={() => handleEnviarProposta(s.id, s.numero_simulacao)}
                  onExcluir={() => handleExcluir(s.id)}
                  numero={s.numero_simulacao}
                />
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Produto</dt>
                <dd className="text-foreground">
                  {s.produto === "home_equity"
                    ? "Home Equity"
                    : s.produto === "financiamento_imobiliario"
                      ? "Financiamento"
                      : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Prazo</dt>
                <dd className="tabular-nums text-foreground">{s.prazo ? `${s.prazo}m` : "—"}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">Valor do imóvel</dt>
                <dd className="tabular-nums text-foreground">{formatBRL(s.valor_imovel)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="mb-1 text-xs text-muted-foreground">Bancos simulados</dt>
                <dd>
                  <BancosSimulados bancos={s.bancos} />
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      {/* Enviar proposta: escolher UM banco por vez */}
      <Dialog open={!!envio} onOpenChange={(o) => !o && setEnvio(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar proposta</DialogTitle>
            <DialogDescription>
              Selecione o banco para o qual deseja enviar a proposta{" "}
              {envio?.numero ? `da simulação ${envio.numero}` : ""}. É permitido um banco por vez.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {envioCarregando ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Carregando bancos…</p>
            ) : (envio?.bancos.length ?? 0) === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhum banco simulado disponível para envio.
              </p>
            ) : (
              envio?.bancos.map((b: any) => {
                const marcado = bancoSelecionado === b.banco_id;
                const cor = corDoBanco(b.nome_banco);
                return (
                  <label
                    key={b.banco_id}
                    style={marcado ? { borderColor: cor } : undefined}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border bg-card p-3 transition-colors",
                      marcado ? "border-2" : "border-border hover:bg-accent",
                    )}
                  >
                    <Checkbox
                      checked={marcado}
                      onCheckedChange={(v) =>
                        setBancoSelecionado(v ? b.banco_id : null)
                      }
                    />
                    <BancoLogo nome={b.nome_banco} size="lg" className="shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {b.nome_banco}
                      </span>
                      {b.valor_parcela != null && (
                        <span className="block text-xs text-muted-foreground">
                          Parcela {formatBRL(b.valor_parcela)}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEnvio(null)} disabled={enviando}>
              Cancelar
            </Button>
            <Button onClick={confirmarEnvio} disabled={!bancoSelecionado || enviando}>
              {enviando ? "Enviando…" : "Enviar proposta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


function AcoesSimulacao({
  onVisualizar,
  onEditar,
  onBaixarComparativo,
  onBaixarDetalhada,
  onDuplicar,
  onEnviarProposta,
  onExcluir,
  numero,
}: {
  onVisualizar: () => void;
  onEditar: () => void;
  onBaixarComparativo: () => void;
  onBaixarDetalhada: () => void;
  onDuplicar: () => void;
  onEnviarProposta: () => void;
  onExcluir: () => Promise<void>;
  numero: string;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <ConfirmDelete
        titulo="Excluir simulação"
        descricao={`A simulação ${numero} será removida permanentemente.`}
        onConfirm={onExcluir}
        trigger={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Excluir simulação"
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        }
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Mais ações">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onVisualizar}>
            <Eye className="mr-2 h-4 w-4" /> Visualizar
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onEnviarProposta} className="text-primary focus:text-primary">
            <Send className="mr-2 h-4 w-4" /> Enviar proposta
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onEditar}>
            <Pencil className="mr-2 h-4 w-4" /> Editar
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onBaixarComparativo}>
            <Download className="mr-2 h-4 w-4" /> Baixar PDF comparativo
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onBaixarDetalhada}>
            <Download className="mr-2 h-4 w-4" /> Baixar PDF detalhado
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onDuplicar}>
            <Copy className="mr-2 h-4 w-4" /> Duplicar
          </DropdownMenuItem>
          <ConfirmDelete
            titulo="Excluir simulação"
            descricao={`A simulação ${numero} será removida permanentemente.`}
            onConfirm={onExcluir}
            trigger={
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={(e) => e.preventDefault()}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Excluir
              </DropdownMenuItem>
            }
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

