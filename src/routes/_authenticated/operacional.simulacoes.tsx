import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Calculator, ListChecks, Building2, Clock } from "lucide-react";
import { toast } from "sonner";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  listarSimulacoes,
  excluirSimulacao,
  restaurarSimulacao,
  obterSimulacao,
  destravarSimulacao,
} from "@/lib/simulacao/simulacoes.functions";

import { criarProposta } from "@/lib/propostas/propostas.functions";
import { useEnviarProposta } from "@/hooks/use-enviar-proposta";
import { Button } from "@/components/ui/button";

import { SelecionarBancosPdfDialog } from "@/components/simulacao/selecionar-bancos-pdf-dialog";
import { formatBRL } from "@/lib/simulacao/format";
import { listarColegas } from "@/lib/operacional/shared.functions";
import { DetalheSimulacoes, statusLabel } from "@/components/simulacao/lista-detalhe";
import { EnviarPropostaDialog } from "@/components/simulacao/enviar-proposta-dialog";
import { EncaminharSimulacaoDialog } from "@/components/simulacao/encaminhar-simulacao-dialog";
import { baixarSimulacaoDetalhadaPDF } from "@/lib/simulacao/simulacao-pdf";
import { KpiDetalheDialog } from "@/components/simulacao/kpi-detalhe-dialog";
import { FiltrosLista } from "@/components/simulacao/lista-page/filtros-lista";
import { TabelaSimulacoes } from "@/components/simulacao/lista-page/tabela-simulacoes";
import { CartoesSimulacoes } from "@/components/simulacao/lista-page/cartoes-simulacoes";
import type { HandlersLinha } from "@/components/simulacao/lista-page/tipos";
import { BarraSelecao } from "@/components/shared/barra-selecao";

