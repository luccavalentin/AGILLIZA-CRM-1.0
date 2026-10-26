import { usePermissao } from "@/hooks/use-permissao";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, KanbanSquare, Plus } from "lucide-react";
import { toast } from "sonner";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  listarPropostas,
  excluirProposta,
  restaurarProposta,
  excluirPropostaDefinitivamente,
  sincronizarPropostasAtivas,
} from "@/lib/propostas/propostas.functions";

import { Button } from "@/components/ui/button";
import { Icone3D } from "@/components/ui/icone-3d";
import { listarColegas } from "@/lib/operacional/shared.functions";
import { GRUPOS_PROPOSTA, type GrupoProposta } from "@/lib/propostas/status-grupos";
import { StatusCard, VolumeCard } from "@/components/propostas/lista-page/cards-status";
import { FiltrosPropostas } from "@/components/propostas/lista-page/filtros";
import { ListaMobile } from "@/components/propostas/lista-page/lista-mobile";
import { ListaDesktop } from "@/components/propostas/lista-page/lista-desktop";
import { BarraSelecao } from "@/components/shared/barra-selecao";

import { listarOpcoesVinculoPropostas } from "@/lib/crm/parceiros.functions";
import type { Escopo } from "@/components/propostas/lista-page/helpers";

import { FiltroBase } from "@/components/crm/filtro-base/filtro-base";
import { useFiltroBase } from "@/components/crm/filtro-base/use-filtro-base";
import { rotuloDoFiltro } from "@/lib/plataforma/filtro-base";
import {
  PainelPropostasGrupo,
  SecaoPropostasVinculadas,
} from "@/components/plataforma/propostas-grupo/painel";
import { validarBuscaPropostas } from "@/components/plataforma/propostas-grupo/filtros";
import {
  AbasPropostas,
  type AbaPropostas,
} from "@/components/plataforma/fila-assinantes/abas-propostas";
import { FilaDosAssinantes } from "@/components/plataforma/fila-assinantes/fila";
import { usePendentesDaFila } from "@/components/plataforma/fila-assinantes/hooks";

export const Route = createFileRoute("/_authenticated/operacional/propostas")({
  head: () => ({ meta: [{ title: "Propostas — Agilliza" }] }),
  // `?base=assinantes` (ou o antigo `?aba=assinantes`, do menu Plataforma) abre as propostas
  // dos assinantes; os filtros do painel também ficam no endereço.
  validateSearch: validarBuscaPropostas,
  beforeLoad: () => assertModuloPermitido("operacional.propostas"),
  component: Pagina,
  errorComponent: () => (
    <div className="p-6 text-sm text-muted-foreground">Não foi possível carregar as propostas.</div>
  ),
});

