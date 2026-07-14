import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Fragment, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  ChevronRight,
  GripVertical,
  CalendarClock,
  CalendarCheck,
  FolderClosed,
  FileText,
  Building2,
  Workflow,
  KanbanSquare,
  Users,
  Search,
  Archive,
  X,
  MoreVertical,
  MoreHorizontal,
  ExternalLink,
  Undo2,
  Pencil,
  Trash2,
  UserPlus,
  UserCheck,
  Plus,
  Filter,
  Clock,
  User,
  Send,
  Star,
  HardHat,
  Scale,
  FileCheck2,
  Calculator,
  ArrowRight,
  TrendingUp,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

const ICONES_ETAPA: Record<string, LucideIcon> = {
  cadastro_basico: UserPlus,
  cadastro_completo: UserCheck,
  simulacao: Calculator,
  credito_enviado: Send,
  credito_aprovado: Star,
  coleta_documentos: FolderClosed,
  engenharia_vistoria: HardHat,
  analise_juridica: Scale,
  contrato_emitido: FileCheck2,
};

function tempoRelativo(iso: string | null): string {
  if (!iso) return "sem data";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}


import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { DateInput } from "@/components/shared/date-input";
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

import { usePipelineRealtime } from "@/hooks/use-pipeline-realtime";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { corDoBanco } from "@/lib/bancos/cores";
import { statusProposta } from "@/components/propostas/status";

