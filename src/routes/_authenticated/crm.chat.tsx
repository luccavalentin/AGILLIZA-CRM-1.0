import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  MessagesSquare,
  Search,
  ArrowLeft,
  Tag,
  BellRing,
  Timer,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  listarEtiquetasChat,
  overviewGestaoChat,
  type ChatEtiqueta,
} from "@/lib/crm/chat-gestao.functions";
import { ChatConfigSheet } from "@/components/shared/chat-config-sheet";
import { PainelChatCliente } from "@/components/crm/chat-cliente/painel-cliente";
import { MaisAcoesGestao } from "@/components/crm/chat/barra-gestao";
import { TagChip } from "@/components/crm/chat/tag-chip";
import { iniciais, rotuloDia, type FiltroChat } from "@/components/crm/chat/helpers";

export const Route = createFileRoute("/_authenticated/crm/chat")({
  head: () => ({ meta: [{ title: "Chat e Follow-up Cliente — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("crm.clientes"),
  validateSearch: (s: Record<string, unknown>) => ({
    c: typeof s.c === "string" ? s.c : undefined,
  }),
  component: Pagina,
});




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

  const search = Route.useSearch();
  useEffect(() => {
    if (search.c) {
      const alvo = (conversas ?? []).find((c) => c.cliente_id === search.c);
      abrirConversa(search.c, alvo?.atendente_id ?? null);
      return;
    }
    // Auto-seleciona a primeira conversa apenas no desktop; no mobile o usuário
    // escolhe na lista (padrão master-detail) para a tela não pular direto ao chat.
    const ehDesktop =
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 1024px)").matches;
    if (ehDesktop && !selecionado && (conversas?.length ?? 0) > 0) {
      abrirConversa(conversas![0].cliente_id, conversas![0].atendente_id);
    }
  }, [conversas, selecionado, search.c]);



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
                              {new Date(c.ultima_em).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo",   hour: "2-digit", minute: "2-digit" })}
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

