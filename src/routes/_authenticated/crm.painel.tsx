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
  ExternalLink,
  Undo2,
  Pencil,
  Trash2,
  UserPlus,
  Plus,
} from "lucide-react";


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
  const [limpandoVinculo, setLimpandoVinculo] = useState<{ id: string; nome: string } | null>(
    null,
  );

  const [desde, setDesde] = useState("");
  const [ate, setAte] = useState("");
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

  const { data: contratos, isLoading: carregandoContratos } = useQuery({
    queryKey: ["crm-contratos-emitidos"],
    queryFn: () => listarContratos(),
  });
  const totalArquivados = contratos?.length ?? 0;

  const queryKey = ["crm-painel", desde, ate];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => listar({ data: { desde: desde || undefined, ate: ate || undefined } }),
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
        clientes: termo
          ? s.clientes.filter(
              (c) =>
                c.nome.toLowerCase().includes(termo) ||
                (c.numero_cliente ?? "").toLowerCase().includes(termo),
            )
          : s.clientes,
      })),
    [data, termo],
  );
  const totalClientes = useMemo(
    () => dadosFiltrados.reduce((acc, s) => acc + s.clientes.length, 0),
    [dadosFiltrados],
  );
  const etapasAtivas = useMemo(
    () => dadosFiltrados.filter((s) => s.clientes.length > 0).length,
    [dadosFiltrados],
  );
  const verTodos = dialogStage === "__todos__";
  const stageDialog =
    dialogStage && !verTodos ? dadosFiltrados.find((s) => s.codigo === dialogStage) : null;
  const clientesDialog = verTodos
    ? dadosFiltrados.flatMap((s) => s.clientes.map((c) => ({ ...c, etapaNome: s.nome })))
    : (stageDialog?.clientes.map((c) => ({ ...c, etapaNome: stageDialog.nome })) ?? []);
  const tituloDialog = verTodos ? "Todos os clientes" : (stageDialog?.nome ?? "Etapa");

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="op-hero p-4 md:p-6">
      <div className="relative grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm ring-1 ring-primary/20">
            <Workflow className="size-5" />
          </span>
          <div className="min-w-0 space-y-0.5">
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary sm:text-[11px]">
              <span className="inline-block h-1 w-5 shrink-0 rounded-full bg-primary" />
              CRM · Painel
            </p>
            <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
              Painel da esteira
            </h1>
            <p className="text-sm text-muted-foreground">
              Visão das {dadosFiltrados.length} etapas — arraste um cliente para mover manualmente.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <button
            type="button"
            onClick={() => totalClientes > 0 && setDialogStage("__todos__")}
            disabled={totalClientes === 0}
            title={totalClientes > 0 ? "Ver todos os clientes" : undefined}
            className={`hidden items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 shadow-sm transition-all sm:flex ${
              totalClientes > 0
                ? "cursor-pointer hover:border-primary/50 hover:shadow-md"
                : "cursor-default"
            }`}
          >
            <Users className="size-4 text-primary" />
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {totalClientes}
            </span>
            <span className="text-xs text-muted-foreground">
              em {etapasAtivas} de {dadosFiltrados.length} etapas
            </span>
          </button>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cliente ou nº..."
              className="h-10 rounded-xl pl-9 pr-9 shadow-sm"
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
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">De</label>
            <Input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="h-10 w-40 rounded-xl shadow-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Até</label>
            <Input
              type="date"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
              className="h-10 w-40 rounded-xl shadow-sm"
            />
          </div>
          {(desde || ate) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-10"
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



      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                className={`group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg ${
                  ehAlvo ? "border-primary ring-2 ring-primary/40" : "border-border"
                }`}
              >
                <span
                  className={`absolute inset-x-0 top-0 h-1 origin-left transition-transform duration-300 ${
                    temClientes
                      ? "bg-gradient-to-r from-primary to-primary/40"
                      : "bg-gradient-to-r from-border to-transparent scale-x-100 group-hover:from-primary/40"
                  }`}
                />
                <div className="flex min-w-0 flex-col p-3.5">
                  <div className="mb-3 flex items-center justify-between gap-2.5 border-b border-border/70 pb-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold tabular-nums shadow-sm ring-1 transition-colors duration-300 ${
                          temClientes
                            ? "bg-primary/10 text-primary ring-primary/20 group-hover:bg-primary group-hover:text-primary-foreground group-hover:ring-primary"
                            : "bg-muted text-muted-foreground ring-border"
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <span className="min-w-0 truncate text-sm font-semibold tracking-tight text-foreground">
                        {stage.nome}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">

                      <button
                        type="button"
                        onClick={() => temClientes && setDialogStage(stage.codigo)}
                        disabled={!temClientes}
                        title={temClientes ? "Ver clientes desta etapa" : undefined}
                        className={`flex h-6 min-w-6 items-center justify-center gap-1 rounded-full px-2 text-xs font-bold tabular-nums transition-all duration-300 ${
                          temClientes
                            ? "cursor-pointer bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:ring-2 hover:ring-primary/40"
                            : "cursor-default bg-muted text-muted-foreground"
                        }`}
                      >
                        <Users className="size-3" />
                        {stage.clientes.length}
                      </button>
                    </div>

                  </div>
                  <div className="space-y-2">
                    {!temClientes ? (
                      <p
                        className={`rounded-lg border border-dashed px-3 py-5 text-center text-xs transition-colors ${
                          ehAlvo
                            ? "border-primary/60 bg-primary/5 text-primary"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        {ehAlvo ? "Solte aqui" : "Nenhum cliente"}
                      </p>
                    ) : (
                      stage.clientes.map((c) => {
                        const ehVistoria = stage.codigo === "engenharia_vistoria";
                        return (
                          <div
                            key={c.id}
                            className="rounded-lg border border-border bg-background transition-all duration-200 hover:border-primary/50 hover:shadow-md"
                          >
                            <button
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
                              onClick={() => {
                                if (arrastouRef.current) return;
                                navigate({ to: "/crm/clientes/$id", params: { id: c.id } });
                              }}
                              className="group/card flex w-full cursor-grab items-center gap-2 rounded-lg p-2.5 text-left transition-colors hover:bg-primary/5 active:scale-[0.98] active:cursor-grabbing"
                            >
                              <GripVertical className="size-4 shrink-0 text-muted-foreground/60" />
                              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary transition-all duration-200 group-hover/card:scale-110 group-hover/card:bg-primary group-hover/card:text-primary-foreground">
                                {c.nome.trim().charAt(0).toUpperCase()}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-foreground transition-colors group-hover/card:text-primary">
                                  {c.nome}
                                </span>
                                <span className="block font-mono text-[11px] text-muted-foreground">
                                  {c.numero_cliente}
                                </span>
                              </span>
                              <ChevronRight className="size-4 shrink-0 -translate-x-1 text-primary opacity-0 transition-all duration-200 group-hover/card:translate-x-0 group-hover/card:opacity-100" />
                            </button>
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
                                          className="inline-flex min-w-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold"
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
                                    className="h-7 flex-1 px-2 text-xs"
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
                                    className="h-7 flex-1 px-2 text-xs"
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
                                    className="h-7 flex-1 px-2 text-xs"
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
                </div>
              </div>
              {stage.codigo === "contrato_emitido" && (
                <button
                  type="button"
                  onClick={() => setArquivoAberto(true)}
                  title="Abrir arquivo de contratos emitidos"
                  className="group/arq relative flex min-w-0 flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/5 via-card to-primary/10 p-5 text-center shadow-sm ring-1 ring-inset ring-primary/5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-xl hover:ring-primary/20"
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
    </div>


  );
}
