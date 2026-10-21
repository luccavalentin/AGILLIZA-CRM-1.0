import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createDebouncedInvalidator } from "@/lib/realtime-debounce";
import { supabase } from "@/integrations/supabase/client";
import { listarConversasCliente, buscarClientesApp } from "@/lib/crm/chat-cliente.functions";
import {
  listarEtiquetasChat,
  overviewGestaoChat,
  type ChatEtiqueta,
} from "@/lib/crm/chat-gestao.functions";
import { listarEstadoChatDoUsuario } from "@/lib/chats/gestao.functions";
import { usePermissao } from "@/hooks/use-permissao";
import type { FiltroChat } from "./helpers";

/** Quantas conversas a lista traz por vez ("Carregar mais" soma outro tanto). */
const PAGINA_CONVERSAS = 300;

/**
 * Estado + queries + derivações do Chat CRM.
 *
 * Extraído da rota `crm.chat.tsx` para reduzir a página a um shell
 * enxuto e permitir reuso/testes das derivações (etiquetas por cliente,
 * SLA, lembrete, filtros). Mantém a mesma semântica anterior — nenhuma
 * regra de negócio foi alterada.
 */
export function useChatConversas() {
  const qc = useQueryClient();
  const listar = useServerFn(listarConversasCliente);
  const buscarApp = useServerFn(buscarClientesApp);
  const getOverview = useServerFn(overviewGestaoChat);
  const listarEtiq = useServerFn(listarEtiquetasChat);
  const listarEstado = useServerFn(listarEstadoChatDoUsuario);

  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroChat>("todas");
  const [etiquetaFiltro, setEtiquetaFiltro] = useState<string>("all");
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [atendenteSel, setAtendenteSel] = useState<string | null>(null);
  // Visão supervisora: quando ligada, quem gere o chat vê também as conversas dos
  // demais atendentes (o back-end ignora para quem não pode).
  const podeGerir = usePermissao("crm.chat", "gerir");
  const [verTodosPedido, setVerTodos] = useState(false);
  const verTodos = verTodosPedido && podeGerir;
  const [limite, setLimite] = useState(PAGINA_CONVERSAS);
  // Tick minutal: SLA e lembrete são baseados em `Date.now()`. Sem este
  // gatilho, badges "SLA estourado"/"lembrete devido" só se atualizariam
  // quando outro estado mudasse, deixando o usuário parado com dados velhos.
  const [tickMinuto, setTickMinuto] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTickMinuto((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Idempotente: só dispara render quando algo realmente muda. Sem isso,
  // efeitos de auto-seleção podem entrar em laço de atualização infinito.
  const abrirConversa = useMemo(
    () => (clienteId: string, atendenteId: string | null) => {
      setSelecionado((atual) => (atual === clienteId ? atual : clienteId));
      setAtendenteSel((atual) => (atual === atendenteId ? atual : atendenteId));
    },
    [],
  );

  const queryKey = ["conversas-cliente", verTodos, limite] as const;
  const {
    data: listaConversas,
    isLoading,
    isError,
    error: erroConversas,
    refetch: recarregarConversas,
    isFetching: buscandoConversas,
  } = useQuery({
    queryKey,
    queryFn: () => listar({ data: { ver_todos: verTodos, limite } }),
    placeholderData: keepPreviousData,
  });
  const conversas = listaConversas?.conversas;
  const temMaisConversas = listaConversas?.tem_mais ?? false;
  const carregarMaisConversas = () => setLimite((n) => Math.min(n + PAGINA_CONVERSAS, 2000));

  const { data: etiquetas } = useQuery({
    queryKey: ["chat-etiquetas"],
    queryFn: () => listarEtiq(),
  });

  const { data: estadosUsuario } = useQuery({
    queryKey: ["chat-estado-usuario"],
    queryFn: () => listarEstado(),
  });

  const estadoPorCliente = useMemo(() => {
    const m = new Map<
      string,
      { fixado: boolean; apelido: string | null; ocultoEm: string | null; arquivado: boolean }
    >();
    for (const e of estadosUsuario ?? []) {
      if (e.chat_tipo !== "cliente") continue;
      m.set(e.chat_id, {
        fixado: !!e.pinado_em,
        apelido: e.apelido ?? null,
        ocultoEm: e.oculto_em ?? null,
        arquivado: !!e.arquivado_em,
      });
    }
    return m;
  }, [estadosUsuario]);

  function fixadoCliente(clienteId: string) {
    return estadoPorCliente.get(clienteId)?.fixado ?? false;
  }
  function apelidoCliente(clienteId: string) {
    return estadoPorCliente.get(clienteId)?.apelido ?? null;
  }
  /**
   * Conversa "excluída" some da lista do usuário. Volta a aparecer apenas se
   * chegar mensagem nova depois da exclusão.
   */
  function ocultaCliente(clienteId: string, ultimaEm?: string | null) {
    const oc = estadoPorCliente.get(clienteId)?.ocultoEm;
    if (!oc) return false;
    if (!ultimaEm) return true;
    return new Date(ultimaEm).getTime() <= new Date(oc).getTime();
  }

  const idsConversa = useMemo(() => (conversas ?? []).map((c) => c.cliente_id), [conversas]);

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
  /** Arquivada no CRM ou pelo próprio usuário na Central/ficha (a mesma função grava os dois). */
  function arquivada(clienteId: string) {
    return (
      (metasCliente.get(clienteId)?.arquivado ?? false) ||
      (estadoPorCliente.get(clienteId)?.arquivado ?? false)
    );
  }

  // Clientes com App habilitado (mesmo sem conversa ainda) para iniciar chat.
  const termoBusca = busca.trim();
  const { data: clientesApp, isFetching: buscandoApp } = useQuery({
    queryKey: ["clientes-app", termoBusca],
    queryFn: () => buscarApp({ data: { q: termoBusca || undefined } }),
    enabled: termoBusca.length >= 2,
  });

  // Donos das conversas em que o usuário é convidado: o canal também escuta essas threads.
  const donosConvidado = useMemo(
    () =>
      Array.from(
        new Set(
          (conversas ?? [])
            .filter((c) => c.participo && !c.minha && c.atendente_id)
            .map((c) => c.atendente_id as string),
        ),
      )
        .sort()
        .slice(0, 100)
        .join(","),
    [conversas],
  );

  // Sincroniza a lista em tempo real quando qualquer mensagem chega/sai.
  // Rajadas (insert + update de read_at) são coalescidas em uma única
  // invalidação por burst.
  useEffect(() => {
    const { schedule, cancel } = createDebouncedInvalidator(() =>
      qc.invalidateQueries({ queryKey: ["conversas-cliente"] }),
    );
    let canal: ReturnType<typeof supabase.channel> | null = null;
    let cancelado = false;
    (async () => {
      // Escopo do canal por usuário: sem verTodos filtra pelas threads que ele atende
      // (as próprias e as em que foi convidado) para evitar refetch em toda mensagem.
      const { data: userData } = await supabase.auth.getUser();
      if (cancelado) return;
      const uid = userData.user?.id;
      const nome = `chat-conversas:${uid ?? "anon"}:${verTodos ? "all" : "own"}:${crypto.randomUUID()}`;
      let c = supabase.channel(nome);
      if (verTodos || !uid) {
        c = c.on(
          "postgres_changes",
          { event: "*", schema: "public", table: "cliente_app_mensagens" },
          schedule,
        );
      } else {
        c = c
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "cliente_app_mensagens",
              filter: `atendente_id=eq.${uid}`,
            },
            schedule,
          )
          // Convite novo ou removido muda a lista.
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "crm_chat_participantes",
              filter: `usuario_id=eq.${uid}`,
            },
            schedule,
          );
        if (donosConvidado) {
          c = c.on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "cliente_app_mensagens",
              filter: `atendente_id=in.(${donosConvidado})`,
            },
            schedule,
          );
        }
      }
      canal = c.subscribe();
    })();
    return () => {
      cancelado = true;
      cancel();
      if (canal) supabase.removeChannel(canal);
    };
  }, [qc, verTodos, donosConvidado]);

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    let lista = (conversas ?? []).filter((c) => !ocultaCliente(c.cliente_id, c.ultima_em));
    if (t) {
      lista = lista.filter(
        (c) =>
          c.nome.toLowerCase().includes(t) ||
          (apelidoCliente(c.cliente_id) ?? "").toLowerCase().includes(t) ||
          (c.documento ?? "").toLowerCase().includes(t),
      );
    }
    if (etiquetaFiltro !== "all") {
      lista = lista.filter((c) =>
        (etiquetasCliente.get(c.cliente_id) ?? []).some((e) => e.id === etiquetaFiltro),
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
      lista = lista.filter((c) => slaEstourado(c.cliente_id, c.ultimo_remetente, c.ultima_em));
    if (filtro === "lembrete") lista = lista.filter((c) => lembreteDevido(c.cliente_id));
    // Fixadas primeiro (mantém a ordem original dentro de cada grupo).
    lista = [...lista].sort((a, b) => {
      const fa = fixadoCliente(a.cliente_id) ? 1 : 0;
      const fb = fixadoCliente(b.cliente_id) ? 1 : 0;
      return fb - fa;
    });
    return lista;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    conversas,
    busca,
    etiquetaFiltro,
    filtro,
    etiquetasCliente,
    metasCliente,
    estadoPorCliente,
    tickMinuto,
  ]);

  // Se a conversa aberta foi excluída (oculta), fecha o painel.
  useEffect(() => {
    if (!selecionado) return;
    const conv = (conversas ?? []).find((c) => c.cliente_id === selecionado);
    if (ocultaCliente(selecionado, conv?.ultima_em ?? null)) {
      setSelecionado(null);
      setAtendenteSel(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionado, estadoPorCliente, conversas]);

  const novosClientes = useMemo(() => {
    if (termoBusca.length < 2) return [];
    const jaEmConversa = new Set((conversas ?? []).map((c) => c.cliente_id));
    return (clientesApp ?? []).filter((c) => !jaEmConversa.has(c.cliente_id));
  }, [clientesApp, conversas, termoBusca]);

  const conversaAtual = (conversas ?? []).find(
    (c) =>
      c.cliente_id === selecionado && (atendenteSel == null || c.atendente_id === atendenteSel),
  );
  const clienteAppAtual = (clientesApp ?? []).find((c) => c.cliente_id === selecionado);
  const alvoAtual = conversaAtual
    ? {
        cliente_id: conversaAtual.cliente_id,
        nome: conversaAtual.nome,
        documento: conversaAtual.documento,
        etapa_nome: conversaAtual.etapa_nome ?? null,
        atendente_id: conversaAtual.atendente_id,
        atendente_nome: conversaAtual.atendente_nome,
        minha: conversaAtual.minha,
        participo: conversaAtual.participo,
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
          participo: true,
        }
      : null;

  const contadores = useMemo(() => {
    const visiveis = (conversas ?? []).filter((c) => !ocultaCliente(c.cliente_id, c.ultima_em));
    const lista = visiveis.filter((c) => !arquivada(c.cliente_id));
    return {
      nao_lidas: lista.filter((c) => c.nao_lidas > 0).length,
      sla: lista.filter((c) => slaEstourado(c.cliente_id, c.ultimo_remetente, c.ultima_em)).length,
      lembrete: lista.filter((c) => lembreteDevido(c.cliente_id)).length,
      arquivadas: visiveis.filter((c) => arquivada(c.cliente_id)).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversas, metasCliente, estadoPorCliente, tickMinuto]);

  return {
    // estado
    busca,
    setBusca,
    filtro,
    setFiltro,
    etiquetaFiltro,
    setEtiquetaFiltro,
    selecionado,
    setSelecionado,
    atendenteSel,
    setAtendenteSel,
    verTodos,
    setVerTodos,
    podeGerir,
    abrirConversa,
    // dados
    conversas,
    isLoading,
    erroConversas: isError ? (erroConversas as unknown) : null,
    recarregarConversas,
    buscandoConversas,
    temMaisConversas,
    carregarMaisConversas,
    etiquetas,
    etiquetasCliente,
    filtradas,
    novosClientes,
    buscandoApp,
    termoBusca,
    alvoAtual,
    contadores,
    // helpers
    slaEstourado,
    lembreteDevido,
    arquivada,
    fixado: fixadoCliente,
    apelido: apelidoCliente,
  };
}

export type UseChatConversas = ReturnType<typeof useChatConversas>;
