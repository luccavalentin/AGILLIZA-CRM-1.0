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
  const [kpiAberto, setKpiAberto] = useState<string | null>(null);

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

  // Agregações para o detalhamento dos KPIs (o que cada card "guarda").
  const porStatus = itens.reduce<Record<string, number>>((acc, s) => {
    const st = (s as any).status ?? "—";
    acc[st] = (acc[st] ?? 0) + 1;
    return acc;
  }, {});
  const porBanco = itens.reduce<Record<string, number>>((acc, s) => {
    (Array.isArray(s.bancos) ? s.bancos : []).forEach((b: any) => {
      const nome = b.nome ?? b.banco_nome ?? b.banco_id ?? "Banco";
      acc[nome] = (acc[nome] ?? 0) + 1;
    });
    return acc;
  }, {});
  const prazoMin = prazos.length ? Math.min(...prazos) : 0;
  const prazoMax = prazos.length ? Math.max(...prazos) : 0;

  const kpis: {
    id: string;
    label: string;
    valor: string;
    icon: typeof ListChecks;
    detalhe: React.ReactNode;
  }[] = [
    {
      id: "simulacoes",
      label: "Simulações",
      valor: String(kpiTotal),
      icon: ListChecks,
      detalhe: (
        <KpiDetalhe
          descricao="Total de simulações no filtro atual, agrupadas por status."
          linhas={Object.entries(porStatus)
            .sort((a, b) => b[1] - a[1])
            .map(([status, qtd]) => ({
              rotulo: statusLabel(status),
              valor: String(qtd),
            }))}
          total={{ rotulo: "Total", valor: String(kpiTotal) }}
        />
      ),
    },
    {
      id: "volume",
      label: "Volume em imóveis",
      valor: formatBRL(kpiValor),
      icon: Wallet,
      detalhe: (
        <KpiDetalhe
          descricao="Soma dos valores de imóvel de cada simulação."
          linhas={itens
            .slice()
            .sort((a, b) => (Number(b.valor_imovel) || 0) - (Number(a.valor_imovel) || 0))
            .map((s) => ({
              rotulo: `${s.numero_simulacao} · ${s.nome_cliente ?? "—"}`,
              valor: formatBRL(Number(s.valor_imovel) || 0),
            }))}
          total={{ rotulo: "Volume total", valor: formatBRL(kpiValor) }}
        />
      ),
    },
    {
      id: "bancos",
      label: "Cotações em bancos",
      valor: String(kpiBancos),
      icon: Building2,
      detalhe: (
        <KpiDetalhe
          descricao="Quantidade de cotações por banco no filtro atual."
          linhas={Object.entries(porBanco)
            .sort((a, b) => b[1] - a[1])
            .map(([nome, qtd]) => ({ rotulo: nome, valor: String(qtd) }))}
          total={{ rotulo: "Total de cotações", valor: String(kpiBancos) }}
        />
      ),
    },
    {
      id: "prazo",
      label: "Prazo médio",
      valor: kpiPrazo ? `${kpiPrazo} meses` : "—",
      icon: Clock,
      detalhe: (
        <KpiDetalhe
          descricao="Distribuição dos prazos das simulações."
          linhas={[
            { rotulo: "Prazo mínimo", valor: prazoMin ? `${prazoMin} meses` : "—" },
            { rotulo: "Prazo médio", valor: kpiPrazo ? `${kpiPrazo} meses` : "—" },
            { rotulo: "Prazo máximo", valor: prazoMax ? `${prazoMax} meses` : "—" },
          ]}
          total={{ rotulo: "Simulações com prazo", valor: String(prazos.length) }}
        />
      ),
    },
  ];

  return (

    <div className="mx-auto w-full max-w-[1600px] space-y-5 p-4 md:p-6">
      {/* Cabeçalho */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-card p-4 md:p-6">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full opacity-70 blur-2xl"
          style={{ background: "color-mix(in oklab, var(--primary) 12%, transparent)" }}
        />
        <div className="relative grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary sm:text-[11px] sm:tracking-[0.18em]">
              <span className="inline-block h-1 w-5 shrink-0 rounded-full bg-primary sm:w-6" />
              Consultar simulações
            </p>
            <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-[28px]">
              Simulações
            </h1>
            <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
              Financiamento imobiliário e home equity, em um só lugar.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
            <Button asChild variant="outline" size="sm" className="h-9 gap-1.5">
              <Link to="/operacional/simulacoes/nova" search={{ modo: "rapida" }}>
                <Calculator className="h-4 w-4" />
                Simulação rápida
              </Link>
            </Button>
            <Button asChild size="sm" className="h-9 gap-1.5">
              <Link to="/operacional/simulacoes/completa">
                <Send className="h-4 w-4" />
                Simulação completa
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {kpis.map((k) => (
          <button
            key={k.label}
            type="button"
            onClick={() => setKpiAberto(k.id)}
            className="group relative flex items-center gap-3 overflow-hidden rounded-xl border border-border/60 bg-card px-3.5 py-3 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <span className="absolute left-0 top-0 h-full w-[3px] rounded-r bg-primary/60" />
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
              <k.icon className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-mono text-lg font-semibold tracking-tight tabular-nums text-foreground">{k.valor}</p>
              <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{k.label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Detalhe do KPI clicado */}
      <Dialog open={!!kpiAberto} onOpenChange={(o) => !o && setKpiAberto(null)}>
        <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-lg">
          {(() => {
            const k = kpis.find((x) => x.id === kpiAberto);
            if (!k) return null;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
                      <k.icon className="size-4" />
                    </span>
                    {k.label}
                  </DialogTitle>
                  <DialogDescription>Valor atual: {k.valor}</DialogDescription>
                </DialogHeader>
                <div className="overflow-y-auto pr-1">{k.detalhe}</div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>


      {/* Barra de filtros */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={escopo} onValueChange={(v) => setEscopo(v as "todas" | "minhas")}>
          <TabsList className="h-9 w-full lg:w-auto">
            <TabsTrigger value="todas" className="flex-1 lg:flex-none">Gerais</TabsTrigger>
            <TabsTrigger value="minhas" className="flex-1 lg:flex-none">Minhas</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setBusca(q);
            }}
          >
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 w-full pl-9 sm:w-60"
                placeholder="Número, cliente ou documento"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary" size="sm" className="h-9 shrink-0">
              Buscar
            </Button>
          </form>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              aria-label="De"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="h-9 w-full sm:w-36"
            />
            <span className="text-xs text-muted-foreground">até</span>
            <Input
              type="date"
              aria-label="Até"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
              className="h-9 w-full sm:w-36"
            />
            {(desde || ate) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 shrink-0"
                onClick={() => {
                  setDesde("");
                  setAte("");
                }}
              >
                Limpar
              </Button>
            )}
          </div>
        </div>
      </div>



      {/* Ações reutilizáveis por item */}
      {(() => null)()}

      {/* Tabela (telas médias e maiores) */}
      <div className="hidden overflow-hidden rounded-lg border border-border/60 bg-card md:block">
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
                className="cursor-pointer border-border/50 transition-colors hover:bg-primary/5"
                onClick={() =>
                  router.navigate({ to: "/operacional/simulacoes/$id", params: { id: s.id } })
                }
              >
                <TableCell className="font-mono font-semibold text-primary">{s.numero_simulacao}</TableCell>

                <TableCell className="font-medium text-foreground">{s.nome_cliente ?? "—"}</TableCell>
                <TableCell>
                  <ProdutoBadge produto={s.produto} />
                </TableCell>
                <TableCell>
                  <BancosSimulados bancos={s.bancos} />
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums text-foreground">
                  {formatBRL(s.valor_imovel)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {s.prazo ? `${s.prazo} meses` : "—"}
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
            className="cursor-pointer rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-all active:scale-[0.99]"
            onClick={() =>
              router.navigate({ to: "/operacional/simulacoes/$id", params: { id: s.id } })
            }
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono font-semibold text-primary">{s.numero_simulacao}</p>
                <p className="truncate text-sm font-medium text-foreground">{s.nome_cliente ?? "—"}</p>
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

            <div className="mt-3 flex items-center gap-2">
              <ProdutoBadge produto={s.produto} />
              <span className="text-xs tabular-nums text-muted-foreground">
                {s.prazo ? `${s.prazo} meses` : "—"}
              </span>
            </div>

            <div className="mt-3 rounded-lg bg-muted/40 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Valor do imóvel</p>
              <p className="font-mono text-lg font-semibold tabular-nums text-foreground">
                {formatBRL(s.valor_imovel)}
              </p>
            </div>

            <div className="mt-3">
              <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Bancos simulados</p>
              <BancosSimulados bancos={s.bancos} />
            </div>
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

function ProdutoBadge({ produto }: { produto: string | null | undefined }) {
  if (produto === "home_equity") {
    return (
      <span className="inline-flex items-center rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
        Home Equity
      </span>
    );
  }
  if (produto === "financiamento_imobiliario") {
    return (
      <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
        Financiamento
      </span>
    );
  }
  return <span className="text-sm text-muted-foreground">—</span>;
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