function Pagina() {
  // Base exibida (C30): "Sua base" (Agilliza + vinculados) ou "Assinantes" (todos ou um).
  const filtroBase = useFiltroBase();
  const { alvo } = filtroBase;
  const basePedida = Route.useSearch().base;
  const navigate = Route.useNavigate();
  const pendentesAssinantes = usePendentesDaFila();
  // A fila dos assinantes só existe para quem atende (saas.fila). Para parceiro externo e
  // para quem não atende, a aba confundia: mostrava só o aviso de permissão.
  const podeFilaAssinantes = usePermissao("saas.fila", "view");
  // Sem "Contas" (saas.contas) não há filtro de base: quem só atende a fila usa as abas de antes.
  const aba: AbaPropostas = basePedida === "assinantes" ? "assinantes" : "agilliza";
  const trocarAba = (a: AbaPropostas) =>
    navigate({ search: a === "assinantes" ? { base: "assinantes" } : {}, replace: true });
  const verEsperando = () =>
    navigate({ search: { base: "assinantes", aceite: "pendentes" }, replace: true });
  const queryClient = useQueryClient();
  const excluir = useServerFn(excluirProposta);
  const restaurar = useServerFn(restaurarProposta);
  const excluirDefinitivo = useServerFn(excluirPropostaDefinitivamente);
  const sincronizarLoteFn = useServerFn(sincronizarPropostasAtivas);
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
  // Paginação no servidor: antes vinham as 500 primeiras e o resto sumia calado.
  const [pagina, setPagina] = useState(1);
  const POR_PAGINA = 100;
  useEffect(() => {
    setPagina(1);
  }, [
    escopo,
    busca,
    dataInicio,
    dataFim,
    responsavel,
    verExcluidas,
    corretorFiltro,
    imobFiltro,
    comercialFiltro,
    grupo,
  ]);

  const listarColegasFn = useServerFn(listarColegas);
  const { data: colegas } = useQuery({
    queryKey: ["colegas"],
    queryFn: () => listarColegasFn(),
    staleTime: 5 * 60_000,
  });

  // Opções vêm dos vínculos reais (cliente_parceiros + profiles). A fonte
  // anterior, parceiro_detalhes, está vazia e deixava os filtros só com "Todos".
  const { data: opcoesVinculo } = useQuery({
    queryKey: ["opcoes-vinculo-propostas"],
    queryFn: () => listarOpcoesVinculoPropostas(),
    staleTime: 5 * 60_000,
  });
  const corretores = opcoesVinculo?.corretores ?? [];
  const imobiliarias = opcoesVinculo?.imobiliarias ?? [];
  const comerciais = opcoesVinculo?.comerciais ?? [];

  useEffect(() => {
    const t = setTimeout(() => setBusca(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    // Agrupa a rajada de eventos (uma sincronização mexe em propostas e
    // proposta_bancos de várias propostas) numa recarga só. Antes recarregava
    // a cada quadro de animação, ou seja, praticamente a cada evento.
    let raf: ReturnType<typeof setTimeout> | null = null;
    const invalidar = () => {
      if (raf !== null) return;
      raf = setTimeout(() => {
        raf = null;
        queryClient.invalidateQueries({ queryKey: ["propostas"] });
      }, 1000);
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
      if (raf !== null) clearTimeout(raf);
      if (canalRef) {
        import("@/integrations/supabase/client").then(({ supabase }) =>
          supabase.removeChannel(canalRef),
        );
      }
    };
  }, [queryClient]);

  // Sincronização em lote ao abrir a lista: consulta o banco para as propostas
  // ativas visíveis que já venceram o ritmo de `sync-backoff.ts`. Depois disso
  // o agendador (`/api/public/sync-propostas`, a cada 1 min, mesmos status
  // incluindo rascunho) mantém tudo em dia — repetir aqui a cada 20 s por aba
  // não adiantava nada (o ritmo mínimo é 1 min) e multiplicava a carga pelo
  // número de abas abertas. Como a atualização toca a tabela `propostas`, o
  // realtime acima invalida a lista automaticamente.
  useEffect(() => {
    let cancelado = false;
    const t0 = setTimeout(() => {
      if (cancelado) return;
      sincronizarLoteFn({ data: { limite: 40 } }).catch(() => {});
    }, 1_500);
    return () => {
      cancelado = true;
      clearTimeout(t0);
    };
  }, [sincronizarLoteFn]);

  const { data, isLoading, isError, error } = useQuery({
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
      grupo,
      pagina,
    ],
    queryFn: () =>
      listarPropostas({
        data: {
          escopo,
          q: busca || undefined,
          responsavel: escopo === "todas" && responsavel !== "todos" ? responsavel : undefined,
          data_inicio: dataInicio ? `${dataInicio}T00:00:00` : undefined,
          data_fim: dataFim ? `${dataFim}T23:59:59` : undefined,
          grupo: grupo ?? undefined,
          pagina,
          porPagina: POR_PAGINA,
          apenas_excluidas: verExcluidas,
          corretor_nome: corretorFiltro !== "todos" ? corretorFiltro : undefined,
          imobiliaria_nome: imobFiltro !== "todos" ? imobFiltro : undefined,
          comercial_nome: comercialFiltro !== "todos" ? comercialFiltro : undefined,
        },
      }),
    // Em "Assinantes" (ou só vinculados) a lista do Agilliza não aparece: não busca à toa.
    enabled: alvo.agilliza,
  });

  const todosItens = useMemo(
    () => (data?.itens ?? []).filter((i) => !i.deleted_at || verExcluidas),
    [data?.itens, verExcluidas],
  );

  // Cards e totais vêm do servidor: contam TODO o resultado do filtro, não só
  // as 100 linhas desta página. O grupo escolhido também filtra no banco.
  const resumo = data?.resumo;
  const estatisticasGrupo = resumo?.grupos ?? {
    enviadas: { count: 0, volume: 0 },
    aprovadas: { count: 0, volume: 0 },
    recusadas: { count: 0, volume: 0 },
    canceladas: { count: 0, volume: 0 },
  };
  const itens = todosItens;
  // Estado vazio olha o que está na tela; os cards olham o total do servidor.
  const totalItens = itens.length;
  const volumeTotal = resumo?.total.volume ?? 0;

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
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível excluir a proposta."));
    }
  }

  async function handleRestaurar(id: string) {
    try {
      await restaurar({ data: { id } });
      toast.success("Proposta restaurada.");
      queryClient.invalidateQueries({ queryKey: ["propostas"] });
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível restaurar a proposta."));
    }
  }

  async function handleExcluirDefinitivo(id: string) {
    try {
      await excluirDefinitivo({ data: { id } });
      toast.success("Proposta excluída definitivamente.");
      queryClient.invalidateQueries({ queryKey: ["propostas"] });
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível excluir definitivamente."));
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
    let ultimoErro: unknown = null;
    for (const id of selecionados) {
      try {
        await excluir({ data: { id } });
        ok++;
      } catch (e) {
        ultimoErro = e; // segue para as demais
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
    if (ultimoErro)
      toast.error(
        mensagemDeErro(
          ultimoErro,
          ok
            ? "Algumas propostas não puderam ser excluídas."
            : "Não foi possível excluir as propostas selecionadas.",
        ),
      );
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4 p-3 sm:space-y-6 sm:p-6">
      {/* Cabeçalho */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Icone3D icone={FileText} tamanho="lg" />
          <div className="min-w-0 space-y-0.5">
            <h1 className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              Propostas
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              {filtroBase.pode
                ? `${rotuloDoFiltro(filtroBase.filtro, filtroBase.conta)} · oportunidades enviadas ao banco.`
                : "Oportunidades enviadas ao banco."}
            </p>
          </div>
        </div>
        {/* flex-wrap: no celular (390 px) "Nova proposta" saía da tela. */}
        <div data-tour="propostas-botoes" className="col-span-2 flex flex-wrap gap-2 sm:col-auto sm:flex-nowrap">
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

      {filtroBase.pode ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <FiltroBase uso={filtroBase} />
          {pendentesAssinantes !== null && pendentesAssinantes > 0 && (
            <button
              type="button"
              onClick={verEsperando}
              className="inline-flex h-9 items-center gap-2 self-start rounded-full border border-primary/25 bg-primary/5 px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 sm:self-auto"
            >
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/50 motion-reduce:animate-none" />
                <span className="relative inline-flex size-2 rounded-full bg-primary" />
              </span>
              {pendentesAssinantes > 99 ? "99+" : pendentesAssinantes} esperando analista
            </button>
          )}
        </div>
      ) : (
        podeFilaAssinantes && (
          <AbasPropostas aba={aba} onAba={trocarAba} pendentes={pendentesAssinantes} />
        )
      )}

      {filtroBase.pode && !alvo.agilliza ? (
        <PainelPropostasGrupo alvo={alvo} conta={filtroBase.conta} />
      ) : !filtroBase.pode && aba === "assinantes" && podeFilaAssinantes ? (
        <FilaDosAssinantes />
      ) : (
        <>
          {/* Cards por status (clicáveis) + volume financiado */}
          <div data-tour="propostas-status" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            <StatusCard
              ativo={grupo === null}
              label="Todas"
              count={resumo?.total.count ?? 0}
              volume={resumo?.total.volume ?? 0}
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

          {isError && (
            <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {mensagemDeErro(error, "Não foi possível carregar as propostas.")}
            </p>
          )}

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

          {(data?.total ?? 0) > POR_PAGINA && (
            <div className="flex items-center justify-center gap-2 py-2 text-sm">
              <Button
                variant="outline"
                size="sm"
                disabled={pagina === 1}
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <span className="px-2 text-muted-foreground">
                Página {pagina} de {Math.ceil((data?.total ?? 0) / POR_PAGINA)}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagina * POR_PAGINA >= (data?.total ?? 0)}
                onClick={() => setPagina((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          )}

          <BarraSelecao
            quantidade={selecionados.length}
            onLimpar={() => setSelecionados([])}
            onExcluir={excluirSelecionados}
            excluindo={excluindoLote}
            rotulo="proposta(s) selecionada(s)"
          />

          {/* "Sua base" inclui as propostas dos corretores e parceiros vinculados (C07/C30). */}
          {alvo.grupo === "vinculados" && filtroBase.totalVinculadas > 0 && (
            <SecaoPropostasVinculadas termo={busca} />
          )}
        </>
      )}
    </div>
  );
}
