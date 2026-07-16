import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  listarConversasCliente,
  buscarClientesApp,
} from "@/lib/crm/chat-cliente.functions";
import {
  listarEtiquetasChat,
  overviewGestaoChat,
  type ChatEtiqueta,
} from "@/lib/crm/chat-gestao.functions";
import type { FiltroChat } from "./helpers";

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

  const queryKey = ["conversas-cliente", verTodos] as const;
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
    abrirConversa,
    // dados
    conversas,
    isLoading,
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
  };
}

export type UseChatConversas = ReturnType<typeof useChatConversas>;
