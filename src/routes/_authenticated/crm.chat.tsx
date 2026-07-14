import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  MessagesSquare,
  Search,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Tag,
  Plus,
  Trash2,
  AlarmClock,
  BellRing,
  Timer,
  Check,
  ChevronDown,
  GitBranch,
  Archive,
  ArchiveRestore,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { assertModuloPermitido } from "@/lib/route-guards";
import { supabase } from "@/integrations/supabase/client";
import { ChatClienteTab } from "@/components/crm/chat-cliente-tab";
import { ChatParticipantes } from "@/components/crm/chat-participantes";
import {
  listarConversasCliente,
  buscarClientesApp,
} from "@/lib/crm/chat-cliente.functions";
import {
  getPipelineStages,
  getClientePipeline,
  moverEtapa,
} from "@/lib/crm/clientes.functions";
import {
  listarEtiquetasChat,
  criarEtiquetaChat,
  excluirEtiquetaChat,
  definirEtiquetasCliente,
  getChatMeta,
  salvarChatMeta,
  overviewGestaoChat,
  definirArquivamentoConversa,
  type ChatEtiqueta,
} from "@/lib/crm/chat-gestao.functions";
import { ChatConfigSheet } from "@/components/shared/chat-config-sheet";
import { PainelChatCliente } from "@/components/crm/chat-cliente/painel-cliente";



