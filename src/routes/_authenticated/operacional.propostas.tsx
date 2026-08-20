import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, KanbanSquare, Plus } from "lucide-react";
import { toast } from "sonner";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  listarPropostas,
  excluirProposta,
  restaurarProposta,
  excluirPropostaDefinitivamente,
  sincronizarPropostasAtivas,
} from "@/lib/propostas/propostas.functions";
import { propostaQueryOptions } from "@/lib/propostas/queries";

import { Button } from "@/components/ui/button";
import { listarColegas } from "@/lib/operacional/shared.functions";
import { GRUPOS_PROPOSTA, grupoDoStatus, type GrupoProposta } from "@/lib/propostas/status-grupos";
import { StatusCard, VolumeCard } from "@/components/propostas/lista-page/cards-status";
import { FiltrosPropostas } from "@/components/propostas/lista-page/filtros";
import { ListaMobile } from "@/components/propostas/lista-page/lista-mobile";
import { ListaDesktop } from "@/components/propostas/lista-page/lista-desktop";
import { BarraSelecao } from "@/components/shared/barra-selecao";

import { listarParceiros } from "@/lib/crm/parceiros.functions";
import { intervaloMesAtual, type Escopo } from "@/components/propostas/lista-page/helpers";

export const Route = createFileRoute("/_authenticated/operacional/propostas")({
  head: () => ({ meta: [{ title: "Propostas — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.propostas"),
  component: Pagina,
  errorComponent: () => (
    <div className="p-6 text-sm text-muted-foreground">Não foi possível carregar as propostas.</div>
  ),
});

function Pagina() {
  const queryClient = useQueryClient();
  const excluir = useServerFn(excluirProposta);
  const restaurar = useServerFn(restaurarProposta);
  const excluirDefinitivo = useServerFn(excluirPropostaDefinitivamente);
  const sincronizarLoteFn = useServerFn(sincronizarPropostasAtivas);
  const padrao = useMemo(() => intervaloMesAtual(), []);
  const [escopo, setEscopo] = useState<Escopo>("minhas");
  const [grupo, setGrupo] = useState<GrupoProposta | null>(null);
  const [verExcluidas, setVerExcluidas] = useState(false);
  const [q, setQ] = useState("");
  const [busca, setBusca] = useState("");
  const [responsavel, setResponsavel] = useState<string>("todos");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const [corretorFiltro, setCorretorFiltro] = useState("todos");
  const [imobFiltro, setImobFiltro] = useState("todos");
  const [comercialFiltro, setComercialFiltro] = useState("todos");

  const listarColegasFn = useServerFn(listarColegas);
  const { data: colegas } = useQuery({
    queryKey: ["colegas"],
    queryFn: () => listarColegasFn(),
    staleTime: 5 * 60_000,
  });

  const { data: parceirosCadastrados } = useQuery({
    queryKey: ["parceiros-cadastrados"],
    queryFn: () => listarParceiros(),
    staleTime: 5 * 60_000,
  });

  const corretores = useMemo(() => {
    const s = new Set<string>();
    (parceirosCadastrados ?? [])
      .filter((p) => (p.tipo_pessoa ?? "").toLowerCase() === "corretor")
      .forEach((p) => p.nome && s.add(p.nome));
    return Array.from(s).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [parceirosCadastrados]);

  const imobiliarias = useMemo(() => {
    const s = new Set<string>();
    (parceirosCadastrados ?? [])
      .filter((p) => (p.tipo_pessoa ?? "").toLowerCase() === "imobiliaria")
      .forEach((p) => p.nome && s.add(p.nome));
    return Array.from(s).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [parceirosCadastrados]);

  const comerciais = useMemo(() => {
    const s = new Set<string>();
    (parceirosCadastrados ?? [])
      .filter((p) => (p.tipo_pessoa ?? "").toLowerCase() === "comercial")
      .forEach((p) => p.nome && s.add(p.nome));
    return Array.from(s).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [parceirosCadastrados]);

  useEffect(() => {
    const t = setTimeout(() => setBusca(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let raf: number | null = null;
    const invalidar = () => {
      if (raf !== null) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        queryClient.invalidateQueries({ queryKey: ["propostas"] });
      });
    };
    let cancelado = false;
    let canalRef: any = null;
    import("@/integrations/supabase/client").then(({ supabase }) => {
      if (cancelado) return;
      canalRef = supabase
        .channel("propostas-lista")
        .on("postgres_changes", { event: "*", schema: "public", table: "propostas" }, invalidar)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "proposta_bancos" },
          invalidar,
        )
        .subscribe();
      if (cancelado) {
        supabase.removeChannel(canalRef);
        canalRef = null;
      }
    });
    return () => {
      cancelado = true;
      if (raf !== null) cancelAnimationFrame(raf);
      if (canalRef) {
        import("@/integrations/supabase/client").then(({ supabase }) =>
          supabase.removeChannel(canalRef),
        );
      }
    };
  }, [queryClient]);

  // Sincronização automática em lote: consulta o banco para todas as propostas
  // ativas visíveis e atualiza status instantaneamente, sem precisar abrir cada
  // proposta. Executa ao montar e a cada 45s. Como a atualização toca a tabela
  // `propostas`, o realtime acima invalida a lista automaticamente.
  useEffect(() => {
    let cancelado = false;
    let falhas = 0;
    const tick = async () => {
      if (cancelado) return;
      try {
        await sincronizarLoteFn({ data: { limite: 40 } });
        falhas = 0;
      } catch {
        falhas++;
      }
    };
    const t0 = setTimeout(tick, 1_500);
    const iv = setInterval(() => {
      if (falhas >= 3) return;
      tick();
    }, 20_000);
    return () => {
      cancelado = true;
      clearTimeout(t0);
      clearInterval(iv);
    };
  }, [sincronizarLoteFn]);

  const { data, isLoading } = useQuery({
    queryKey: [
      "propostas",
      escopo,
      busca,
      dataInicio,
      dataFim,
      responsavel,
      verExcluidas,
      corretorFiltro,
      imobFiltro,
      comercialFiltro,
    ],
    queryFn: () =>
      listarPropostas({
        data: {
          escopo,
          q: busca || undefined,
          responsavel: escopo === "todas" && responsavel !== "todos" ? responsavel : undefined,
          data_inicio: dataInicio ? `${dataInicio}T00:00:00` : undefined,
          data_fim: dataFim ? `${dataFim}T23:59:59` : undefined,
          pagina: 1,
          porPagina: 100,
          apenas_excluidas: verExcluidas,
          corretor_nome: corretorFiltro !== "todos" ? corretorFiltro : undefined,
          imobiliaria_nome: imobFiltro !== "todos" ? imobFiltro : undefined,
          comercial_nome: comercialFiltro !== "todos" ? comercialFiltro : undefined,
        },
      }),
  });

  const todosItens = useMemo(
    () => (data?.itens ?? []).filter((i) => !i.deleted_at || verExcluidas),
    [data?.itens, verExcluidas],
  );

  const estatisticasGrupo = useMemo(() => {
    const base: Record<GrupoProposta, { count: number; volume: number }> = {
      enviadas: { count: 0, volume: 0 },
      aprovadas: { count: 0, volume: 0 },
      recusadas: { count: 0, volume: 0 },
      canceladas: { count: 0, volume: 0 },
    };
    for (const p of todosItens) {
      const g = grupoDoStatus(p.status);
      if (!g) continue;
      base[g].count += 1;
      base[g].volume += p.valor_financiamento ?? 0;
    }
    return base;
  }, [todosItens]);

  const itens = useMemo(
    () => (grupo ? todosItens.filter((p) => grupoDoStatus(p.status) === grupo) : todosItens),
    [todosItens, grupo],
  );
  const totalItens = itens.length;
  const volumeTotal = useMemo(
    () => itens.reduce((acc, p) => acc + (p.valor_financiamento ?? 0), 0),
    [itens],
  );

  function limparFiltros() {
    setQ("");
    setBusca("");
    setResponsavel("todos");
    setCorretorFiltro("todos");
    setImobFiltro("todos");
    setComercialFiltro("todos");
    setDataInicio("");
    setDataFim("");
    setEscopo("minhas");
    setGrupo(null);
  }

  async function handleExcluir(id: string) {
    try {
      await excluir({ data: { id } });
      toast.success("Proposta excluída.");
      queryClient.removeQueries({ queryKey: ["proposta", id] });
      queryClient.invalidateQueries({ queryKey: ["propostas"] });
      queryClient.invalidateQueries({ queryKey: ["crm-painel"] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
    } catch {
      toast.error("Não foi possível excluir a proposta.");
    }
  }

  async function handleRestaurar(id: string) {
    try {
      await restaurar({ data: { id } });
      toast.success("Proposta restaurada.");
      queryClient.invalidateQueries({ queryKey: ["propostas"] });
    } catch {
      toast.error("Não foi possível restaurar a proposta.");
    }
  }

  async function handleExcluirDefinitivo(id: string) {
    try {
      await excluirDefinitivo({ data: { id } });
      toast.success("Proposta excluída definitivamente.");
      queryClient.invalidateQueries({ queryKey: ["propostas"] });
    } catch {
      toast.error("Não foi possível excluir definitivamente.");
    }
  }

  // ── Seleção múltipla + exclusão em massa ──────────────────────────────
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [excluindoLote, setExcluindoLote] = useState(false);

  function toggleSelecionado(id: string) {
    setSelecionados((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }
  function toggleTodos() {
    const ids = itens.map((p) => p.id);
    setSelecionados((s) => (ids.every((id) => s.includes(id)) ? [] : ids));
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
    for (const id of selecionados) {
      queryClient.removeQueries({ queryKey: ["proposta", id] });
    }
    queryClient.invalidateQueries({ queryKey: ["propostas"] });
    queryClient.invalidateQueries({ queryKey: ["crm-painel"] });
    queryClient.invalidateQueries({ queryKey: ["clientes"] });
    if (ok) toast.success(`${ok} proposta(s) excluída(s).`);
    else toast.error("Não foi possível excluir as propostas selecionadas.");
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4 p-3 sm:space-y-6 sm:p-6">
      {/* Cabeçalho */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/8 text-primary ring-1 ring-inset ring-primary/12">
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0 space-y-0.5">
            <h1 className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              Propostas
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              Oportunidades enviadas ao banco.
            </p>
          </div>
        </div>
        <div className="col-span-2 flex gap-2 sm:col-auto">
          <Button
            asChild
            variant="outline"
            className="group h-10 flex-1 rounded-lg border-border/70 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 active:translate-y-0 sm:flex-none"
          >
            <Link to="/operacional/propostas/kanban" search={{ q: undefined }}>
              <KanbanSquare className="mr-1.5 h-4 w-4 transition-transform duration-200 group-hover:scale-110" />{" "}
              Kanban
            </Link>
          </Button>
          <Button
            asChild
            className="group h-10 flex-1 rounded-lg font-medium shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/25 active:translate-y-0 sm:flex-none"
          >
            <Link to="/operacional/propostas/enviar">
              <Plus className="mr-1.5 h-4 w-4 transition-transform duration-200 group-hover:rotate-90" />{" "}
              Nova proposta
            </Link>
          </Button>
        </div>
      </div>

      {/* Cards por status (clicáveis) + volume financiado */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <StatusCard
          ativo={grupo === null}
          label="Todas"
          count={todosItens.length}
          volume={todosItens.reduce((a, p) => a + (p.valor_financiamento ?? 0), 0)}
          tone="info"
          loading={isLoading}
          onClick={() => setGrupo(null)}
        />
        {GRUPOS_PROPOSTA.map((g) => (
          <StatusCard
            key={g.id}
            ativo={grupo === g.id}
            label={g.label}
            count={estatisticasGrupo[g.id].count}
            volume={estatisticasGrupo[g.id].volume}
            tone={g.tone}
            loading={isLoading}
            onClick={() => setGrupo((cur) => (cur === g.id ? null : g.id))}
          />
        ))}
        <VolumeCard volume={volumeTotal} loading={isLoading} />
      </div>

      <FiltrosPropostas
        escopo={escopo}
        setEscopo={setEscopo}
        q={q}
        setQ={setQ}
        responsavel={responsavel}
        setResponsavel={setResponsavel}
        colegas={colegas}
        dataInicio={dataInicio}
        setDataInicio={setDataInicio}
        dataFim={dataFim}
        setDataFim={setDataFim}
        onLimpar={limparFiltros}
        verExcluidas={verExcluidas}
        setVerExcluidas={setVerExcluidas}
        corretorFiltro={corretorFiltro}
        setCorretorFiltro={setCorretorFiltro}
        corretores={corretores}
        imobFiltro={imobFiltro}
        setImobFiltro={setImobFiltro}
        imobiliarias={imobiliarias}
        comercialFiltro={comercialFiltro}
        setComercialFiltro={setComercialFiltro}
        comerciais={comerciais}
      />

      <ListaMobile
        isLoading={isLoading}
        itens={itens}
        totalItens={totalItens}
        escopo={escopo}
        verExcluidas={verExcluidas}
        handleExcluir={handleExcluir}
        handleRestaurar={handleRestaurar}
        handleExcluirDefinitivo={handleExcluirDefinitivo}
      />

      <ListaDesktop
        isLoading={isLoading}
        itens={itens}
        totalItens={totalItens}
        escopo={escopo}
        verExcluidas={verExcluidas}
        handleExcluir={handleExcluir}
        handleRestaurar={handleRestaurar}
        handleExcluirDefinitivo={handleExcluirDefinitivo}
        selecionados={selecionados}
        onToggleSelecionado={toggleSelecionado}
        onToggleTodos={toggleTodos}
      />

      <BarraSelecao
        quantidade={selecionados.length}
        onLimpar={() => setSelecionados([])}
        onExcluir={excluirSelecionados}
        excluindo={excluindoLote}
        rotulo="proposta(s) selecionada(s)"
      />
    </div>
  );
}
