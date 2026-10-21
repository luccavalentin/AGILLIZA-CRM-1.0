import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { assertModuloPermitido } from "@/lib/route-guards";
import {
  listarPainel,
  definirEtapa,
  definirDatasVistoria,
  definirDataContratoEmitido,
  arquivarContrato,
  listarContratosEmitidos,
  limparVinculoEsteira,
  buscarClientesCRM,
  type PainelStage,
} from "@/lib/crm/clientes.functions";
import { ehImobiliariaParceiro, listarParceiros } from "@/lib/crm/parceiros.functions";
import { listarResponsaveisEquipe } from "@/lib/propostas/propostas.functions";
import { usePipelineRealtime } from "@/hooks/use-pipeline-realtime";
import { usePermissao } from "@/hooks/use-permissao";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HeaderPainel } from "@/components/crm/painel/header-painel";
import { FiltrosPainel } from "@/components/crm/painel/filtros-painel";
import { CardCliente } from "@/components/crm/painel/card-cliente";
import { ColunaEsteira, PastaArquivados } from "@/components/crm/painel/coluna-esteira";
import {
  DialogClientesEtapa,
  DialogArquivoContratos,
  DialogAdicionarCliente,
  AlertExcluirContrato,
  AlertLimparVinculo,
} from "@/components/crm/painel/dialogs";
import type { Arrasto } from "@/components/crm/painel/utils";
import { etapaEhComercial, MSG_ETAPA_SINCRONIZADA } from "@/lib/crm/etapas";