export const Route = createFileRoute("/_authenticated/crm/chat")({
  head: () => ({ meta: [{ title: "Chat e Follow-up Cliente — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("crm.clientes"),
  component: Pagina,
});

const CORES = [
  { id: "blue", nome: "Azul" },
  { id: "green", nome: "Verde" },
  { id: "amber", nome: "Âmbar" },
  { id: "red", nome: "Vermelho" },
  { id: "purple", nome: "Roxo" },
  { id: "slate", nome: "Cinza" },
] as const;

type FiltroChat = "todas" | "nao_lidas" | "sla" | "lembrete" | "arquivadas";

function _formatarHoraLegacy(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
void _formatarHoraLegacy;

function rotuloDia(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  const mesmoDia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (mesmoDia(d, hoje)) return "Hoje";
  if (mesmoDia(d, ontem)) return "Ontem";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function iniciais(nome?: string | null): string {
  if (!nome) return "?";
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

function TagChip({
  etiqueta,
  onRemove,
}: {
  etiqueta: ChatEtiqueta;
  onRemove?: () => void;
}) {
  return (
    <span className={cn("chat-tag", `chat-tag-${etiqueta.cor}`)}>
      {etiqueta.nome}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="opacity-70 hover:opacity-100"
          aria-label={`Remover ${etiqueta.nome}`}
        >
          ×
        </button>
      )}
    </span>
  );
}




function Pagina() {
  const qc = useQueryClient();
  const listar = useServerFn(listarConversasCliente);
  const buscarApp = useServerFn(buscarClientesApp);
  const getOverview = useServerFn(overviewGestaoChat);
  const listarEtiq = useServerFn(listarEtiquetasChat);

  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroChat>("todas");
  const [etiquetaFiltro, setEtiquetaFiltro] = useState<string>("all");
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [atendenteSel, setAtendenteSel] = useState<string | null>(null);
  // Visão supervisora: quando ligada, gestores veem também as conversas dos
  // demais atendentes (o back-end ignora para quem não é gestor).
  const [verTodos, setVerTodos] = useState(false);

  function abrirConversa(clienteId: string, atendenteId: string | null) {
    setSelecionado(clienteId);
    setAtendenteSel(atendenteId);
  }

  const queryKey = ["conversas-cliente", verTodos];
  const { data: conversas, isLoading } = useQuery({
    queryKey,
    queryFn: () => listar({ data: { ver_todos: verTodos } }),
  });

  const { data: etiquetas } = useQuery({
    queryKey: ["chat-etiquetas"],
    queryFn: () => listarEtiq(),
  });

  const idsConversa = useMemo(
    () => (conversas ?? []).map((c) => c.cliente_id),
    [conversas],
  );

  const { data: overview } = useQuery({
    queryKey: ["chat-overview", idsConversa],
    queryFn: () => getOverview({ data: { cliente_ids: idsConversa } }),
    enabled: idsConversa.length > 0,
  });

  const etiquetasPorId = useMemo(() => {
    const m = new Map<string, ChatEtiqueta>();
    for (const e of etiquetas ?? []) m.set(e.id, e);
    return m;
  }, [etiquetas]);

  const etiquetasCliente = useMemo(() => {
    const m = new Map<string, ChatEtiqueta[]>();
    for (const l of overview?.links ?? []) {
      const et = etiquetasPorId.get(l.etiqueta_id);
      if (!et) continue;
      const arr = m.get(l.cliente_id) ?? [];
      arr.push(et);
      m.set(l.cliente_id, arr);
    }
    return m;
  }, [overview, etiquetasPorId]);

  const metasCliente = useMemo(() => {
    const m = new Map<
      string,
      { sla_horas: number; lembrete_em: string | null; arquivado: boolean }
    >();
    for (const meta of overview?.metas ?? []) {
      m.set(meta.cliente_id, {
        sla_horas: meta.sla_atualizacao_horas,
        lembrete_em: meta.lembrete_em,
        arquivado: meta.arquivado ?? false,
      });
    }
    return m;
  }, [overview]);

  const agora = Date.now();
  function slaEstourado(clienteId: string, ultimoRemetente: string, ultimaEm: string) {
    if (ultimoRemetente !== "cliente") return false;
    const horas = metasCliente.get(clienteId)?.sla_horas ?? 24;
    return agora - new Date(ultimaEm).getTime() > horas * 3600_000;
  }
  function lembreteDevido(clienteId: string) {
    const em = metasCliente.get(clienteId)?.lembrete_em;
    if (!em) return false;
    return new Date(em).getTime() <= agora;
  }
  function arquivada(clienteId: string) {
    return metasCliente.get(clienteId)?.arquivado ?? false;
  }

  // Clientes com App habilitado (mesmo sem conversa ainda) para iniciar chat.
  const termoBusca = busca.trim();
  const { data: clientesApp, isFetching: buscandoApp } = useQuery({
    queryKey: ["clientes-app", termoBusca],
    queryFn: () => buscarApp({ data: { q: termoBusca || undefined } }),
    enabled: termoBusca.length >= 2,
  });

  // Sincroniza a lista em tempo real quando qualquer mensagem chega/sai.
  useEffect(() => {
    const canal = supabase
      .channel("chat-conversas")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cliente_app_mensagens" },
        () => qc.invalidateQueries({ queryKey }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc]);

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    let lista = conversas ?? [];
    if (t) {
      lista = lista.filter(
        (c) =>
          c.nome.toLowerCase().includes(t) ||
          (c.documento ?? "").toLowerCase().includes(t),
      );
    }
    if (etiquetaFiltro !== "all") {
      lista = lista.filter((c) =>
        (etiquetasCliente.get(c.cliente_id) ?? []).some(
          (e) => e.id === etiquetaFiltro,
        ),
      );
    }
    // Arquivadas ficam ocultas exceto no filtro dedicado.
    if (filtro === "arquivadas") {
      lista = lista.filter((c) => arquivada(c.cliente_id));
    } else {
      lista = lista.filter((c) => !arquivada(c.cliente_id));
    }
    if (filtro === "nao_lidas") lista = lista.filter((c) => c.nao_lidas > 0);
    if (filtro === "sla")
      lista = lista.filter((c) =>
        slaEstourado(c.cliente_id, c.ultimo_remetente, c.ultima_em),
      );
    if (filtro === "lembrete")
      lista = lista.filter((c) => lembreteDevido(c.cliente_id));
    return lista;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversas, busca, etiquetaFiltro, filtro, etiquetasCliente, metasCliente]);

  const novosClientes = useMemo(() => {
    if (termoBusca.length < 2) return [];
    const jaEmConversa = new Set((conversas ?? []).map((c) => c.cliente_id));
    return (clientesApp ?? []).filter((c) => !jaEmConversa.has(c.cliente_id));
  }, [clientesApp, conversas, termoBusca]);

  const conversaAtual = (conversas ?? []).find(
    (c) =>
      c.cliente_id === selecionado &&
      (atendenteSel == null || c.atendente_id === atendenteSel),
  );
  const clienteAppAtual = (clientesApp ?? []).find(
    (c) => c.cliente_id === selecionado,
  );
  const alvoAtual = conversaAtual
    ? {
        cliente_id: conversaAtual.cliente_id,
        nome: conversaAtual.nome,
        documento: conversaAtual.documento,
        etapa_nome: conversaAtual.etapa_nome ?? null,
        atendente_id: conversaAtual.atendente_id,
        atendente_nome: conversaAtual.atendente_nome,
        minha: conversaAtual.minha,
      }
    : clienteAppAtual
      ? {
          cliente_id: clienteAppAtual.cliente_id,
          nome: clienteAppAtual.nome,
          documento: clienteAppAtual.documento,
          etapa_nome: clienteAppAtual.etapa_nome,
          atendente_id: null as string | null,
          atendente_nome: null as string | null,
          minha: true,
        }
      : null;

  useEffect(() => {
    // Auto-seleciona a primeira conversa apenas no desktop; no mobile o usuário
    // escolhe na lista (padrão master-detail) para a tela não pular direto ao chat.
    const ehDesktop =
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 1024px)").matches;
    if (ehDesktop && !selecionado && (conversas?.length ?? 0) > 0) {
      abrirConversa(conversas![0].cliente_id, conversas![0].atendente_id);
    }
  }, [conversas, selecionado]);


  const contadores = useMemo(() => {
    const lista = (conversas ?? []).filter((c) => !arquivada(c.cliente_id));
    return {
      nao_lidas: lista.filter((c) => c.nao_lidas > 0).length,
      sla: lista.filter((c) =>
        slaEstourado(c.cliente_id, c.ultimo_remetente, c.ultima_em),
      ).length,
      lembrete: lista.filter((c) => lembreteDevido(c.cliente_id)).length,
      arquivadas: (conversas ?? []).filter((c) => arquivada(c.cliente_id))
        .length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversas, metasCliente]);

  const chips: { id: FiltroChat; label: string; count?: number }[] = [
    { id: "todas", label: "Todas" },
    { id: "nao_lidas", label: "Não lidas", count: contadores.nao_lidas },
    { id: "sla", label: "SLA estourado", count: contadores.sla },
    { id: "lembrete", label: "Lembretes", count: contadores.lembrete },
    { id: "arquivadas", label: "Arquivadas", count: contadores.arquivadas },
  ];

  const somenteLeituraAtual = !!alvoAtual && !alvoAtual.minha && verTodos;
  const acoesGestao =
    alvoAtual && !somenteLeituraAtual ? (
      <MaisAcoesGestao
        key={alvoAtual.cliente_id}
        clienteId={alvoAtual.cliente_id}
        nome={alvoAtual.nome}
        documento={alvoAtual.documento}
        contexto={alvoAtual.etapa_nome ?? null}
        etiquetas={etiquetas ?? []}
      />
    ) : null;

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] w-full min-w-0 flex-col overflow-hidden p-2 sm:p-3 md:p-4">
      <div className="grid min-h-0 min-w-0 flex-1 grid-rows-[minmax(0,1fr)] gap-3 overflow-hidden md:gap-4 lg:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)_20rem]">



        {/* Lista de conversas — no mobile some quando uma conversa é aberta */}
        <Card
          className={cn(
            "h-full min-h-0 min-w-0 flex-col overflow-hidden border-border/60 shadow-sm lg:flex",
            selecionado ? "hidden" : "flex",
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b bg-card px-3 py-3">
            <h2 className="text-sm font-semibold text-foreground">Conversas</h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setVerTodos((v) => !v);
                  setSelecionado(null);
                  setAtendenteSel(null);
                }}
                title="Alterna entre as suas conversas e a visão de todos os atendentes (apenas gestores)."
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg border transition-colors",
                  verTodos
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted",
                )}
              >
                <Users className="h-4 w-4" />
              </button>
              <ChatConfigSheet />
            </div>
          </div>
          <div className="space-y-2 border-b bg-muted/30 p-3">

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome ou documento…"
                className="rounded-lg bg-background pl-8"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {chips.map((chip) => (
                <button
                  key={chip.id}
                  onClick={() => setFiltro(chip.id)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    filtro === chip.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-muted",
                  )}
                >
                  {chip.label}
                  {chip.count ? (
                    <span
                      className={cn(
                        "rounded-full px-1 text-[10px]",
                        filtro === chip.id
                          ? "bg-primary-foreground/20"
                          : "bg-muted-foreground/15",
                      )}
                    >
                      {chip.count}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
            {(etiquetas?.length ?? 0) > 0 && (
              <Select value={etiquetaFiltro} onValueChange={setEtiquetaFiltro}>
                <SelectTrigger className="h-8 rounded-lg bg-background text-xs">
                  <div className="flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue placeholder="Filtrar por etiqueta" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as etiquetas</SelectItem>
                  {(etiquetas ?? []).map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : filtradas.length === 0 && novosClientes.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                {termoBusca.length >= 2
                  ? buscandoApp
                    ? "Buscando clientes…"
                    : "Nenhum cliente encontrado. Habilite o App do cliente no CRM para poder conversar."
                  : filtro !== "todas" || etiquetaFiltro !== "all"
                    ? "Nenhuma conversa para este filtro."
                    : "Nenhuma conversa ainda. Busque um cliente com App habilitado para iniciar."}
              </p>
            ) : (
              <>
                {(() => {
                  let ultimoDia = "";
                  const nodes: React.ReactNode[] = [];
                  for (const c of filtradas) {
                    const dia = rotuloDia(c.ultima_em);
                    if (dia !== ultimoDia) {
                      ultimoDia = dia;
                      nodes.push(
                        <div
                          key={`hdr-${dia}`}
                          className="sticky top-0 z-[1] bg-card/95 px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur"
                        >
                          {dia}
                        </div>,
                      );
                    }
                    const tags = etiquetasCliente.get(c.cliente_id) ?? [];
                    const sla = slaEstourado(
                      c.cliente_id,
                      c.ultimo_remetente,
                      c.ultima_em,
                    );
                    const lembrete = lembreteDevido(c.cliente_id);
                    const ativo =
                      selecionado === c.cliente_id &&
                      (atendenteSel == null || atendenteSel === c.atendente_id);
                    nodes.push(
                      <button
                        key={`${c.cliente_id}::${c.atendente_id ?? ""}`}
                        onClick={() => abrirConversa(c.cliente_id, c.atendente_id)}
                        className={cn(
                          "mx-2 mb-0.5 flex w-[calc(100%-1rem)] items-start gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors",
                          ativo
                            ? "bg-primary/10 ring-1 ring-primary/20"
                            : "hover:bg-muted/60",
                        )}
                      >
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-primary/50 text-xs font-semibold text-primary-foreground">
                          {iniciais(c.nome)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className={cn(
                              "truncate text-sm",
                              ativo ? "font-semibold text-foreground" : "font-medium text-foreground",
                            )}>
                              {c.nome}
                            </span>
                            <span className="shrink-0 text-[10px] text-muted-foreground">
                              {new Date(c.ultima_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          {verTodos && !c.minha && c.atendente_nome && (
                            <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-medium text-primary/80">
                              <Users className="h-3 w-3" /> {c.atendente_nome}
                            </span>
                          )}
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs text-muted-foreground">
                              {c.ultimo_remetente === "time" ? "Você: " : ""}
                              {c.ultima_mensagem}
                            </span>
                            {c.nao_lidas > 0 && (
                              <Badge className="h-5 shrink-0 px-1.5 text-[10px]">
                                {c.nao_lidas}
                              </Badge>
                            )}
                          </div>
                          {(tags.length > 0 || sla || lembrete) && (
                            <div className="mt-1 flex flex-wrap items-center gap-1">
                              {sla && (
                                <span className="chat-tag chat-tag-red">
                                  <Timer className="h-3 w-3" /> SLA
                                </span>
                              )}
                              {lembrete && (
                                <span className="chat-tag chat-tag-amber">
                                  <BellRing className="h-3 w-3" /> Lembrete
                                </span>
                              )}
                              {tags.map((t) => (
                                <TagChip key={t.id} etiqueta={t} />
                              ))}
                            </div>
                          )}
                        </div>
                      </button>,
                    );
                  }
                  return nodes;
                })()}


                {novosClientes.length > 0 && (
                  <>
                    <p className="bg-muted/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Clientes com App habilitado
                    </p>
                    {novosClientes.map((c) => (
                      <button
                        key={c.cliente_id}
                        onClick={() => abrirConversa(c.cliente_id, null)}
                        className={cn(
                          "flex w-full items-start gap-3 border-b border-border/50 px-3 py-3 text-left transition-colors hover:bg-muted/50",
                          selecionado === c.cliente_id &&
                            "bg-primary/5 shadow-[inset_3px_0_0_0_hsl(var(--primary))]",
                        )}
                      >
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                          {iniciais(c.nome)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-medium text-foreground">
                              {c.nome}
                            </span>
                            <Badge
                              variant={c.logou ? "secondary" : "outline"}
                              className="h-5 shrink-0 px-1.5 text-[10px]"
                            >
                              {c.logou ? "Ativo" : "Não logou"}
                            </Badge>
                          </div>
                          <span className="block truncate text-xs text-muted-foreground">
                            {c.documento ?? "Iniciar conversa"}
                          </span>
                          {c.etapa_nome && (
                            <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                              {c.etapa_nome}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </Card>

        {/* Chat + follow-up — no mobile ocupa a tela inteira quando aberto */}
        <div
          className={cn(
            "min-h-0 min-w-0 flex-col overflow-hidden",
            selecionado ? "flex" : "hidden lg:flex",
          )}
        >
          <button
            type="button"
            onClick={() => setSelecionado(null)}
            className="mb-2 inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground lg:hidden"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar às conversas
          </button>
          {alvoAtual ? (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
              {(() => {
                // Só é leitura quando um gestor abre a thread de outro atendente
                // (modo "Todos os atendentes"). Participantes convidados — que
                // aparecem na lista mesmo fora do modo gestor — podem responder.
                const somenteLeitura = !alvoAtual.minha && verTodos;
                const podeGerir = !somenteLeitura && !!alvoAtual.atendente_id;
                return (
                  <>
                    {podeGerir && (
                      <div className="flex shrink-0 justify-end">
                        <ChatParticipantes
                          clienteId={alvoAtual.cliente_id}
                          atendenteId={alvoAtual.atendente_id!}
                        />
                      </div>
                    )}
                      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
                      <ChatClienteTab
                        key={`${alvoAtual.cliente_id}::${alvoAtual.atendente_id ?? ""}`}
                        clienteId={alvoAtual.cliente_id}
                        atendenteId={alvoAtual.atendente_id ?? undefined}
                        somenteLeitura={somenteLeitura}
                        atendenteNome={alvoAtual.atendente_nome ?? undefined}
                        acoes={acoesGestao}
                        info={{
                          nome: alvoAtual.nome,
                          documento: alvoAtual.documento,
                          contexto: alvoAtual.etapa_nome ?? undefined,
                        }}

                      />
                    </div>
                  </>
                );
              })()}
            </div>
          ) : (

            <Card className="flex h-full min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-3 border-dashed border-border/60 text-center shadow-sm">
              <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MessagesSquare className="h-6 w-6" />
              </div>
              <p className="max-w-[16rem] text-sm text-muted-foreground">
                Selecione uma conversa ao lado ou busque um cliente para começar.
              </p>
            </Card>
          )}
        </div>

        {/* Painel do cliente — 3ª coluna (somente desktop largo) */}
        {alvoAtual && (
          <div className="hidden min-h-0 xl:block">
            <PainelChatCliente
              key={alvoAtual.cliente_id}
              clienteId={alvoAtual.cliente_id}
              etiquetas={etiquetasCliente.get(alvoAtual.cliente_id) ?? []}
            />
          </div>
        )}

      </div>


    </div>
  );
}

function MaisAcoesGestao(props: {
  clienteId: string;
  nome: string;
  documento?: string | null;
  contexto?: string | null;
  etiquetas: ChatEtiqueta[];
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
            className="h-9 w-9 shrink-0 gap-1.5 rounded-lg px-0 sm:w-auto sm:px-3"
        >
          <span className="hidden sm:inline">Mais ações</span>
          <ChevronDown className="size-4 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[22rem] max-w-[calc(100vw-2rem)] p-0"
      >
        <BarraGestao {...props} />
      </PopoverContent>
    </Popover>
  );
}



function BarraGestao({
  clienteId,
  nome,
  documento,
  contexto,
  etiquetas,
}: {
  clienteId: string;
  nome: string;
  documento?: string | null;
  contexto?: string | null;
  etiquetas: ChatEtiqueta[];
}) {
  const qc = useQueryClient();
  const getStages = useServerFn(getPipelineStages);
  const getAtual = useServerFn(getClientePipeline);
  const mover = useServerFn(moverEtapa);
  const getMeta = useServerFn(getChatMeta);
  const salvarMeta = useServerFn(salvarChatMeta);
  const arquivar = useServerFn(definirArquivamentoConversa);
  const definirTags = useServerFn(definirEtiquetasCliente);
  const criarTag = useServerFn(criarEtiquetaChat);
  const excluirTag = useServerFn(excluirEtiquetaChat);

  const [destino, setDestino] = useState<string>("");
  const [novaTag, setNovaTag] = useState("");
  const [novaCor, setNovaCor] = useState<string>("blue");
  const [slaHoras, setSlaHoras] = useState<string>("24");
  const [lembreteEm, setLembreteEm] = useState<string>("");
  const [lembreteNota, setLembreteNota] = useState<string>("");

  const { data: stages } = useQuery({
    queryKey: ["pipeline-stages"],
    queryFn: () => getStages(),
  });
  const { data: atual } = useQuery({
    queryKey: ["cliente-pipeline", clienteId],
    queryFn: () => getAtual({ data: { cliente_id: clienteId } }),
  });
  const { data: meta } = useQuery({
    queryKey: ["chat-meta", clienteId],
    queryFn: () => getMeta({ data: { cliente_id: clienteId } }),
  });
  const { data: overview } = useQuery({
    queryKey: ["chat-overview-cliente", clienteId],
    queryFn: () => overviewGestaoChat({ data: { cliente_ids: [clienteId] } }),
  });

  useEffect(() => {
    if (meta) {
      setSlaHoras(String(meta.sla_atualizacao_horas));
      setLembreteEm(
        meta.lembrete_em
          ? new Date(meta.lembrete_em).toISOString().slice(0, 16)
          : "",
      );
      setLembreteNota(meta.lembrete_nota ?? "");
    }
  }, [meta]);

  const tagsAplicadas = useMemo(
    () => new Set((overview?.links ?? []).map((l) => l.etiqueta_id)),
    [overview],
  );

  const avancar = useMutation({
    mutationFn: (codigo: string) =>
      mover({ data: { cliente_id: clienteId, codigo_destino: codigo } }),
    onSuccess: () => {
      toast.success("Etapa atualizada e sincronizada com o App do cliente.");
      setDestino("");
      qc.invalidateQueries({ queryKey: ["cliente-pipeline", clienteId] });
      qc.invalidateQueries({ queryKey: ["conversas-cliente"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível mover a etapa."),
  });

  const toggleTag = useMutation({
    mutationFn: (etiquetaId: string) => {
      const novo = new Set(tagsAplicadas);
      if (novo.has(etiquetaId)) novo.delete(etiquetaId);
      else novo.add(etiquetaId);
      return definirTags({
        data: { cliente_id: clienteId, etiqueta_ids: Array.from(novo) },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-overview-cliente", clienteId] });
      qc.invalidateQueries({ queryKey: ["chat-overview"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível atualizar as etiquetas."),
  });

  const adicionarTag = useMutation({
    mutationFn: () => criarTag({ data: { nome: novaTag.trim(), cor: novaCor } }),
    onSuccess: () => {
      setNovaTag("");
      toast.success("Etiqueta criada.");
      qc.invalidateQueries({ queryKey: ["chat-etiquetas"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível criar a etiqueta."),
  });

  const removerTag = useMutation({
    mutationFn: (id: string) => excluirTag({ data: { id } }),
    onSuccess: () => {
      toast.success("Etiqueta excluída.");
      qc.invalidateQueries({ queryKey: ["chat-etiquetas"] });
      qc.invalidateQueries({ queryKey: ["chat-overview-cliente", clienteId] });
      qc.invalidateQueries({ queryKey: ["chat-overview"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível excluir a etiqueta."),
  });

  const gravarMeta = useMutation({
    mutationFn: () =>
      salvarMeta({
        data: {
          cliente_id: clienteId,
          sla_atualizacao_horas: Math.max(1, Number(slaHoras) || 24),
          lembrete_em: lembreteEm ? new Date(lembreteEm).toISOString() : null,
          lembrete_nota: lembreteNota.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("SLA e lembrete salvos.");
      qc.invalidateQueries({ queryKey: ["chat-meta", clienteId] });
      qc.invalidateQueries({ queryKey: ["chat-overview"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar."),
  });

  const estaArquivada = meta?.arquivado ?? false;
  const alternarArquivo = useMutation({
    mutationFn: () =>
      arquivar({ data: { cliente_id: clienteId, arquivado: !estaArquivada } }),
    onSuccess: () => {
      toast.success(
        estaArquivada ? "Conversa desarquivada." : "Conversa arquivada.",
      );
      qc.invalidateQueries({ queryKey: ["chat-meta", clienteId] });
      qc.invalidateQueries({ queryKey: ["chat-overview"] });
      qc.invalidateQueries({ queryKey: ["chat-overview-cliente", clienteId] });
    },
    onError: (e) =>
      toast.error(
        e instanceof Error ? e.message : "Não foi possível arquivar.",
      ),
  });

  const aplicadas = etiquetas.filter((e) => tagsAplicadas.has(e.id));

  const etapaAtual =
    stages?.find((s) => s.codigo === atual?.codigo)?.nome ?? "Cadastro básico";
  const temLembrete = Boolean(lembreteEm);
  const contextoLinha = [documento, contexto].filter(Boolean).join(" · ");

  return (
    <Card className="overflow-hidden border-border/60 border-l-2 border-l-primary/40 shadow-sm">
      <div className="flex flex-col gap-3 p-3 xl:flex-row xl:flex-wrap xl:items-stretch xl:gap-0">
        {/* Identidade */}
        <div className="flex min-w-0 items-center gap-3 xl:flex-1 xl:pr-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/80 to-primary/50 text-sm font-semibold text-primary-foreground shadow-sm">
            {iniciais(nome)}
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-primary/80">
              Gestão da conversa
            </p>
            <p className="truncate text-sm font-semibold leading-tight text-foreground">
              {nome}
            </p>
            {contextoLinha && (
              <p className="truncate text-xs text-muted-foreground">
                {contextoLinha}
              </p>
            )}
          </div>
          <Button
            variant={estaArquivada ? "default" : "outline"}
            size="sm"
            className="ml-auto h-8 shrink-0 gap-1.5 text-xs"
            disabled={alternarArquivo.isPending}
            onClick={() => alternarArquivo.mutate()}
            title="O histórico é excluído automaticamente 2 meses após a emissão do contrato."
          >
            {alternarArquivo.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : estaArquivada ? (
              <ArchiveRestore className="h-3.5 w-3.5" />
            ) : (
              <Archive className="h-3.5 w-3.5" />
            )}
            {estaArquivada ? "Desarquivar" : "Arquivar"}
          </Button>
        </div>

        {/* Etiquetas */}
        <div className="flex min-w-0 flex-col justify-center gap-1.5 border-t border-primary/15 pt-3 xl:border-l xl:border-l-primary/15 xl:border-t-0 xl:px-4 xl:pt-0">
          <div className="flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-medium text-muted-foreground">
              Etiquetas
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {aplicadas.length === 0 ? (
              <span className="text-[11px] text-muted-foreground">Nenhuma</span>
            ) : (
              aplicadas.map((e) => (
                <TagChip
                  key={e.id}
                  etiqueta={e}
                  onRemove={() => toggleTag.mutate(e.id)}
                />
              ))
            )}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 rounded-full px-2.5 text-[11px]"
                >
                  <Plus className="h-3.5 w-3.5" /> Gerenciar
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 space-y-3 p-3">
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {etiquetas.length === 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      Crie a primeira etiqueta abaixo.
                    </p>
                  )}
                  {etiquetas.map((e) => {
                    const on = tagsAplicadas.has(e.id);
                    return (
                      <div key={e.id} className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={toggleTag.isPending}
                          onClick={() => toggleTag.mutate(e.id)}
                          className={cn(
                            "flex flex-1 items-center gap-2 rounded-md border px-2 py-1 text-left text-xs transition-colors",
                            on
                              ? "border-primary bg-primary/5"
                              : "border-border hover:bg-muted",
                          )}
                        >
                          <span className={cn("chat-tag-dot", `chat-dot-${e.cor}`)} />
                          <span className="flex-1 truncate">{e.nome}</span>
                          {on && <Check className="h-3.5 w-3.5 text-primary" />}
                        </button>
                        <button
                          type="button"
                          disabled={removerTag.isPending}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Excluir a etiqueta "${e.nome}"? Ela será removida de todos os clientes.`,
                              )
                            ) {
                              removerTag.mutate(e.id);
                            }
                          }}
                          className="rounded-md p-1 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                          aria-label={`Excluir ${e.nome}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="space-y-2 border-t pt-2">
                  <Input
                    value={novaTag}
                    onChange={(ev) => setNovaTag(ev.target.value)}
                    placeholder="Nova etiqueta…"
                    className="h-8 text-xs"
                  />
                  <div className="flex items-center gap-1">
                    {CORES.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setNovaCor(c.id)}
                        aria-label={c.nome}
                        className={cn(
                          "chat-tag-dot h-5 w-5 rounded-full ring-offset-1 transition",
                          `chat-dot-${c.id}`,
                          novaCor === c.id &&
                            "ring-2 ring-primary ring-offset-background",
                        )}
                      />
                    ))}
                  </div>
                  <Button
                    size="sm"
                    className="h-8 w-full text-xs"
                    disabled={!novaTag.trim() || adicionarTag.isPending}
                    onClick={() => adicionarTag.mutate()}
                  >
                    {adicionarTag.isPending ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Criar etiqueta
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* SLA e lembrete */}
        <div className="flex flex-col justify-center gap-1.5 border-t border-primary/15 pt-3 xl:border-l xl:border-l-primary/15 xl:border-t-0 xl:px-4 xl:pt-0">
          <div className="flex items-center gap-1.5">
            <AlarmClock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-medium text-muted-foreground">
              SLA e lembrete
            </span>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 justify-between gap-2 text-xs"
              >
                <span className="flex items-center gap-1.5">
                  <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                  {slaHoras}h
                  {temLembrete && (
                    <span className="chat-tag chat-tag-amber">
                      <BellRing className="h-3 w-3" /> lembrete
                    </span>
                  )}
                </span>
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 space-y-2.5 p-3">
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">
                  SLA de atualização (horas sem resposta)
                </label>
                <Input
                  type="number"
                  min={1}
                  value={slaHoras}
                  onChange={(e) => setSlaHoras(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">
                  Lembrete de follow-up
                </label>
                <Input
                  type="datetime-local"
                  value={lembreteEm}
                  onChange={(e) => setLembreteEm(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <Textarea
                value={lembreteNota}
                onChange={(e) => setLembreteNota(e.target.value)}
                placeholder="Nota do lembrete (opcional)…"
                className="min-h-[3rem] text-xs"
              />
              <Button
                size="sm"
                className="h-8 w-full text-xs"
                disabled={gravarMeta.isPending}
                onClick={() => gravarMeta.mutate()}
              >
                {gravarMeta.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <BellRing className="mr-1.5 h-3.5 w-3.5" />
                )}
                Salvar SLA e lembrete
              </Button>
            </PopoverContent>
          </Popover>
        </div>

        {/* Esteira */}
        <div className="flex flex-col justify-center gap-1.5 border-t border-primary/15 pt-3 xl:border-l xl:border-l-primary/15 xl:border-t-0 xl:pl-4 xl:pt-0">
          <div className="flex items-center gap-1.5">
            <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-medium text-muted-foreground">
              Esteira · {etapaAtual}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Select value={destino} onValueChange={setDestino}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue placeholder="Mover para…" />
              </SelectTrigger>
              <SelectContent>
                {(stages ?? []).map((s) => (
                  <SelectItem key={s.codigo} value={s.codigo}>
                    {s.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="h-8 gap-1 text-xs"
              disabled={!destino || avancar.isPending || destino === atual?.codigo}
              onClick={() => avancar.mutate(destino)}
            >
              {avancar.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowRight className="h-3.5 w-3.5" />
              )}
              Mover
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