/** Primeiro e último dia do mês atual como intervalo ISO (filtro padrão). */
function intervaloMesAtual(): { inicio: string; fim: string } {
  const agora = new Date(); // padding-reductions
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
  const destravar = useServerFn(destravarSimulacao);

  const obter = useServerFn(obterSimulacao);
  const listarColegasFn = useServerFn(listarColegas);
  const padrao = useMemo(() => ({ inicio: "", fim: "" }), []);
  const [escopo, setEscopo] = useState<"todas" | "minhas">("todas");
  const [q, setQ] = useState("");
  const [busca, setBusca] = useState("");

  // Debounce manual para não sobrecarregar o servidor em cada tecla
  useMemo(() => {
    const timer = setTimeout(() => {
      setBusca(q);
    }, 400);
    return () => clearTimeout(timer);
  }, [q]);
  const [desde, setDesde] = useState("");
  const [ate, setAte] = useState("");
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
    Array<{
      simulacao_banco_id: string;
      banco_id: string;
      nome_banco: string;
      proposta_id: string;
      numero: string;
    }>
  >([]);
  const { enviar: handleEnviarHook, statusPorBanco, limparStatus } = useEnviarProposta();

  // Encaminhamento: e-mail ou whatsapp
  const [encaminhamento, setEncaminhamento] = useState<{
    id: string;
    clienteNome: string;
    clienteEmail: string;
    clienteWhatsapp: string;
    canal: "email" | "whatsapp" | "pdf";
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["simulacoes", escopo, busca, desde, ate, responsavel, verExcluidas],
    refetchOnWindowFocus: true,
    refetchInterval: 5000,
    staleTime: 0,
    queryFn: () =>
      listarSimulacoes({
        data: {
          escopo,
          q: busca || undefined,
          desde: desde && desde !== "" ? desde : undefined,
          ate: ate && ate !== "" ? ate : undefined,
          responsavel: escopo === "todas" && responsavel !== "todos" ? responsavel : undefined,
          pagina: 1,
          porPagina: 50,
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

  // ── Seleção múltipla + exclusão em massa ──────────────────────────────
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [excluindoLote, setExcluindoLote] = useState(false);

  function toggleSelecionado(id: string) {
    setSelecionados((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }
  function toggleTodos() {
    const ids = (data?.itens ?? []).map((s: any) => s.id);
    setSelecionados((s) => (ids.every((id: string) => s.includes(id)) ? [] : ids));
  }
  async function excluirSelecionados() {
    setExcluindoLote(true);
    let ok = 0;
    for (const id of selecionados) {
      try {
        await excluir({ data: { id } });
        ok++;
      } catch {
        /* segue para os demais */
      }
    }
    setExcluindoLote(false);
    setSelecionados([]);
    queryClient.invalidateQueries({ queryKey: ["simulacoes"] });
    queryClient.invalidateQueries({ queryKey: ["crm-painel"] });
    queryClient.invalidateQueries({ queryKey: ["clientes"] });
    if (ok) toast.success(`${ok} simulação(ões) excluída(s).`);
    else toast.error("Não foi possível excluir as simulações selecionadas.");
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
    limparStatus();
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
    if (!envio) return;
    setEnviandoBancoId(banco.id);
    try {
      const res = await criar({
        data: { simulacao_id: envio.id, simulacao_banco_id: banco.id },
      });
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
      // Centraliza o envio através do hook único que cuida de validações e navegação
      await handleEnviarHook({
        propostaId: res.proposta_id,
        bancoId: banco.banco_id,
      });

      queryClient.invalidateQueries({ queryKey: ["simulacoes"] });
      queryClient.invalidateQueries({ queryKey: ["propostas"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar a proposta.");
    } finally {
      setEnviandoBancoId(null);
    }
  }
  async function enviarTodos(bancos: any[]) {
    if (!envio) return;
    // Dispara todos em paralelo no Hook, mas aqui na UI apenas iteramos
    // O Hook useEnviarProposta agora gerencia o estado individual.
    await Promise.allSettled(bancos.map((b) => enviarBancoIndividual(b)));
  }

  const itens = data?.itens ?? [];
  const kpiTotal = data?.total ?? itens.length;
  const kpiValor =
    data?.stats?.volumeTotal ??
    itens.reduce((acc, s) => acc + (Number(s.valor_financiamento) || 0), 0);
  const bancosUnicos = new Set<string>();
  itens.forEach((s) => {
    (Array.isArray(s.bancos) ? s.bancos : []).forEach((b: any) => {
      bancosUnicos.add(String(b.nome_banco ?? b.nome ?? b.banco_nome ?? "Banco"));
    });
  });
  const kpiBancos = bancosUnicos.size;
  const prazos = itens.map((s) => Number(s.prazo)).filter((n) => n > 0);
  const kpiPrazo =
    data?.stats?.prazoMedio ??
    (prazos.length ? Math.round(prazos.reduce((a, b) => a + b, 0) / prazos.length) : 0);

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
              (a, b) => (Number(b.valor_financiamento) || 0) - (Number(a.valor_financiamento) || 0),
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
          itens={itens.slice().sort((a, b) => (Number(b.prazo) || 0) - (Number(a.prazo) || 0))}
          destaque="prazo"
          onAbrir={irParaSimulacao}
        />
      ),
    },
  ];

  const handlersLinha: HandlersLinha = {
    onVer: (id) => router.navigate({ to: "/operacional/simulacoes/$id", params: { id } }),
    onEditar: handleEditar,
    onBaixarComparativo: handleBaixarComparativo,
    onBaixarDetalhada: handleBaixarDetalhada,
    onDuplicar: handleDuplicar,
    onEnviarProposta: handleEnviarProposta,
    onExcluir: handleExcluir,
    onRestaurar: handleRestaurar,
    onDestravar: async (id) => {
      try {
        await destravar({ data: { id } });
        toast.success("Simulação destravada com sucesso.");
        queryClient.invalidateQueries({ queryKey: ["simulacoes"] });
      } catch (e) {
        toast.error("Não foi possível destravar a simulação.");
      }
    },

    onEncaminhar: async (id, canal) => {
      try {
        const dados = await obter({ data: { id } });
        const sim = dados.simulacao;
        setEncaminhamento({
          id,
          clienteNome: sim.nome_cliente || "Cliente",
          clienteEmail: sim.email || "",
          clienteWhatsapp: sim.celular || "",
          canal,
        });
      } catch {
        toast.error("Não foi possível carregar os dados da simulação.");
      }
    },
  };

  const confirmarEncaminhamento = async (dados: {
    email: string;
    whatsapp: string;
    canal: "email" | "whatsapp" | "pdf";
  }) => {
    if (!encaminhamento) return;
    try {
      const simulacaoId = encaminhamento.id;
      const resp = await obter({ data: { id: simulacaoId } });
      const sim = resp.simulacao;
      const clienteNome = sim.nome_cliente || "Cliente";
      const valorFinanc = formatBRL(sim.valor_financiamento || 0);
      const numero = sim.numero_simulacao;

      if (dados.canal === "pdf") {
        if (!resp.bancos?.length) {
          toast.error("Esta simulação não possui bancos para baixar.");
          return;
        }
        // Gera o PDF real com layout profissional para compartilhamento
        baixarSimulacaoDetalhadaPDF({ simulacao: sim, bancos: resp.bancos });
        toast.success("PDF gerado com sucesso! Agora você pode compartilhá-lo.");
        return;
      }

      const textoBase = `Olá ${clienteNome}! Segue a simulação ${numero} de financiamento no valor de ${valorFinanc}.`;

      if (dados.canal === "whatsapp") {
        const fone = dados.whatsapp.replace(/\D/g, "");
        const msg = encodeURIComponent(`${textoBase}`);
        const url = `https://api.whatsapp.com/send?phone=55${fone}&text=${msg}`;
        window.open(url, "_blank");
        toast.info("Gere o PDF para anexar à mensagem no WhatsApp.");
      } else {
        const subject = encodeURIComponent(`Simulação de Financiamento - ${numero}`);
        const body = encodeURIComponent(`${textoBase}`);
        const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${dados.email}&su=${subject}&body=${body}`;
        window.open(url, "_blank");
      }
    } catch {
      toast.error("Erro ao processar encaminhamento.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-2 p-1.5 md:p-3">
      {/* Cabeçalho */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-card p-1.5 md:p-3">
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
            <h1 className="mt-1 text-xl font-semibold leading-tight tracking-tight text-foreground sm:text-[24px]">
              Simulações
            </h1>
            <p className="mt-1 max-w-xl text-xs text-muted-foreground">
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
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-3 shadow-sm"
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
                key={k.id}
                type="button"
                onClick={() => setKpiAberto(k.id)}
                className="group relative flex flex-col items-start gap-2 overflow-hidden rounded-xl border border-border/60 bg-card px-2.5 py-2.5 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:flex-row sm:items-center sm:gap-3"
              >
                <span className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-primary to-primary/40 transition-transform duration-300 group-hover:scale-x-100" />
                <span className="absolute left-0 top-0 h-full w-[3px] rounded-r bg-primary/60" />
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15 transition-colors group-hover:bg-primary/15">
                  <k.icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-base font-semibold leading-tight tracking-tight tabular-nums text-foreground sm:text-xl">
                    {k.valor}
                  </p>
                  <p className="mt-0.5 text-[10.5px] font-medium uppercase leading-tight tracking-wide text-muted-foreground">
                    {k.label}
                  </p>
                </div>
                <span className="ml-auto hidden shrink-0 text-[10px] font-medium text-primary/0 transition-colors group-hover:text-primary/70 sm:block">
                  ver detalhes
                </span>
              </button>
            ))}
      </div>

      {/* Detalhe do KPI clicado */}
      <KpiDetalheDialog kpis={kpis} aberto={kpiAberto} onClose={() => setKpiAberto(null)} />

      {/* Barra de filtros */}
      <FiltrosLista
        escopo={escopo}
        setEscopo={setEscopo}
        q={q}
        setQ={setQ}
        onBuscar={() => setBusca(q)}
        responsavel={responsavel}
        setResponsavel={setResponsavel}
        colegas={colegas}
        desde={desde}
        setDesde={setDesde}
        ate={ate}
        setAte={setAte}
        onLimpar={() => {
          setDesde("");
          setAte("");
          setResponsavel("todos");
        }}
        verExcluidas={verExcluidas}
        toggleExcluidas={() => setVerExcluidas((v) => !v)}
      />

      {/* Tabela (telas médias e maiores) */}
      <TabelaSimulacoes
        itens={data?.itens ?? []}
        isLoading={isLoading}
        escopo={escopo}
        verExcluidas={verExcluidas}
        handlers={handlersLinha}
        selecionados={selecionados}
        onToggleSelecionado={toggleSelecionado}
        onToggleTodos={toggleTodos}
      />

      <BarraSelecao
        quantidade={selecionados.length}
        onLimpar={() => setSelecionados([])}
        onExcluir={excluirSelecionados}
        excluindo={excluindoLote}
        rotulo="simulação(ões) selecionada(s)"
      />

      {/* Cartões (telas pequenas) */}
      <CartoesSimulacoes
        itens={data?.itens ?? []}
        isLoading={isLoading}
        escopo={escopo}
        verExcluidas={verExcluidas}
        handlers={handlersLinha}
      />

      {/* Enviar proposta: escolher UM banco por vez */}
      <EnviarPropostaDialog
        envio={envio}
        onClose={() => setEnvio(null)}
        carregando={envioCarregando}
        statusPorBanco={statusPorBanco}
        onEnviarBanco={enviarBancoIndividual}
        onEnviarTodos={enviarTodos}
      />

      <SelecionarBancosPdfDialog
        open={!!detalhePdf}
        onOpenChange={(o) => (!o ? setDetalhePdf(null) : null)}
        simulacao={detalhePdf?.simulacao}
        bancos={detalhePdf?.bancos ?? []}
        modo="detalhada"
      />

      {encaminhamento && (
        <EncaminharSimulacaoDialog
          aberto={!!encaminhamento}
          onOpenChange={(open) => !open && setEncaminhamento(null)}
          onConfirm={confirmarEncaminhamento}
          clienteNome={encaminhamento.clienteNome}
          clienteEmail={encaminhamento.clienteEmail}
          clienteWhatsapp={encaminhamento.clienteWhatsapp}
          canal={encaminhamento.canal}
        />
      )}
    </div>
  );
}
