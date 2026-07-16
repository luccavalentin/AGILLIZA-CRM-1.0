import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
  User as UserIcon,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  listarSimulacoes,
  excluirSimulacao,
  restaurarSimulacao,
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
import { SelecionarBancosPdfDialog } from "@/components/simulacao/selecionar-bancos-pdf-dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listarColegas } from "@/lib/operacional/shared.functions";
import { UsuarioCombobox } from "@/components/operacional/usuario-combobox";
import {
  AcoesSimulacao,
  DetalheSimulacoes,
  ProdutoBadge,
  statusLabel,
} from "@/components/simulacao/lista-detalhe";

/** Primeiro e último dia do mês atual como intervalo ISO (filtro padrão). */
function intervaloMesAtual(): { inicio: string; fim: string } {
  const agora = new Date();
  const primeiro = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const ultimo = new Date(agora.getFullYear(), agora.getMonth() + 1, 0);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { inicio: iso(primeiro), fim: iso(ultimo) };
}




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
  const restaurar = useServerFn(restaurarSimulacao);
  const criar = useServerFn(criarProposta);

  const obter = useServerFn(obterSimulacao);
  const listarColegasFn = useServerFn(listarColegas);
  const padrao = useMemo(() => intervaloMesAtual(), []);
  const [escopo, setEscopo] = useState<"todas" | "minhas">("minhas");
  const [q, setQ] = useState("");
  const [busca, setBusca] = useState("");
  const [desde, setDesde] = useState(padrao.inicio);
  const [ate, setAte] = useState(padrao.fim);
  const [responsavel, setResponsavel] = useState<string>("todos");
  const [kpiAberto, setKpiAberto] = useState<string | null>(null);
  const [verExcluidas, setVerExcluidas] = useState(false);

  const { data: colegas } = useQuery({
    queryKey: ["colegas"],
    queryFn: () => listarColegasFn(),
    staleTime: 5 * 60_000,
  });

  // Envio de proposta: diálogo para escolher UM banco por vez.
  const [envio, setEnvio] = useState<{
    id: string;
    numero: string;
    bancos: any[];
  } | null>(null);
  const [envioCarregando, setEnvioCarregando] = useState(false);
  const [enviandoBancoId, setEnviandoBancoId] = useState<string | null>(null);
  const [propostasCriadas, setPropostasCriadas] = useState<
    Array<{ simulacao_banco_id: string; banco_id: string; nome_banco: string; proposta_id: string; numero: string }>
  >([]);


  const { data, isLoading } = useQuery({
    queryKey: ["simulacoes", escopo, busca, desde, ate, responsavel, verExcluidas],
    queryFn: () =>
      listarSimulacoes({
        data: {
          escopo,
          q: busca || undefined,
          desde: desde || undefined,
          ate: ate || undefined,
          responsavel:
            escopo === "todas" && responsavel !== "todos" ? responsavel : undefined,
          pagina: 1,
          porPagina: 30,
          apenas_excluidas: verExcluidas,
        },
      }),
  });

  async function handleExcluir(id: string) {
    try {
      await excluir({ data: { id } });
      toast.success("Simulação excluída.");
      queryClient.invalidateQueries({ queryKey: ["simulacoes"] });
      queryClient.invalidateQueries({ queryKey: ["crm-painel"] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
    } catch {
      toast.error("Não foi possível excluir a simulação.");
    }
  }

  async function handleRestaurar(id: string) {
    try {
      await restaurar({ data: { id } });
      toast.success("Simulação restaurada.");
      queryClient.invalidateQueries({ queryKey: ["simulacoes"] });
    } catch {
      toast.error("Não foi possível restaurar a simulação.");
    }
  }

  function formatDataHora(v?: string | null) {
    if (!v) return "—";
    try {
      return new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo",   dateStyle: "short", timeStyle: "short" });
    } catch {
      return "—";
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

  // Diálogo para o usuário escolher qual banco baixar em detalhe.
  const [detalhePdf, setDetalhePdf] = useState<{ simulacao: any; bancos: any[] } | null>(null);

  async function handleBaixarDetalhada(id: string) {
    try {
      const dados = await obter({ data: { id } });
      if (!dados.bancos?.length) {
        toast.error("Esta simulação não possui bancos para baixar.");
        return;
      }
      setDetalhePdf({ simulacao: dados.simulacao, bancos: dados.bancos });
    } catch {
      toast.error("Não foi possível abrir a simulação.");
    }
  }

  async function handleEditar(id: string) {
    // "Editar" gera uma nova simulação a partir dos dados desta, sem herdar
    // IDs, número, operação bancária, e-mail verificado, PDFs ou bancos já
    // simulados. Reutiliza o fluxo de duplicação para isolamento total.
    router.navigate({
      to: "/operacional/simulacoes/completa",
      search: { duplicar: id },
    });
  }


  async function handleEnviarProposta(id: string, numero: string) {
    setEnvio({ id, numero, bancos: [] });
    setPropostasCriadas([]);
    setEnviandoBancoId(null);
    setEnvioCarregando(true);
    try {
      const dados = await obter({ data: { id } });
      const simulados = (dados.bancos ?? []).filter(
        (b: any) => b.status_banco === "simulada" && b.banco_id,
      );
      setEnvio({ id, numero, bancos: simulados });
    } catch {
      toast.error("Não foi possível carregar os bancos da simulação.");
      setEnvio(null);
    } finally {
      setEnvioCarregando(false);
    }
  }

  async function enviarBancoIndividual(banco: any) {
    if (!envio || enviandoBancoId) return;
    setEnviandoBancoId(banco.id);
    try {
      const res = await criar({
        data: { simulacao_id: envio.id, simulacao_banco_id: banco.id },
      });
      toast.success(`Proposta ${res.numero_proposta} criada para ${banco.nome_banco}.`);
      setPropostasCriadas((prev) => [
        ...prev,
        {
          simulacao_banco_id: banco.id,
          banco_id: banco.banco_id,
          nome_banco: banco.nome_banco,
          proposta_id: res.proposta_id,
          numero: res.numero_proposta,
        },
      ]);
      queryClient.invalidateQueries({ queryKey: ["simulacoes"] });
      queryClient.invalidateQueries({ queryKey: ["propostas"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar a proposta.");
    } finally {
      setEnviandoBancoId(null);
    }
  }


  const itens = data?.itens ?? [];
  const kpiTotal = data?.total ?? itens.length;
  const kpiValor = itens.reduce((acc, s) => acc + (Number(s.valor_financiamento) || 0), 0);
  const bancosUnicos = new Set<string>();
  itens.forEach((s) => {
    (Array.isArray(s.bancos) ? s.bancos : []).forEach((b: any) => {
      bancosUnicos.add(String(b.nome_banco ?? b.nome ?? b.banco_nome ?? "Banco"));
    });
  });
  const kpiBancos = bancosUnicos.size;
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
      const nome = b.nome_banco ?? b.nome ?? b.banco_nome ?? "Banco";
      acc[nome] = (acc[nome] ?? 0) + 1;
    });
    return acc;
  }, {});
  const prazoMin = prazos.length ? Math.min(...prazos) : 0;
  const prazoMax = prazos.length ? Math.max(...prazos) : 0;

  function irParaSimulacao(id: string) {
    setKpiAberto(null);
    router.navigate({ to: "/operacional/simulacoes/$id", params: { id } });
  }

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
      icon: Calculator,
      detalhe: (
        <DetalheSimulacoes
          descricao="Todas as simulações do filtro atual."
          resumo={Object.entries(porStatus)
            .sort((a, b) => b[1] - a[1])
            .map(([status, qtd]) => ({ rotulo: statusLabel(status), valor: String(qtd) }))}
          itens={itens}
          destaque="status"
          onAbrir={irParaSimulacao}
        />
      ),
    },
    {
      id: "volume",
      label: "Volume simulado",
      valor: formatBRL(kpiValor),
      icon: Calculator,
      detalhe: (
        <DetalheSimulacoes
          descricao="Valor de financiamento de cada simulação."
          resumo={[{ rotulo: "Volume total", valor: formatBRL(kpiValor) }]}
          itens={itens
            .slice()
            .sort(
              (a, b) =>
                (Number(b.valor_financiamento) || 0) - (Number(a.valor_financiamento) || 0),
            )}
          destaque="financiamento"
          onAbrir={irParaSimulacao}
        />
      ),
    },
    {
      id: "bancos",
      label: "Bancos cotados",
      valor: String(kpiBancos),
      icon: Building2,
      detalhe: (
        <DetalheSimulacoes
          descricao="Bancos distintos cotados no filtro atual (com o total de cotações de cada um)."
          resumo={Object.entries(porBanco)
            .sort((a, b) => b[1] - a[1])
            .map(([nome, qtd]) => ({ rotulo: nome, valor: String(qtd) }))}
          itens={itens.filter((s) => Array.isArray(s.bancos) && s.bancos.length > 0)}
          destaque="bancos"
          onAbrir={irParaSimulacao}
        />
      ),
    },
    {
      id: "prazo",
      label: "Prazo médio",
      valor: kpiPrazo ? `${kpiPrazo} meses` : "—",
      icon: Clock,
      detalhe: (
        <DetalheSimulacoes
          descricao="Prazo contratado em cada simulação."
          resumo={[
            { rotulo: "Prazo mínimo", valor: prazoMin ? `${prazoMin} meses` : "—" },
            { rotulo: "Prazo médio", valor: kpiPrazo ? `${kpiPrazo} meses` : "—" },
            { rotulo: "Prazo máximo", valor: prazoMax ? `${prazoMax} meses` : "—" },
          ]}
          itens={itens
            .slice()
            .sort((a, b) => (Number(b.prazo) || 0) - (Number(a.prazo) || 0))}
          destaque="prazo"
          onAbrir={irParaSimulacao}
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
                <Calculator className="h-4 w-4" />
                Simulação completa
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3.5 py-3.5 shadow-sm"
              >
                <div className="size-10 shrink-0 animate-pulse rounded-xl bg-muted" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                  <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted/70" />
                </div>
              </div>
            ))
          : kpis.map((k) => (
              <button
                key={k.label}
                type="button"
                onClick={() => setKpiAberto(k.id)}
                className="group relative flex flex-col items-start gap-2.5 overflow-hidden rounded-xl border border-border/60 bg-card px-3.5 py-3.5 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:flex-row sm:items-center sm:gap-3"
              >
                <span className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-primary to-primary/40 transition-transform duration-300 group-hover:scale-x-100" />
                <span className="absolute left-0 top-0 h-full w-[3px] rounded-r bg-primary/60" />
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15 transition-colors group-hover:bg-primary/15">
                  <k.icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-base font-semibold leading-tight tracking-tight tabular-nums text-foreground sm:text-xl">{k.valor}</p>
                  <p className="mt-0.5 text-[10.5px] font-medium uppercase leading-tight tracking-wide text-muted-foreground">{k.label}</p>
                </div>
                <span className="ml-auto hidden shrink-0 text-[10px] font-medium text-primary/0 transition-colors group-hover:text-primary/70 sm:block">
                  ver detalhes
                </span>

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
          {escopo === "todas" && (
            <UsuarioCombobox
              value={responsavel}
              onValueChange={setResponsavel}
              usuarios={colegas ?? []}
              className="h-9 w-full sm:w-56"
            />
          )}
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
            <Button
              variant="ghost"
              size="sm"
              className="h-9 shrink-0"
              onClick={() => {
                setDesde(padrao.inicio);
                setAte(padrao.fim);
                setResponsavel("todos");
              }}
            >
              Limpar
            </Button>
            <Button
              variant={verExcluidas ? "default" : "outline"}
              size="sm"
              className="h-9 shrink-0"
              onClick={() => setVerExcluidas((v) => !v)}
              title="Ver simulações excluídas"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              {verExcluidas ? "Ver ativas" : "Excluídas"}
            </Button>
          </div>
        </div>
      </div>




      {/* Ações reutilizáveis por item */}
      {(() => null)()}

      {/* Tabela (telas médias e maiores) */}
      <div className="hidden overflow-x-auto rounded-lg border border-border/60 bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-border/60 bg-muted/50 hover:bg-muted/50">
              <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Número</TableHead>
              <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Cliente</TableHead>
              <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Produto</TableHead>
              <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Bancos simulados</TableHead>
              <TableHead className="h-10 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Valor imóvel</TableHead>
              <TableHead className="h-10 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Prazo</TableHead>
              <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
              <TableHead className="h-10 w-12 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ações</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={`sk-${i}`} className="border-border/50">
                  {Array.from({ length: 8 }).map((__, j) => (
                    <TableCell key={j} className="py-3.5">
                      <div
                        className="h-4 animate-pulse rounded bg-muted"
                        style={{ width: `${[60, 80, 55, 70, 65, 45, 55, 30][j]}%` }}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
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
                className="group cursor-pointer border-border/50 transition-colors odd:bg-muted/[0.18] hover:bg-primary/[0.06]"
                onClick={() => (verExcluidas ? undefined : handleEditar(s.id))}
              >
                <TableCell className="py-3.5">
                  <span className="inline-flex items-center rounded-md bg-primary/5 px-2 py-0.5 font-mono text-[13px] font-semibold text-primary ring-1 ring-inset ring-primary/10 transition-colors group-hover:bg-primary/10">
                    {s.numero_simulacao}
                  </span>
                </TableCell>

                <TableCell className="py-3.5 font-medium text-foreground">
                  {s.nome_cliente ?? "—"}
                  {escopo === "todas" && s.nome_responsavel && (
                    <span className="mt-0.5 flex items-center gap-1 text-[11px] font-normal text-muted-foreground">
                      <UserIcon className="h-3 w-3 shrink-0" />
                      <span className="truncate">{s.nome_responsavel}</span>
                    </span>
                  )}
                  {verExcluidas && (
                    <span className="mt-1 block text-[11px] font-normal text-destructive">
                      Excluída por {s.nome_excluidor ?? "—"} · {formatDataHora(s.deleted_at)}
                      {s.deleted_motivo ? ` · ${s.deleted_motivo}` : ""}
                    </span>
                  )}
                </TableCell>
                <TableCell className="py-3.5">
                  <ProdutoBadge produto={s.produto} />
                </TableCell>
                <TableCell className="py-3.5">
                  <BancosSimulados bancos={s.bancos} />
                </TableCell>
                <TableCell className="py-3.5 text-right font-semibold tabular-nums text-foreground">
                  {formatBRL(s.valor_imovel)}
                </TableCell>
                <TableCell className="py-3.5 text-right tabular-nums text-muted-foreground">
                  {s.prazo ? `${s.prazo} meses` : "—"}
                </TableCell>
                <TableCell>
                  <SimulacaoStatusBadge status={s.status} />
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  {verExcluidas ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-lg"
                      onClick={() => handleRestaurar(s.id)}
                    >
                      <Undo2 className="mr-1 h-3.5 w-3.5" /> Restaurar
                    </Button>
                  ) : (
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        title="Ver detalhes"
                        aria-label="Ver detalhes da simulação"
                        onClick={() =>
                          router.navigate({
                            to: "/operacional/simulacoes/$id",
                            params: { id: s.id },
                          })
                        }
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
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
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Cartões (telas pequenas) */}
      <div className="space-y-3 md:hidden">
        {isLoading &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={`skm-${i}`} className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-40 animate-pulse rounded bg-muted/70" />
                </div>
                <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
              </div>
              <div className="mt-4 h-14 animate-pulse rounded-lg bg-muted/50" />
            </div>
          ))}
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
            onClick={() => (verExcluidas ? undefined : handleEditar(s.id))}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono font-semibold text-primary">{s.numero_simulacao}</p>
                <p className="truncate text-sm font-medium text-foreground">{s.nome_cliente ?? "—"}</p>
                {escopo === "todas" && s.nome_responsavel && (
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <UserIcon className="h-3 w-3 shrink-0" />
                    <span className="truncate">{s.nome_responsavel}</span>
                  </p>
                )}
                {verExcluidas && (
                  <p className="mt-1 text-[11px] font-medium text-destructive">
                    Excluída por {s.nome_excluidor ?? "—"} · {formatDataHora(s.deleted_at)}
                    {s.deleted_motivo ? ` · ${s.deleted_motivo}` : ""}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <SimulacaoStatusBadge status={s.status} />
                {verExcluidas ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-lg"
                    onClick={() => handleRestaurar(s.id)}
                  >
                    <Undo2 className="mr-1 h-3.5 w-3.5" /> Restaurar
                  </Button>
                ) : (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      title="Ver detalhes"
                      aria-label="Ver detalhes da simulação"
                      onClick={() =>
                        router.navigate({
                          to: "/operacional/simulacoes/$id",
                          params: { id: s.id },
                        })
                      }
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
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
                  </>
                )}
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
              Envie a proposta{" "}
              {envio?.numero ? `da simulação ${envio.numero}` : ""} para cada banco individualmente.
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
                const criada = propostasCriadas.find((p) => p.simulacao_banco_id === b.id);
                const esteEnviando = enviandoBancoId === b.id;
                const cor = corDoBanco(b.nome_banco);
                return (
                  <div
                    key={b.id}
                    style={criada ? { borderColor: cor } : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors",
                      criada ? "border-2" : "border-border",
                    )}
                  >
                    <BancoLogo nome={b.nome_banco} size="lg" className="shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                          {b.nome_banco}
                        </span>
                        {(() => {
                          // Prioriza o sistema REQUISITADO na simulação. O retorno
                          // da API (sistema_amortizacao_banco) é usado só como
                          // fallback porque o Santander devolve "SAC" mesmo em
                          // simulações executadas em PRICE.
                          const req = String(b.sistema_amortizacao ?? "").toUpperCase();
                          const api = String(b.sistema_amortizacao_banco ?? "").toUpperCase();
                          const sis =
                            req === "P" || req.includes("PRICE")
                              ? "PRICE"
                              : req === "S" || req.includes("SAC")
                                ? "SAC"
                                : api === "P" || api.includes("PRICE")
                                  ? "PRICE"
                                  : api === "S" || api.includes("SAC")
                                    ? "SAC"
                                    : null;
                          if (!sis) return null;
                          return (
                            <span className="inline-flex h-5 shrink-0 items-center rounded-[5px] border border-primary/25 bg-primary/[0.08] px-1.5 text-[9px] font-semibold uppercase leading-none tracking-wide text-primary">
                              {sis}
                            </span>
                          );
                        })()}
                      </span>
                      {b.valor_parcela != null && (
                        <span className="block text-xs text-muted-foreground">
                          Parcela {formatBRL(b.valor_parcela)}
                        </span>
                      )}
                    </span>
                    {criada ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEnvio(null);
                          router.navigate({
                            to: "/operacional/propostas/$id",
                            params: { id: criada.proposta_id },
                            search: { complementar: 1 },
                          });
                        }}
                      >
                        Abrir {criada.numero}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => enviarBancoIndividual(b)}
                        disabled={!!enviandoBancoId}
                      >
                        <Send className="mr-1.5 h-3.5 w-3.5" />
                        {esteEnviando ? "Enviando…" : "Enviar"}
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEnvio(null)}
              disabled={!!enviandoBancoId}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SelecionarBancosPdfDialog
        open={!!detalhePdf}
        onOpenChange={(o) => (!o ? setDetalhePdf(null) : null)}
        simulacao={detalhePdf?.simulacao}
        bancos={detalhePdf?.bancos ?? []}
        modo="detalhada"
      />
    </div>
  );
}



