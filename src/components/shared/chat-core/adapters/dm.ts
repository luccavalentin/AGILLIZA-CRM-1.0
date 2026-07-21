import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  enviarMensagemDm,
  listarMensagensDm,
  marcarDmLida,
  editarMensagemDm,
  excluirMensagemDm,
} from "@/lib/chats/central.functions";
import { reagirMensagem } from "@/lib/chat-core/reacoes.functions";
import { getMinhaSessao } from "@/lib/session.functions";

import type {
  ChatAdapter,
  ChatClienteInfo,
  ChatMensagem,
  ContextoResposta,
} from "../types";

/**
 * Adaptador do chat de DMs 1:1 (tabelas `dm_conversas` / `dm_mensagens`).
 *
 * Capabilities reduzidas: sem responder/editar/excluir/nota/tarefa/retorno
 * (a tabela dm_mensagens não guarda esses campos). Envio otimista, realtime,
 * "digitando" e recibos de leitura são herdados do núcleo.
 *
 * Preserva o trigger trg_dm_after_insert_mensagem: nenhuma escrita direta é
 * feita aqui — o envio passa por enviarMensagemDm (INSERT em dm_mensagens),
 * que dispara o trigger normalmente.
 */
export function useAdaptadorDm({
  conversaId,
  info,
  renderHeader,
}: {
  conversaId: string;
  info?: ChatClienteInfo;
  renderHeader?: ChatAdapter["renderHeader"];
}): ChatAdapter {
  const qc = useQueryClient();
  const listarFn = useServerFn(listarMensagensDm);
  const enviarFn = useServerFn(enviarMensagemDm);
  const marcarFn = useServerFn(marcarDmLida);
  const editarFn = useServerFn(editarMensagemDm);
  const excluirFn = useServerFn(excluirMensagemDm);
  const reagirFn = useServerFn(reagirMensagem);
  const sessaoFn = useServerFn(getMinhaSessao);


  const { data: sessao } = useQuery({
    queryKey: ["minha-sessao"],
    queryFn: () => sessaoFn(),
    staleTime: 5 * 60_000,
  });
  const meuId = sessao?.profile?.id ?? null;
  const meuNome = sessao?.profile?.nome?.trim() || null;

  const queryKey = useMemo(() => ["dm", conversaId] as const, [conversaId]);

  const contextoResposta: ContextoResposta = useMemo(
    () => ({
      primeiro_nome: info?.nome?.trim().split(/\s+/)[0] ?? null,
      numero_proposta: null,
      nome_banco: null,
      etapa: null,
    }),
    [info?.nome],
  );

  return useMemo<ChatAdapter>(
    () => ({
      conversaId,
      queryKey,
      meuNome,
      info,
      contextoResposta,
      somenteLeitura: false,
      mineTipo: "time",
      peerNomeCitacao: info?.nome?.trim() || "Colega",

      capabilities: {
        responder: false,
        editar: false,
        excluir: false,
        notaInterna: false,
        tarefa: false,
        retorno: false,
        anexo: false,
        respostasRapidas: false,
        audio: false,
      },

      renderHeader,

      listar: async () => {
        const raw = await listarFn({ data: { conversa_id: conversaId } });
        return (raw ?? []).map<ChatMensagem>((m) => ({
          id: m.id,
          remetente_tipo: m.autor_id === meuId ? "time" : "peer",
          remetente_id: m.autor_id,
          remetente_nome: m.autor_nome,
          mensagem: m.texto ?? "",
          anexo_url: m.anexo_url,
          anexo_nome: m.anexo_nome,
          anexo_is_imagem: false,
          lida_em: null,
          criada_em: m.created_at,
          editada_em: null,
          excluida_em: null,
          responde_a: null,
          interna: false,
          citacao: null,
          reacoes: [],
        }));

      },
      responder: async (p) => {
        await enviarFn({
          data: { conversa_id: conversaId, texto: p.mensagem ?? "" },
        });
        // Invalida a lista de threads para atualizar a prévia/contagem.
        qc.invalidateQueries({ queryKey: ["threads-central"] });
      },
      editar: async () => {
        throw new Error("Edição indisponível em mensagens diretas.");
      },
      excluir: async () => {
        throw new Error("Exclusão indisponível em mensagens diretas.");
      },
      marcarLido: async () => {
        await marcarFn({ data: { conversa_id: conversaId } });
        qc.invalidateQueries({ queryKey: ["threads-central"] });
      },

      realtime: {
        channel: `dm:${conversaId}`,
        bindings: [
          { table: "dm_mensagens", filter: `conversa_id=eq.${conversaId}` },
          { table: "dm_conversas", filter: `id=eq.${conversaId}` },
        ],
      },

      // Um papel único por usuário permite múltiplos "digitando" simultâneos.
      typing: { id: conversaId, myRole: meuId ?? "eu" },

      uploadAnexo: async () => {
        throw new Error("Anexo indisponível em mensagens diretas.");
      },
    }),
    [
      conversaId,
      queryKey,
      meuId,
      meuNome,
      info,
      contextoResposta,
      renderHeader,
      listarFn,
      enviarFn,
      marcarFn,
      qc,
    ],
  );
}