export const Route = createFileRoute("/_authenticated/crm/painel")({
  head: () => ({ meta: [{ title: "Painel da esteira — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("crm.clientes"),
  component: Pagina,
  errorComponent: () => (
    <div className="p-6 text-sm text-destructive">Erro ao carregar o painel.</div>
  ),
});

interface Arrasto {
  clienteId: string;
  origem: string;
}

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
  const [limpandoVinculo, setLimpandoVinculo] = useState<{ id: string; nome: string } | null>(
    null,
  );
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
    const fmt = (dt: Date) => dt.toISOString().slice(0, 10);
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

  const { data: contratos, isLoading: carregandoContratos } = useQuery({
    queryKey: ["crm-contratos-emitidos"],
    queryFn: () => listarContratos(),
  });
  const totalArquivados = contratos?.length ?? 0;

  const queryKey = ["crm-painel", desde, ate, escopo];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      listar({ data: { desde: desde || undefined, ate: ate || undefined, escopo } }),
  });

  const termoAdicionar = adicionarBusca.trim();
  const { data: resultadosAdicionar, isFetching: buscandoAdicionar } = useQuery({
    queryKey: ["crm-painel-buscar-cliente", termoAdicionar],
    queryFn: () => buscarClientes({ data: { q: termoAdicionar } }),
    enabled: !!adicionarStage && termoAdicionar.length >= 2,
  });

  async function moverPara(codigoDestino: string) {

    const info = arrasto;
    setArrasto(null);
    setAlvo(null);
    if (!info || info.origem === codigoDestino) return;

    // Atualização otimista: move o card na hora.
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
      await salvarContratoData({ data: { cliente_id: clienteId, contrato_emitido_em: novoValor } });
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











  const termo = busca.trim().toLowerCase();
  const termoContrato = contratoBusca.trim().toLowerCase();
  const contratosFiltrados = useMemo(
    () =>
      (contratos ?? []).filter((ct) => {
        if (termoContrato) {
          const alvo = `${ct.nome_cliente ?? ""} ${ct.numero_cliente ?? ""} ${ct.numero_proposta ?? ""} ${ct.nome_banco ?? ""}`.toLowerCase();
          if (!alvo.includes(termoContrato)) return false;
        }
        const dia = ct.contrato_emitido_em ?? null;
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
          if (respFiltro !== "todos" && (c.responsavel_nome ?? "") !== respFiltro)
            return false;
          if (analistaFiltro !== "todos" && (c.analista_nome ?? "") !== analistaFiltro)
            return false;
          if (corretorFiltro !== "todos" && (c.corretor_nome ?? "") !== corretorFiltro)
            return false;
          if (imobFiltro !== "todos" && (c.imobiliaria_nome ?? "") !== imobFiltro)
            return false;
          return true;
        }),
      })),
    [data, termo, respFiltro, analistaFiltro, corretorFiltro, imobFiltro],
  );
  const totalClientes = useMemo(
    () => dadosFiltrados.reduce((acc, s) => acc + s.clientes.length, 0),
    [dadosFiltrados],
  );
  const etapasAtivas = useMemo(
    () => dadosFiltrados.filter((s) => s.clientes.length > 0).length,
    [dadosFiltrados],
  );
  function opcoesDe(campo: "responsavel_nome" | "analista_nome" | "corretor_nome" | "imobiliaria_nome"): string[] {
    const set = new Set<string>();
    (data ?? []).forEach((s) =>
      s.clientes.forEach((c) => {
        const v = c[campo];
        if (v) set.add(v);
      }),
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }
  const responsaveis = useMemo(() => opcoesDe("responsavel_nome"), [data]);
  const analistas = useMemo(() => opcoesDe("analista_nome"), [data]);
  const corretores = useMemo(() => opcoesDe("corretor_nome"), [data]);
  const imobiliarias = useMemo(() => opcoesDe("imobiliaria_nome"), [data]);
  const todosClientes = useMemo(
    () => dadosFiltrados.flatMap((s) => s.clientes),
    [dadosFiltrados],
  );
  const clientesParados = useMemo(
    () =>
      todosClientes.filter(
        (c) =>
          c.pipeline_atualizado_em &&
          Date.now() - new Date(c.pipeline_atualizado_em).getTime() > 7 * 864e5,
      ).length,
    [todosClientes],
  );
  const tempoMedioDias = useMemo(() => {
    const ds = todosClientes
      .map((c) =>
        c.pipeline_atualizado_em
          ? Math.floor((Date.now() - new Date(c.pipeline_atualizado_em).getTime()) / 864e5)
          : null,
      )
      .filter((x): x is number => x != null);
    if (!ds.length) return 0;
    return Math.round(ds.reduce((a, b) => a + b, 0) / ds.length);
  }, [todosClientes]);
  const contratosMes = useMemo(() => {
    const d = new Date();
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return (contratos ?? []).filter((ct) => (ct.contrato_emitido_em ?? "").startsWith(ym))
      .length;
  }, [contratos]);
  const verTodos = dialogStage === "__todos__";
  const stageDialog =
    dialogStage && !verTodos ? dadosFiltrados.find((s) => s.codigo === dialogStage) : null;
  const clientesDialog = verTodos
    ? dadosFiltrados.flatMap((s) => s.clientes.map((c) => ({ ...c, etapaNome: s.nome })))
    : (stageDialog?.clientes.map((c) => ({ ...c, etapaNome: stageDialog.nome })) ?? []);
  const tituloDialog = verTodos ? "Todos os clientes" : (stageDialog?.nome ?? "Etapa");

  return (
    <div className="space-y-4 overflow-x-hidden p-3 sm:space-y-6 sm:p-6">
      {/* Cabeçalho */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:rounded-2xl sm:p-6">
        <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <Workflow className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                Painel da Esteira
              </h1>
              <p className="truncate text-sm text-muted-foreground">
                Acompanhe o fluxo dos clientes em cada etapa do processo.
              </p>
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 md:shrink-0 md:justify-end">
            <span className="hidden items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground md:inline-flex">
              <span className="size-2 animate-pulse rounded-full bg-success" />
              Atualizado agora
            </span>
            <div className="inline-flex min-w-0 flex-1 items-center rounded-full border border-border bg-background p-1 sm:flex-none">
              {(["minhas", "geral"] as const).map((op) => (
                <button
                  key={op}
                  type="button"
                  onClick={() => setEscopo(op)}
                  className={`min-w-0 flex-1 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-all sm:flex-none sm:px-3.5 ${
                    escopo === op
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {op === "minhas" ? "Minhas esteiras" : "Geral"}
                </button>
              ))}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9 shrink-0 rounded-full"
                  title="Mais ações"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setArquivoAberto(true)}>
                  <FolderClosed className="mr-2 size-4" /> Contratos emitidos
                  {totalArquivados > 0 && (
                    <span className="ml-auto rounded-full bg-primary/10 px-1.5 text-[10px] font-bold text-primary">
                      {totalArquivados}
                    </span>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => totalClientes > 0 && setDialogStage("__todos__")}
                  disabled={totalClientes === 0}
                >
                  <Users className="mr-2 size-4" /> Ver todos os clientes
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={limparTodosFiltros}>
                  <Filter className="mr-2 size-4" /> Limpar filtros
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Barra de filtros */}
      <div className="rounded-xl border border-border bg-card p-3 shadow-sm sm:rounded-2xl sm:p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-4">
          <div className="flex min-w-0 items-center gap-3 md:border-r md:border-border md:pr-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary sm:size-11">
              <Users className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-2xl font-bold leading-none tabular-nums text-foreground">
                {totalClientes}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                de {dadosFiltrados.length} etapas
              </p>
            </div>
          </div>

          <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            <div className="min-w-0 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Período</label>
              <select
                value={periodo}
                onChange={(e) => aplicarPeriodo(e.target.value)}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="todos">Todos</option>
                <option value="mes">Este mês</option>
                <option value="7d">Últimos 7 dias</option>
                <option value="30d">Últimos 30 dias</option>
                <option value="ano">Este ano</option>
                <option value="custom">Personalizado</option>
              </select>
            </div>

            <div className="min-w-0 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Responsável</label>
              <select
                value={respFiltro}
                onChange={(e) => setRespFiltro(e.target.value)}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="todos">Todos</option>
                {responsaveis.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative min-w-0 space-y-1 sm:col-span-2 md:col-span-1">
              <label className="text-xs font-medium text-muted-foreground">Buscar</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Cliente ou nº..."
                  className="h-10 w-full rounded-xl pl-9 pr-9 shadow-sm"
                />
                {busca && (
                  <button
                    type="button"
                    onClick={() => setBusca("")}
                    className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Limpar busca"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="min-w-0 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">De</label>
              <Input
                type="date"
                value={desde}
                onChange={(e) => {
                  setDesde(e.target.value);
                  setPeriodo("custom");
                }}
                className="h-10 w-full rounded-xl shadow-sm"
              />
            </div>
            <div className="min-w-0 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Até</label>
              <Input
                type="date"
                value={ate}
                onChange={(e) => {
                  setAte(e.target.value);
                  setPeriodo("custom");
                }}
                className="h-10 w-full rounded-xl shadow-sm"
              />
            </div>
          </div>

          <Button
            variant="ghost"
            className="h-10 shrink-0 justify-center gap-2 text-primary hover:bg-primary/5 hover:text-primary md:self-end"
            onClick={limparTodosFiltros}
          >
            Limpar filtros
            <Filter className="size-4" />
          </Button>
        </div>
      </div>



      {isLoading ? (
        <div className="no-scrollbar -mx-3 overflow-x-auto overscroll-x-contain px-3 pb-4 sm:-mx-6 sm:px-6">

          <div className="grid grid-flow-col auto-cols-[17rem] gap-3 sm:auto-cols-[19rem] lg:auto-cols-[20rem] lg:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-96 w-full rounded-2xl" />
          ))}
          </div>
        </div>
      ) : (
        <div className="no-scrollbar -mx-3 overflow-x-auto overscroll-x-contain px-3 pb-4 sm:-mx-6 sm:px-6">
        <div className="grid grid-flow-col auto-cols-[17rem] gap-3 sm:auto-cols-[19rem] lg:auto-cols-[20rem] lg:gap-4">
          {dadosFiltrados.map((stage, idx) => {
            const temClientes = stage.clientes.length > 0;
            const ehAlvo = alvo === stage.codigo && arrasto?.origem !== stage.codigo;
            return (
              <Fragment key={stage.codigo}>
              <div
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
                className={`group relative flex min-h-[24rem] min-w-0 flex-col rounded-2xl border bg-card shadow-sm transition-all duration-300 hover:shadow-md sm:max-h-[calc(100dvh-18rem)] ${
                  ehAlvo ? "border-primary ring-2 ring-primary/40" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary text-[11px] font-bold tabular-nums text-primary-foreground">
                      {idx + 1}
                    </span>
                    <span className="min-w-0 truncate text-sm font-semibold tracking-tight text-foreground">
                      {stage.nome}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => temClientes && setDialogStage(stage.codigo)}
                    disabled={!temClientes}
                    title={temClientes ? "Ver clientes desta etapa" : undefined}
                    className={`min-w-6 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums transition-colors ${
                      temClientes
                        ? "cursor-pointer bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
                        : "cursor-default text-muted-foreground"
                    }`}
                  >
                    {stage.clientes.length}
                  </button>
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain p-3">
                    {!temClientes ? (
                      <div
                        className={`flex min-h-[12rem] flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8 text-center transition-colors ${
                          ehAlvo
                            ? "border-primary/60 bg-primary/5 text-primary"
                            : "border-transparent text-muted-foreground"
                        }`}
                      >
                        {(() => {
                          const Icone = ICONES_ETAPA[stage.codigo] ?? Users;
                          return <Icone className="size-6 opacity-40" />;
                        })()}
                        <span className="text-xs">
                          {ehAlvo ? "Solte aqui" : "Nenhum cliente nesta etapa"}
                        </span>
                      </div>
                    ) : (
                      stage.clientes.map((c) => {
                        const ehVistoria = stage.codigo === "engenharia_vistoria";
                        return (
                          <div
                            key={c.id}
                            draggable
                            onDragStart={(e) => {
                              arrastouRef.current = true;
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData("text/plain", c.id);
                              setArrasto({ clienteId: c.id, origem: stage.codigo });
                            }}
                            onDragEnd={() => {
                              setArrasto(null);
                              setAlvo(null);
                              setTimeout(() => {
                                arrastouRef.current = false;
                              }, 0);
                            }}
                            className="cursor-grab rounded-xl border border-border bg-card transition-all duration-200 hover:border-primary/40 hover:shadow-sm active:cursor-grabbing"
                          >
                            <div className="p-3">
                              <div className="flex items-start gap-2.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (arrastouRef.current) return;
                                    navigate({ to: "/crm/clientes/$id", params: { id: c.id } });
                                  }}
                                  className="group/card flex min-w-0 flex-1 items-start gap-2.5 text-left"
                                >
                                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary transition-colors group-hover/card:bg-primary group-hover/card:text-primary-foreground">
                                    {c.nome.trim().charAt(0).toUpperCase()}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold text-foreground transition-colors group-hover/card:text-primary">
                                      {c.nome}
                                    </span>
                                    <span className="block font-mono text-[11px] text-muted-foreground">
                                      {c.numero_cliente}
                                    </span>
                                  </span>
                                </button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={(e) => e.stopPropagation()}
                                      className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                      title="Ações do cliente"
                                    >
                                      <MoreHorizontal className="size-4" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() =>
                                        navigate({ to: "/crm/clientes/$id", params: { id: c.id } })
                                      }
                                    >
                                      <ExternalLink className="mr-2 size-4" /> Abrir cadastro
                                    </DropdownMenuItem>
                                    {c.numero_proposta && (
                                      <DropdownMenuItem asChild>
                                        <Link
                                          to="/operacional/propostas/kanban"
                                          search={{ q: c.numero_proposta }}
                                        >
                                          <KanbanSquare className="mr-2 size-4" /> Ver proposta
                                        </Link>
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                              <div className="mt-2.5 space-y-1">
                                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                  <User className="size-3 shrink-0" />
                                  <span className="truncate">
                                    {c.responsavel_nome ?? "Sem responsável"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                  <Clock className="size-3 shrink-0" />
                                  Atualizado {tempoRelativo(c.pipeline_atualizado_em)}
                                </div>
                              </div>
                            </div>
                            {(() => {
                              const dependente = [
                                "simulacao",
                                "credito_enviado",
                                "credito_aprovado",
                              ].includes(stage.codigo);
                              const temProposta = Boolean(c.numero_proposta);
                              if (!temProposta && !dependente) return null;
                              const st = (c.proposta_status ?? "").toLowerCase();
                              const aprovado = st.includes("aprovad");
                              const recusado =
                                st.includes("recusad") ||
                                st.includes("reprovad") ||
                                st.includes("cancelad");
                              const corBanco = corDoBanco(c.nome_banco);
                              const statusClasse = aprovado
                                ? "bg-success/10 text-success ring-success/25"
                                : recusado
                                  ? "bg-destructive/10 text-destructive ring-destructive/25"
                                  : "bg-primary/10 text-primary ring-primary/20";
                              return (
                                <div className="space-y-1.5 border-t border-border/70 px-2.5 py-2">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {temProposta ? (
                                      <Link
                                        to="/operacional/propostas/kanban"
                                        search={{ q: c.numero_proposta ?? c.nome }}
                                        onClick={(e) => e.stopPropagation()}
                                        title={`Ver proposta ${c.numero_proposta} no kanban`}
                                        className="group/kb inline-flex min-w-0 flex-1 items-center gap-1.5 rounded-full bg-primary/[0.07] px-2 py-1 text-[11px] font-medium text-primary ring-1 ring-inset ring-primary/15 transition-all duration-200 hover:bg-primary/15 hover:ring-primary/30 active:scale-[0.98]"
                                      >
                                        <KanbanSquare className="size-3 shrink-0" />
                                        <span className="truncate font-mono">
                                          {c.numero_proposta}
                                        </span>
                                        <ChevronRight className="size-3 shrink-0 -translate-x-0.5 opacity-0 transition-all duration-200 group-hover/kb:translate-x-0 group-hover/kb:opacity-100" />
                                      </Link>
                                    ) : (
                                      <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                                        Sem proposta vinculada
                                      </span>
                                    )}
                                    {dependente && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setLimpandoVinculo({ id: c.id, nome: c.nome });
                                        }}
                                        title="Excluir vínculo de simulação/aprovação e voltar ao cadastro"
                                        className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-destructive ring-1 ring-inset ring-destructive/20 transition-colors hover:bg-destructive/10"
                                      >
                                        <Trash2 className="size-3 shrink-0" />
                                        <span className="hidden min-[380px]:inline">Excluir vínculo</span>
                                      </button>
                                    )}
                                  </div>

                                  {temProposta && (c.nome_banco || c.proposta_status) && (
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      {c.nome_banco && (
                                        <span
                                          className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold"
                                          style={{
                                            color: corBanco,
                                            borderColor: `color-mix(in oklab, ${corBanco} 35%, transparent)`,
                                            backgroundColor: `color-mix(in oklab, ${corBanco} 8%, transparent)`,
                                          }}
                                          title={c.nome_banco}
                                        >
                                          <BancoLogo nome={c.nome_banco} size="xs" className="shrink-0" />
                                          <span className="truncate">{c.nome_banco}</span>
                                        </span>
                                      )}
                                      {c.proposta_status && (
                                        <span
                                          className={`inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${statusClasse}`}
                                        >
                                          {statusProposta(c.proposta_status).label}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}


                            {ehVistoria && (
                              <div className="space-y-2 border-t border-border/70 px-2.5 py-2">
                                <div className="flex items-center gap-2">
                                  <CalendarClock className="size-3.5 shrink-0 text-muted-foreground" />
                                  <label className="w-16 shrink-0 text-[11px] font-medium text-muted-foreground">
                                    Agendada
                                  </label>
                                  <Input
                                    type="date"
                                    value={c.vistoria_agendada_em ?? ""}
                                    onChange={(e) =>
                                      salvarDataVistoria(c.id, "vistoria_agendada_em", e.target.value)
                                    }
                                    className="h-7 min-w-0 flex-1 px-2 text-xs"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <CalendarCheck className="size-3.5 shrink-0 text-primary" />
                                  <label className="w-16 shrink-0 text-[11px] font-medium text-muted-foreground">
                                    Concluída
                                  </label>
                                  <Input
                                    type="date"
                                    value={c.vistoria_concluida_em ?? ""}
                                    onChange={(e) =>
                                      salvarDataVistoria(c.id, "vistoria_concluida_em", e.target.value)
                                    }
                                    className="h-7 min-w-0 flex-1 px-2 text-xs"
                                  />
                                </div>
                              </div>
                            )}
                            {stage.codigo === "contrato_emitido" && (
                              <div className="space-y-2 border-t border-border/70 px-2.5 py-2">
                                <div className="flex items-center gap-2">
                                  <CalendarCheck className="size-3.5 shrink-0 text-primary" />
                                  <label className="shrink-0 text-[11px] font-medium text-muted-foreground">
                                    Emitido em
                                  </label>
                                  <Input
                                    type="date"
                                    value={c.contrato_emitido_em ?? ""}
                                    onChange={(e) => salvarDataContrato(c.id, e.target.value)}
                                    className="h-7 min-w-0 flex-1 px-2 text-xs"
                                    title="Data de emissão do contrato (definida por você)"
                                  />
                                </div>
                                {c.contrato_emitido_em && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => arquivarContratoEmitido(c.id)}
                                    className="h-7 w-full gap-1.5 text-xs"
                                  >
                                    <Archive className="size-3.5" />
                                    Arquivar contrato
                                  </Button>
                                )}
                              </div>
                            )}

                          </div>
                        );
                      })

                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setAdicionarStage({ codigo: stage.codigo, nome: stage.nome })
                    }
                    className="flex w-full items-center justify-center gap-1.5 border-t border-border px-3 py-2.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/5"
                  >
                    <Plus className="size-3.5" />
                    Adicionar cliente
                  </button>
                </div>
              {stage.codigo === "contrato_emitido" && (
                <button
                  type="button"
                  onClick={() => setArquivoAberto(true)}
                  title="Abrir arquivo de contratos emitidos"
                  className="group/arq relative flex min-h-[18rem] min-w-0 flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/5 via-card to-primary/10 p-5 text-center shadow-sm ring-1 ring-inset ring-primary/5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-xl hover:ring-primary/20"
                >
                  <span className="pointer-events-none absolute -right-6 -top-6 size-20 rounded-full bg-primary/10 blur-2xl transition-opacity duration-300 group-hover/arq:opacity-80" />
                  <span className="relative grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary shadow-inner transition-all duration-300 group-hover/arq:scale-105 group-hover/arq:bg-primary group-hover/arq:text-primary-foreground group-hover/arq:shadow-lg">
                    <FolderClosed className="size-6" />
                    {totalArquivados > 0 && (
                      <span className="absolute -right-1.5 -top-1.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground shadow-md ring-2 ring-card">
                        {totalArquivados}
                      </span>
                    )}
                  </span>
                  <span className="relative flex flex-col gap-1">
                    <span className="text-sm font-semibold text-foreground">Contratos emitidos</span>
                    <span className="text-[11px] leading-snug text-muted-foreground">
                      {totalArquivados > 0
                        ? `${totalArquivados} contrato${totalArquivados > 1 ? "s" : ""} arquivado${totalArquivados > 1 ? "s" : ""}`
                        : "Arquivo dos contratos já emitidos"}
                    </span>
                  </span>
                  <span className="relative mt-0.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary transition-colors group-hover/arq:bg-primary group-hover/arq:text-primary-foreground">
                    Abrir arquivo
                  </span>
                </button>
              )}
              </Fragment>
            );
          })}
        </div>
        </div>
      )}

      <Dialog open={!!dialogStage} onOpenChange={(o) => !o && setDialogStage(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="size-4 text-primary" />
              {tituloDialog}
            </DialogTitle>
            <DialogDescription>
              {clientesDialog.length} cliente(s). Clique para abrir o cadastro.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {clientesDialog.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setDialogStage(null);
                  navigate({ to: "/crm/clientes/$id", params: { id: c.id } });
                }}
                className="group flex w-full items-center gap-2.5 rounded-lg border border-border bg-background p-2.5 text-left transition-all hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary transition-all group-hover:bg-primary group-hover:text-primary-foreground">
                  {c.nome.trim().charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                    {c.nome}
                  </span>
                  <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                    {c.numero_cliente}
                    {verTodos && (
                      <span className="truncate rounded-full bg-muted px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted-foreground">
                        {c.etapaNome}
                      </span>
                    )}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            ))}
          </div>

        </DialogContent>
      </Dialog>

      <Dialog open={arquivoAberto} onOpenChange={setArquivoAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderClosed className="size-4 text-primary" />
              Contratos emitidos
            </DialogTitle>
            <DialogDescription>
              Arquivo dos contratos já emitidos — pesquise e filtre por data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 border-y border-border/60 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={contratoBusca}
                onChange={(e) => setContratoBusca(e.target.value)}
                placeholder="Buscar por nome, nº do cliente, proposta ou banco..."
                className="h-9 rounded-lg pl-9 pr-9 text-sm"
              />
              {contratoBusca && (
                <button
                  type="button"
                  onClick={() => setContratoBusca("")}
                  className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Limpar busca"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">Emitido de</label>
                <Input
                  type="date"
                  value={contratoDesde}
                  onChange={(e) => setContratoDesde(e.target.value)}
                  className="h-9 w-36 rounded-lg text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">até</label>
                <Input
                  type="date"
                  value={contratoAte}
                  onChange={(e) => setContratoAte(e.target.value)}
                  className="h-9 w-36 rounded-lg text-sm"
                />
              </div>
              {(contratoDesde || contratoAte || contratoBusca) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9"
                  onClick={() => {
                    setContratoBusca("");
                    setContratoDesde("");
                    setContratoAte("");
                  }}
                >
                  Limpar
                </Button>
              )}
              <span className="ml-auto self-center text-[11px] tabular-nums text-muted-foreground">
                {contratosFiltrados.length} contrato(s)
              </span>
            </div>
          </div>
          <div className="mt-3 max-h-[52vh] space-y-2 overflow-y-auto pr-1">
            {carregandoContratos ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))
            ) : (contratos ?? []).length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-4 py-10 text-center">
                <FolderClosed className="size-7 text-muted-foreground/60" />
                <p className="text-sm text-muted-foreground">
                  Nenhum contrato emitido arquivado ainda.
                </p>
              </div>
            ) : contratosFiltrados.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-4 py-10 text-center">
                <Search className="size-7 text-muted-foreground/60" />
                <p className="text-sm text-muted-foreground">
                  Nenhum contrato encontrado com esses filtros.
                </p>
              </div>
            ) : (
              contratosFiltrados.map((ct) => (
                <div
                  key={ct.cliente_id}
                  className="group flex items-start gap-3 rounded-lg border border-border bg-background p-3 transition-all hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm"
                >
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setArquivoAberto(false);
                        navigate({ to: "/crm/clientes/$id", params: { id: ct.cliente_id } });
                      }}
                      className="block max-w-full truncate text-left text-sm font-medium text-foreground underline-offset-2 transition-colors hover:text-primary hover:underline"
                      title="Abrir cadastro do cliente"
                    >
                      {ct.nome_cliente ?? "Cliente"}
                    </button>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      {ct.proposta_id ? (
                        <button
                          type="button"
                          onClick={() => {
                            setArquivoAberto(false);
                            navigate({
                              to: "/operacional/propostas/$id",
                              params: { id: ct.proposta_id! },
                            });
                          }}
                          className="inline-flex items-center gap-1 font-mono text-primary underline-offset-2 transition-colors hover:underline"
                          title="Abrir proposta"
                        >
                          <FileText className="size-3" />
                          {ct.numero_proposta ?? "Ver proposta"}
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-mono">
                          <FileText className="size-3" />
                          {ct.numero_proposta ?? "—"}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <CalendarCheck className="size-3" />
                        {ct.contrato_emitido_em
                          ? new Date(ct.contrato_emitido_em).toLocaleDateString("pt-BR")
                          : "—"}
                      </span>
                      {ct.nome_banco && (
                        <button
                          type="button"
                          onClick={() => {
                            setArquivoAberto(false);
                            navigate({
                              to: "/operacional/propostas/kanban",
                              search: { q: ct.nome_banco! },
                            });
                          }}
                          className="inline-flex items-center gap-1 text-primary underline-offset-2 transition-colors hover:underline"
                          title="Ver propostas deste banco"
                        >
                          <Building2 className="size-3" />
                          {ct.nome_banco}
                        </button>
                      )}
                    </span>
                    {editandoContrato === ct.cliente_id && (
                      <div className="mt-2 flex items-center gap-2">
                        <DateInput
                          value={ct.contrato_emitido_em ?? ""}
                          onChange={(v) => salvarDataContrato(ct.cliente_id, v)}
                          className="h-8 flex-1"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => setEditandoContrato(null)}
                        >
                          Concluir
                        </Button>
                      </div>
                    )}
                  </span>
                  {ct.valor_financiamento != null && (
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">
                      {`R$ ${Number(ct.valor_financiamento).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                    </span>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 text-muted-foreground"
                        title="Ações do contrato"
                      >
                        <MoreVertical className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setArquivoAberto(false);
                          navigate({ to: "/crm/clientes/$id", params: { id: ct.cliente_id } });
                        }}
                      >
                        <ExternalLink className="mr-2 size-4" /> Abrir cadastro
                      </DropdownMenuItem>
                      {ct.proposta_id && (
                        <DropdownMenuItem
                          onClick={() => {
                            setArquivoAberto(false);
                            navigate({
                              to: "/operacional/propostas/$id",
                              params: { id: ct.proposta_id! },
                            });
                          }}
                        >
                          <FileText className="mr-2 size-4" /> Visualizar proposta
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => setEditandoContrato(ct.cliente_id)}>
                        <Pencil className="mr-2 size-4" /> Editar data de emissão
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => desarquivarContrato(ct.cliente_id)}>
                        <Undo2 className="mr-2 size-4" /> Mover para a esteira
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setExcluindoContrato(ct.cliente_id)}
                      >
                        <Trash2 className="mr-2 size-4" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!excluindoContrato}
        onOpenChange={(o) => !o && setExcluindoContrato(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contrato emitido?</AlertDialogTitle>
            <AlertDialogDescription>
              O registro de contrato emitido será removido e o cliente voltará para a esteira. Esta
              ação pode ser refeita definindo novamente a data de emissão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (excluindoContrato) excluirContratoEmitido(excluindoContrato);
                setExcluindoContrato(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!limpandoVinculo}
        onOpenChange={(o) => !o && setLimpandoVinculo(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir vínculo de simulação/aprovação?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso remove por completo o vínculo de {limpandoVinculo?.nome} com simulações e
              propostas (inclusive registros já excluídos) e retorna o cliente para a etapa de
              cadastro. O cadastro do cliente é mantido. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarLimparVinculo}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir vínculo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!adicionarStage}
        onOpenChange={(o) => {
          if (!o) {
            setAdicionarStage(null);
            setAdicionarBusca("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-4 text-primary" />
              Adicionar cliente — {adicionarStage?.nome}
            </DialogTitle>
            <DialogDescription>
              Pesquise por nome, documento ou e-mail e selecione um cliente já cadastrado para
              inseri-lo nesta etapa. As demais etapas avançam automaticamente conforme a operação.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={adicionarBusca}
                onChange={(e) => setAdicionarBusca(e.target.value)}
                placeholder="Buscar cliente cadastrado..."
                className="h-10 rounded-xl pl-9"
              />
            </div>
            <div className="max-h-72 space-y-1.5 overflow-y-auto">
              {termoAdicionar.length < 2 ? (
                <p className="px-1 py-4 text-center text-xs text-muted-foreground">
                  Digite ao menos 2 caracteres para buscar.
                </p>
              ) : buscandoAdicionar ? (
                <div className="space-y-1.5">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-lg" />
                  ))}
                </div>
              ) : (resultadosAdicionar ?? []).length === 0 ? (
                <p className="px-1 py-4 text-center text-xs text-muted-foreground">
                  Nenhum cliente encontrado.
                </p>
              ) : (
                (resultadosAdicionar ?? []).map((cli: any) => (
                  <button
                    key={cli.id}
                    type="button"
                    disabled={adicionando}
                    onClick={() => adicionarClienteNaEtapa(cli.id)}
                    className="flex w-full items-center gap-2.5 rounded-lg border border-border p-2.5 text-left transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:opacity-60"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {(cli.nome ?? "?").trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {cli.nome}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {cli.documento || cli.email || cli.telefone_celular || "—"}
                      </span>
                    </span>
                    <Plus className="size-4 shrink-0 text-primary" />
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>



  );
}