export const Route = createFileRoute("/_authenticated/crm/painel")({
  head: () => ({ meta: [{ title: "Painel da esteira — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("crm.clientes"),
  component: Pagina,
  errorComponent: () => (
    <div className="p-6 text-sm text-destructive">Erro ao carregar o painel.</div>
  ),
});

function Pagina() {
  usePipelineRealtime();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listar = useServerFn(listarPainel);
  const mover = useServerFn(definirEtapa);
  const salvarDatas = useServerFn(definirDatasVistoria);
  const salvarContratoData = useServerFn(definirDataContratoEmitido);
  const arquivarContratoFn = useServerFn(arquivarContrato);
  const listarContratos = useServerFn(listarContratosEmitidos);
  const limparVinculoFn = useServerFn(limparVinculoEsteira);
  const buscarClientes = useServerFn(buscarClientesCRM);
  // Mover etapa, datas, arquivar e limpar vínculo exigem "Editar" em Clientes (o servidor recusa).
  const podeEditar = usePermissao("crm.clientes", "edit");
  const podeVerParceiros = usePermissao("crm.parceiros", "view");

  // ---- Estado geral
  const [limpandoVinculo, setLimpandoVinculo] = useState<{ id: string; nome: string } | null>(null);
  const [adicionarStage, setAdicionarStage] = useState<{ codigo: string; nome: string } | null>(
    null,
  );
  const [adicionarBusca, setAdicionarBusca] = useState("");
  const [adicionando, setAdicionando] = useState(false);

  const [desde, setDesde] = useState("");
  const [ate, setAte] = useState("");
  const [escopo, setEscopo] = useState<"minhas" | "geral">("minhas");
  const [busca, setBusca] = useState("");
  const [dialogStage, setDialogStage] = useState<string | null>(null);
  const [arquivoAberto, setArquivoAberto] = useState(false);
  const [contratoBusca, setContratoBusca] = useState("");
  const [contratoDesde, setContratoDesde] = useState("");
  const [contratoAte, setContratoAte] = useState("");
  const [contratoPagina, setContratoPagina] = useState(1);
  const [contratoBuscaDeb, setContratoBuscaDeb] = useState("");
  const [editandoContrato, setEditandoContrato] = useState<string | null>(null);
  const [excluindoContrato, setExcluindoContrato] = useState<string | null>(null);

  const [arrasto, setArrasto] = useState<Arrasto | null>(null);
  const [alvo, setAlvo] = useState<string | null>(null);
  const arrastouRef = useRef(false);

  const [periodo, setPeriodo] = useState("todos");
  const [respFiltro, setRespFiltro] = useState("todos");
  const [analistaFiltro, setAnalistaFiltro] = useState("todos");
  const [corretorFiltro, setCorretorFiltro] = useState("todos");
  const [imobFiltro, setImobFiltro] = useState("todos");

  function aplicarPeriodo(p: string) {
    setPeriodo(p);
    const hoje = new Date();
    // Formata como YYYY-MM-DD em fuso local (não UTC), evitando deslocamento
    // de 1 dia quando o usuário está em UTC-3 e roda de tarde/noite.
    const fmt = (dt: Date) => {
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, "0");
      const d = String(dt.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    };
    if (p === "todos") {
      setDesde("");
      setAte("");
    } else if (p === "mes") {
      setDesde(fmt(new Date(hoje.getFullYear(), hoje.getMonth(), 1)));
      setAte(fmt(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)));
    } else if (p === "7d") {
      const i = new Date(hoje);
      i.setDate(i.getDate() - 7);
      setDesde(fmt(i));
      setAte(fmt(hoje));
    } else if (p === "30d") {
      const i = new Date(hoje);
      i.setDate(i.getDate() - 30);
      setDesde(fmt(i));
      setAte(fmt(hoje));
    } else if (p === "ano") {
      setDesde(fmt(new Date(hoje.getFullYear(), 0, 1)));
      setAte(fmt(new Date(hoje.getFullYear(), 11, 31)));
    }
  }

  function limparTodosFiltros() {
    setPeriodo("todos");
    setRespFiltro("todos");
    setAnalistaFiltro("todos");
    setCorretorFiltro("todos");
    setImobFiltro("todos");
    setDesde("");
    setAte("");
    setBusca("");
  }

  // ---- Dados: painel + contratos arquivados
  // O arquivo é paginado e filtrado no servidor; a busca espera o usuário parar de digitar.
  useEffect(() => {
    const t = window.setTimeout(() => setContratoBuscaDeb(contratoBusca.trim()), 300);
    return () => window.clearTimeout(t);
  }, [contratoBusca]);
  useEffect(() => setContratoPagina(1), [contratoBuscaDeb, contratoDesde, contratoAte]);
  const POR_PAGINA_CONTRATOS = 30;
  const contratosQuery = useQuery({
    queryKey: [
      "crm-contratos-emitidos",
      contratoBuscaDeb,
      contratoDesde,
      contratoAte,
      contratoPagina,
    ],
    queryFn: () =>
      listarContratos({
        data: {
          q: contratoBuscaDeb || undefined,
          desde: contratoDesde || undefined,
          ate: contratoAte || undefined,
          pagina: contratoPagina,
          porPagina: POR_PAGINA_CONTRATOS,
        },
      }),
    enabled: arquivoAberto,
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
  // Só o total da pasta (selo do card "Contratos emitidos"), sem trazer a lista.
  const { data: resumoArquivados } = useQuery({
    queryKey: ["crm-contratos-emitidos", "total"],
    queryFn: () => listarContratos({ data: { pagina: 1, porPagina: 1 } }),
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
  const totalArquivados = resumoArquivados?.total ?? 0;
  const totalContratosFiltro = contratosQuery.data?.total ?? 0;
  const totalPaginasContratos = Math.max(1, Math.ceil(totalContratosFiltro / POR_PAGINA_CONTRATOS));

  const queryKey = ["crm-painel", desde, ate, escopo];
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => listar({ data: { desde: desde || undefined, ate: ate || undefined, escopo } }),
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  // ---- Busca debounced para "Adicionar cliente"
  const [termoAdicionarDeb, setTermoAdicionarDeb] = useState("");
  const termoAdicionar = adicionarBusca.trim();
  useEffect(() => {
    const t = window.setTimeout(() => setTermoAdicionarDeb(termoAdicionar), 250);
    return () => window.clearTimeout(t);
  }, [termoAdicionar]);
  const { data: resultadosAdicionar, isFetching: buscandoAdicionar } = useQuery({
    queryKey: ["crm-painel-buscar-cliente", termoAdicionarDeb],
    queryFn: () => buscarClientes({ data: { q: termoAdicionarDeb } }),
    enabled: !!adicionarStage && termoAdicionarDeb.length >= 2,
    staleTime: 60_000,
  });

  // ---- Mutações
  async function moverPara(codigoDestino: string) {
    const info = arrasto;
    setArrasto(null);
    setAlvo(null);
    if (!info || info.origem === codigoDestino) return;

    // Etapas 4-9 são sincronizadas pela proposta — sem arrasto manual.
    if (!etapaEhComercial(info.origem) || !etapaEhComercial(codigoDestino)) {
      toast.info(MSG_ETAPA_SINCRONIZADA);
      return;
    }

    const anterior = qc.getQueryData<PainelStage[]>(queryKey);
    let clienteMovido: PainelStage["clientes"][number] | undefined;
    if (anterior) {
      const novo = anterior.map((s) => {
        if (s.codigo === info.origem) {
          const c = s.clientes.find((x) => x.id === info.clienteId);
          if (c) clienteMovido = c;
          return { ...s, clientes: s.clientes.filter((x) => x.id !== info.clienteId) };
        }
        return s;
      });
      if (clienteMovido) {
        const destino = novo.find((s) => s.codigo === codigoDestino);
        if (destino) destino.clientes = [...destino.clientes, clienteMovido];
      }
      qc.setQueryData(queryKey, novo);
    }

    try {
      await mover({ data: { cliente_id: info.clienteId, codigo_destino: codigoDestino } });
      toast.success("Etapa atualizada.");
      // Marca stale sem refetch imediato — o painel já reflete a mudança pelo
      // update otimista; próximo foco/navegação buscará dados atualizados.
      qc.invalidateQueries({ queryKey: ["crm-painel"], refetchType: "none" });
    } catch (e) {
      if (anterior) qc.setQueryData(queryKey, anterior);
      toast.error(mensagemDeErro(e, "Falha ao mover o cliente."));
      qc.invalidateQueries({ queryKey: ["crm-painel"] });
    }
  }

  async function salvarDataVistoria(
    clienteId: string,
    campo: "vistoria_agendada_em" | "vistoria_concluida_em",
    valor: string,
  ) {
    const novoValor = valor || null;
    const anterior = qc.getQueryData<PainelStage[]>(queryKey);
    if (anterior) {
      qc.setQueryData(
        queryKey,
        anterior.map((s) => ({
          ...s,
          clientes: s.clientes.map((c) => (c.id === clienteId ? { ...c, [campo]: novoValor } : c)),
        })),
      );
    }
    try {
      await salvarDatas({ data: { cliente_id: clienteId, [campo]: novoValor } });
      toast.success("Data da vistoria salva.");
      qc.invalidateQueries({ queryKey: ["crm-painel"], refetchType: "none" });
    } catch (e) {
      if (anterior) qc.setQueryData(queryKey, anterior);
      toast.error(mensagemDeErro(e, "Falha ao salvar a data."));
      qc.invalidateQueries({ queryKey: ["crm-painel"] });
    }
  }

  async function salvarDataContrato(clienteId: string, valor: string, doArquivo = false) {
    const novoValor = valor || null;
    const anterior = qc.getQueryData<PainelStage[]>(queryKey);
    if (anterior) {
      qc.setQueryData(
        queryKey,
        anterior.map((s) => ({
          ...s,
          clientes: s.clientes.map((c) =>
            c.id === clienteId ? { ...c, contrato_emitido_em: novoValor } : c,
          ),
        })),
      );
    }
    try {
      await salvarContratoData({
        data: { cliente_id: clienteId, contrato_emitido_em: novoValor },
      });
      toast.success("Data de emissão salva.");
      // O card da esteira não está no arquivo: só a edição feita lá recarrega a pasta.
      if (doArquivo) qc.invalidateQueries({ queryKey: ["crm-contratos-emitidos"] });
      qc.invalidateQueries({ queryKey: ["crm-painel"], refetchType: "none" });
    } catch (e) {
      if (anterior) qc.setQueryData(queryKey, anterior);
      toast.error(mensagemDeErro(e, "Falha ao salvar a data."));
      qc.invalidateQueries({ queryKey: ["crm-painel"] });
    }
  }

  async function arquivarContratoEmitido(clienteId: string) {
    const anterior = qc.getQueryData<PainelStage[]>(queryKey);
    if (anterior) {
      qc.setQueryData(
        queryKey,
        anterior.map((s) => ({
          ...s,
          clientes: s.clientes.filter((c) => c.id !== clienteId),
        })),
      );
    }
    try {
      await arquivarContratoFn({ data: { cliente_id: clienteId, arquivar: true } });
      toast.success("Contrato arquivado na pasta de contratos emitidos.");
      qc.invalidateQueries({ queryKey: ["crm-contratos-emitidos"] });
      // O card já saiu do quadro (atualização otimista): sem recarregar a esteira inteira.
      qc.invalidateQueries({ queryKey: ["crm-painel"], refetchType: "none" });
    } catch (e) {
      if (anterior) qc.setQueryData(queryKey, anterior);
      toast.error(mensagemDeErro(e, "Falha ao arquivar o contrato."));
    }
  }

  async function desarquivarContrato(clienteId: string) {
    try {
      await arquivarContratoFn({ data: { cliente_id: clienteId, arquivar: false } });
      toast.success("Contrato movido de volta para a esteira.");
      qc.invalidateQueries({ queryKey: ["crm-contratos-emitidos"] });
      qc.invalidateQueries({ queryKey: ["crm-painel"] });
    } catch (e) {
      toast.error(mensagemDeErro(e, "Falha ao mover o contrato."));
    }
  }

  async function excluirContratoEmitido(clienteId: string) {
    try {
      await arquivarContratoFn({ data: { cliente_id: clienteId, arquivar: false } });
      await salvarContratoData({ data: { cliente_id: clienteId, contrato_emitido_em: null } });
      toast.success("Registro de contrato emitido excluído.");
      qc.invalidateQueries({ queryKey: ["crm-contratos-emitidos"] });
      qc.invalidateQueries({ queryKey: ["crm-painel"] });
    } catch (e) {
      toast.error(mensagemDeErro(e, "Falha ao excluir o contrato."));
    }
  }

  async function confirmarLimparVinculo() {
    if (!limpandoVinculo) return;
    const { id } = limpandoVinculo;
    setLimpandoVinculo(null);
    try {
      await limparVinculoFn({ data: { cliente_id: id } });
      toast.success("Cliente voltou para Cadastro completo.");
      // Move o card no quadro em vez de recarregar a esteira inteira.
      const atual = qc.getQueryData<PainelStage[]>(queryKey);
      const card = atual?.flatMap((s) => s.clientes).find((c) => c.id === id);
      if (atual && card) {
        qc.setQueryData(
          queryKey,
          atual.map((s) => ({
            ...s,
            clientes:
              s.codigo === "cadastro_completo"
                ? [...s.clientes.filter((c) => c.id !== id), card]
                : s.clientes.filter((c) => c.id !== id),
          })),
        );
      }
      qc.invalidateQueries({ queryKey: ["crm-painel"], refetchType: "none" });
    } catch (e) {
      toast.error(mensagemDeErro(e, "Falha ao remover o vínculo."));
    }
  }

  async function adicionarClienteNaEtapa(clienteId: string) {
    if (!adicionarStage) return;
    setAdicionando(true);
    try {
      await mover({ data: { cliente_id: clienteId, codigo_destino: adicionarStage.codigo } });
      toast.success(`Cliente adicionado em ${adicionarStage.nome}.`);
      setAdicionarStage(null);
      setAdicionarBusca("");
      qc.invalidateQueries({ queryKey: ["crm-painel"] });
    } catch (e) {
      toast.error(mensagemDeErro(e, "Falha ao adicionar o cliente."));
    } finally {
      setAdicionando(false);
    }
  }

  // ---- Derivados: filtros aplicados + opções + KPIs
  const termo = busca.trim().toLowerCase();
  const dadosFiltrados = useMemo(
    () =>
      (data ?? []).map((s) => ({
        ...s,
        clientes: s.clientes.filter((c) => {
          if (
            termo &&
            !c.nome.toLowerCase().includes(termo) &&
            !(c.numero_cliente ?? "").toLowerCase().includes(termo)
          )
            return false;
          if (respFiltro !== "todos" && (c.responsavel_nome ?? "") !== respFiltro) return false;
          if (analistaFiltro !== "todos" && (c.analista_nome ?? "") !== analistaFiltro)
            return false;
          if (corretorFiltro !== "todos" && (c.corretor_nome ?? "") !== corretorFiltro)
            return false;
          if (imobFiltro !== "todos" && (c.imobiliaria_nome ?? "") !== imobFiltro) return false;
          return true;
        }),
      })),
    [data, termo, respFiltro, analistaFiltro, corretorFiltro, imobFiltro],
  );
  const totalClientes = useMemo(
    () => dadosFiltrados.reduce((acc, s) => acc + s.clientes.length, 0),
    [dadosFiltrados],
  );

  // Opções de filtro — união do que está em tela com toda a base cadastrada.
  const { data: equipeInterna } = useQuery({
    queryKey: ["equipe-interna"],
    queryFn: () => listarResponsaveisEquipe(),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
  // A lista de parceiros exige "Ver" em Parceiros; sem ela as opções vêm só do quadro.
  const { data: parceirosCadastrados } = useQuery({
    queryKey: ["parceiros-cadastrados"],
    queryFn: () => listarParceiros(),
    enabled: podeVerParceiros,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  function opcoesDe(
    campo: "responsavel_nome" | "analista_nome" | "corretor_nome" | "imobiliaria_nome",
  ): string[] {
    const set = new Set<string>();
    (data ?? []).forEach((s) =>
      s.clientes.forEach((c) => {
        const v = c[campo];
        if (v) set.add(v);
      }),
    );
    if (campo === "responsavel_nome") {
      // Responsável = qualquer membro interno cadastrado.
      (equipeInterna ?? []).forEach((m) => m.nome && set.add(m.nome));
    } else if (campo === "analista_nome") {
      // Analista = somente quem tem o papel "analista".
      (equipeInterna ?? [])
        .filter((m) => (m.papeis ?? []).includes("analista"))
        .forEach((m) => m.nome && set.add(m.nome));
    } else if (campo === "corretor_nome") {
      // parceiro_detalhes.tipo_pessoa grava "pf"/"pj": antes comparava com "corretor" e
      // "imobiliaria" e nenhum parceiro cadastrado entrava nas opções.
      (parceirosCadastrados ?? [])
        .filter((p) => !ehImobiliariaParceiro(p.tipo_pessoa))
        .forEach((p) => p.nome && set.add(p.nome));
    } else if (campo === "imobiliaria_nome") {
      (parceirosCadastrados ?? [])
        .filter((p) => ehImobiliariaParceiro(p.tipo_pessoa))
        .forEach((p) => p.nome && set.add(p.nome));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }
  const responsaveis = useMemo(() => opcoesDe("responsavel_nome"), [data, equipeInterna]);
  const analistas = useMemo(() => opcoesDe("analista_nome"), [data, equipeInterna]);
  const corretores = useMemo(() => opcoesDe("corretor_nome"), [data, parceirosCadastrados]);
  const imobiliarias = useMemo(() => opcoesDe("imobiliaria_nome"), [data, parceirosCadastrados]);

  // ---- Diálogos: montagem
  const verTodos = dialogStage === "__todos__";
  const stageDialog =
    dialogStage && !verTodos ? dadosFiltrados.find((s) => s.codigo === dialogStage) : null;
  const clientesDialog = verTodos
    ? dadosFiltrados.flatMap((s) => s.clientes.map((c) => ({ ...c, etapaNome: s.nome })))
    : (stageDialog?.clientes.map((c) => ({ ...c, etapaNome: stageDialog.nome })) ?? []);
  const tituloDialog = verTodos ? "Todos os clientes" : (stageDialog?.nome ?? "Etapa");

  return (
    <div className="space-y-4 overflow-x-hidden p-3 sm:space-y-6 sm:p-6">
      <HeaderPainel
        escopo={escopo}
        totalClientes={totalClientes}
        totalArquivados={totalArquivados}
        onEscopoChange={setEscopo}
        onAbrirArquivo={() => setArquivoAberto(true)}
        onVerTodos={() => totalClientes > 0 && setDialogStage("__todos__")}
        onLimparFiltros={limparTodosFiltros}
      />

      <FiltrosPainel
        totalClientes={totalClientes}
        totalEtapas={dadosFiltrados.length}
        periodo={periodo}
        respFiltro={respFiltro}
        analistaFiltro={analistaFiltro}
        corretorFiltro={corretorFiltro}
        imobFiltro={imobFiltro}
        busca={busca}
        desde={desde}
        ate={ate}
        responsaveis={responsaveis}
        analistas={analistas}
        corretores={corretores}
        imobiliarias={imobiliarias}
        onPeriodo={aplicarPeriodo}
        onResp={setRespFiltro}
        onAnalista={setAnalistaFiltro}
        onCorretor={setCorretorFiltro}
        onImob={setImobFiltro}
        onBusca={setBusca}
        onDesde={(v) => {
          setDesde(v);
          setPeriodo("custom");
        }}
        onAte={(v) => {
          setAte(v);
          setPeriodo("custom");
        }}
        onLimpar={limparTodosFiltros}
      />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 lg:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-96 w-full rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-destructive/40 px-4 py-12 text-center">
          <p className="text-sm text-destructive">Não foi possível carregar a esteira.</p>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : (
        // Quadro numa linha só, com rolagem lateral: na grade de 5 colunas as 9
        // etapas quebravam em 2 linhas de ~185 px e títulos/nomes saíam cortados.
        <div
          className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-3 lg:gap-4 [&>*]:w-[17.5rem] [&>*]:shrink-0 [&>*]:snap-start"
          role="region"
          aria-label="Esteira de clientes por etapa"
        >
          {dadosFiltrados.map((stage, idx) => {
            // Sem "Editar" em Clientes o quadro é só consulta: nada se arrasta nem se adiciona.
            const readOnly = !etapaEhComercial(stage.codigo) || !podeEditar;
            return (
              <Fragment key={stage.codigo}>
                <ColunaEsteira
                  stage={stage}
                  ordem={idx + 1}
                  ehAlvoArrasto={alvo === stage.codigo && arrasto?.origem !== stage.codigo}
                  arrastando={arrasto?.origem === stage.codigo}
                  readOnly={!etapaEhComercial(stage.codigo)}
                  podeEditar={podeEditar}
                  onDragOver={(e) => {
                    if (!arrasto) return;
                    // Coluna somente-leitura (ou arrasto vindo de uma): sem destaque,
                    // mas aceita soltar para avisar por que não move (antes era ignorado
                    // em silêncio).
                    e.preventDefault();
                    if (readOnly || !etapaEhComercial(arrasto.origem)) return;
                    if (alvo !== stage.codigo) setAlvo(stage.codigo);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setAlvo((a) => (a === stage.codigo ? null : a));
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    moverPara(stage.codigo);
                  }}
                  onAbrirEtapa={() => setDialogStage(stage.codigo)}
                  onAdicionarCliente={() =>
                    setAdicionarStage({ codigo: stage.codigo, nome: stage.nome })
                  }
                  renderCard={(c) => (
                    <CardCliente
                      key={c.id}
                      cliente={c}
                      stageCodigo={stage.codigo}
                      readOnly={readOnly}
                      podeEditar={podeEditar}
                      onDragStart={() => {
                        arrastouRef.current = true;
                        setArrasto({ clienteId: c.id, origem: stage.codigo });
                      }}
                      onDragEnd={() => {
                        setArrasto(null);
                        setAlvo(null);
                        setTimeout(() => {
                          arrastouRef.current = false;
                        }, 0);
                      }}
                      clicavel={() => !arrastouRef.current}
                      onAbrirCadastro={() =>
                        navigate({ to: "/crm/clientes/$id", params: { id: c.id } })
                      }
                      onSalvarDataVistoria={(campo, valor) =>
                        salvarDataVistoria(c.id, campo, valor)
                      }
                      onSalvarDataContrato={(valor) => salvarDataContrato(c.id, valor)}
                      onArquivarContrato={() => arquivarContratoEmitido(c.id)}
                      onLimparVinculo={() => setLimpandoVinculo({ id: c.id, nome: c.nome })}
                    />
                  )}
                />
                {stage.codigo === "contrato_emitido" && (
                  <PastaArquivados total={totalArquivados} onAbrir={() => setArquivoAberto(true)} />
                )}
              </Fragment>
            );
          })}
        </div>
      )}

      <DialogClientesEtapa
        open={!!dialogStage}
        titulo={tituloDialog}
        clientes={clientesDialog}
        verTodos={verTodos}
        onOpenChange={(o) => !o && setDialogStage(null)}
        onAbrirCliente={(id) => {
          setDialogStage(null);
          navigate({ to: "/crm/clientes/$id", params: { id } });
        }}
      />

      <DialogArquivoContratos
        open={arquivoAberto}
        onOpenChange={setArquivoAberto}
        contratos={contratosQuery.data?.itens}
        total={totalContratosFiltro}
        pagina={contratoPagina}
        totalPaginas={totalPaginasContratos}
        onPagina={setContratoPagina}
        carregando={contratosQuery.isLoading}
        erro={contratosQuery.isError}
        onTentarDeNovo={() => contratosQuery.refetch()}
        podeEditar={podeEditar}
        contratoBusca={contratoBusca}
        contratoDesde={contratoDesde}
        contratoAte={contratoAte}
        editandoContrato={editandoContrato}
        setContratoBusca={setContratoBusca}
        setContratoDesde={setContratoDesde}
        setContratoAte={setContratoAte}
        setEditandoContrato={setEditandoContrato}
        onSalvarDataContrato={(id, valor) => salvarDataContrato(id, valor, true)}
        onDesarquivar={desarquivarContrato}
        onExcluir={(id) => setExcluindoContrato(id)}
      />

      <DialogAdicionarCliente
        stage={adicionarStage}
        busca={adicionarBusca}
        termoDeb={termoAdicionarDeb}
        buscando={buscandoAdicionar}
        resultados={resultadosAdicionar}
        adicionando={adicionando}
        onOpenChange={(o) => {
          if (!o) {
            setAdicionarStage(null);
            setAdicionarBusca("");
          }
        }}
        onBuscaChange={setAdicionarBusca}
        onSelecionar={adicionarClienteNaEtapa}
      />

      <AlertExcluirContrato
        clienteId={excluindoContrato}
        onOpenChange={() => setExcluindoContrato(null)}
        onConfirmar={excluirContratoEmitido}
      />

      <AlertLimparVinculo
        info={limpandoVinculo}
        onOpenChange={() => setLimpandoVinculo(null)}
        onConfirmar={confirmarLimparVinculo}
      />
    </div>
  );
}
