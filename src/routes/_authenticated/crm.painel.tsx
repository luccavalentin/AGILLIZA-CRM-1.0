import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import { listarParceiros } from "@/lib/crm/parceiros.functions";
import { listarResponsaveisEquipe } from "@/lib/propostas/propostas.functions";
import { usePipelineRealtime } from "@/hooks/use-pipeline-realtime";

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

  // ---- Estado geral
  const [limpandoVinculo, setLimpandoVinculo] = useState<{ id: string; nome: string } | null>(null);
  const [adicionarStage, setAdicionarStage] = useState<{ codigo: string; nome: string } | null>(null);
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
  const { data: contratos, isLoading: carregandoContratos } = useQuery({
    queryKey: ["crm-contratos-emitidos"],
    queryFn: () => listarContratos(),
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
  const totalArquivados = contratos?.length ?? 0;

  const queryKey = ["crm-painel", desde, ate, escopo];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      listar({ data: { desde: desde || undefined, ate: ate || undefined, escopo } }),
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
    } catch (e) {
      if (anterior) qc.setQueryData(queryKey, anterior);
      toast.error(e instanceof Error ? e.message : "Falha ao mover o cliente.");
    } finally {
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
          clientes: s.clientes.map((c) =>
            c.id === clienteId ? { ...c, [campo]: novoValor } : c,
          ),
        })),
      );
    }
    try {
      await salvarDatas({ data: { cliente_id: clienteId, [campo]: novoValor } });
      toast.success("Data da vistoria salva.");
    } catch (e) {
      if (anterior) qc.setQueryData(queryKey, anterior);
      toast.error(e instanceof Error ? e.message : "Falha ao salvar a data.");
    } finally {
      qc.invalidateQueries({ queryKey: ["crm-painel"] });
    }
  }

  async function salvarDataContrato(clienteId: string, valor: string) {
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
      qc.invalidateQueries({ queryKey: ["crm-contratos-emitidos"] });
    } catch (e) {
      if (anterior) qc.setQueryData(queryKey, anterior);
      toast.error(e instanceof Error ? e.message : "Falha ao salvar a data.");
    } finally {
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
    } catch (e) {
      if (anterior) qc.setQueryData(queryKey, anterior);
      toast.error(e instanceof Error ? e.message : "Falha ao arquivar o contrato.");
    } finally {
      qc.invalidateQueries({ queryKey: ["crm-painel"] });
    }
  }

  async function desarquivarContrato(clienteId: string) {
    try {
      await arquivarContratoFn({ data: { cliente_id: clienteId, arquivar: false } });
      toast.success("Contrato movido de volta para a esteira.");
      qc.invalidateQueries({ queryKey: ["crm-contratos-emitidos"] });
      qc.invalidateQueries({ queryKey: ["crm-painel"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao mover o contrato.");
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
      toast.error(e instanceof Error ? e.message : "Falha ao excluir o contrato.");
    }
  }

  async function confirmarLimparVinculo() {
    if (!limpandoVinculo) return;
    const { id } = limpandoVinculo;
    setLimpandoVinculo(null);
    try {
      await limparVinculoFn({ data: { cliente_id: id } });
      toast.success("Vínculo de simulação/aprovação removido. Cliente voltou ao cadastro.");
      qc.invalidateQueries({ queryKey: ["crm-painel"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao remover o vínculo.");
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
      toast.error(e instanceof Error ? e.message : "Falha ao adicionar o cliente.");
    } finally {
      setAdicionando(false);
    }
  }

  // ---- Derivados: filtros aplicados + opções + KPIs
  const termo = busca.trim().toLowerCase();
  const termoContrato = contratoBusca.trim().toLowerCase();
  const contratosFiltrados = useMemo(
    () =>
      (contratos ?? []).filter((ct) => {
        if (termoContrato) {
          const alvoStr =
            `${ct.nome_cliente ?? ""} ${ct.numero_cliente ?? ""} ${ct.numero_proposta ?? ""} ${ct.nome_banco ?? ""}`.toLowerCase();
          if (!alvoStr.includes(termoContrato)) return false;
        }
        // Normaliza para YYYY-MM-DD antes de comparar. Sem isso, colunas com
        // horário (ex.: "2026-07-16T15:00:00Z") comparadas contra o filtro
        // "YYYY-MM-DD" excluíam o próprio dia final por comparação lexical.
        const dia = ct.contrato_emitido_em ? String(ct.contrato_emitido_em).slice(0, 10) : null;
        if (contratoDesde && (!dia || dia < contratoDesde)) return false;
        if (contratoAte && (!dia || dia > contratoAte)) return false;
        return true;
      }),
    [contratos, termoContrato, contratoDesde, contratoAte],
  );

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
  const { data: parceirosCadastrados } = useQuery({
    queryKey: ["parceiros-cadastrados"],
    queryFn: () => listarParceiros(),
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
    if (campo === "responsavel_nome" || campo === "analista_nome") {
      (equipeInterna ?? []).forEach((m) => m.nome && set.add(m.nome));
    } else if (campo === "corretor_nome") {
      (parceirosCadastrados ?? [])
        .filter((p) => (p.tipo_pessoa ?? "").toLowerCase() === "corretor")
        .forEach((p) => p.nome && set.add(p.nome));
    } else if (campo === "imobiliaria_nome") {
      (parceirosCadastrados ?? [])
        .filter((p) => (p.tipo_pessoa ?? "").toLowerCase() === "imobiliaria")
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
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 lg:gap-4">
          {dadosFiltrados.map((stage, idx) => (
            <Fragment key={stage.codigo}>
              <ColunaEsteira
                stage={stage}
                ordem={idx + 1}
                ehAlvoArrasto={alvo === stage.codigo && arrasto?.origem !== stage.codigo}
                arrastando={arrasto?.origem === stage.codigo}
                onDragOver={(e) => {
                  if (!arrasto) return;
                  e.preventDefault();
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
                    onLimparVinculo={() =>
                      setLimpandoVinculo({ id: c.id, nome: c.nome })
                    }
                  />
                )}
              />
              {stage.codigo === "contrato_emitido" && (
                <PastaArquivados
                  total={totalArquivados}
                  onAbrir={() => setArquivoAberto(true)}
                />
              )}
            </Fragment>
          ))}
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
        contratos={contratos}
        contratosFiltrados={contratosFiltrados}
        carregando={carregandoContratos}
        contratoBusca={contratoBusca}
        contratoDesde={contratoDesde}
        contratoAte={contratoAte}
        editandoContrato={editandoContrato}
        setContratoBusca={setContratoBusca}
        setContratoDesde={setContratoDesde}
        setContratoAte={setContratoAte}
        setEditandoContrato={setEditandoContrato}
        onSalvarDataContrato={salvarDataContrato}
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
