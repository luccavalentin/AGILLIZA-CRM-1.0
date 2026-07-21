import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  listarChatCliente,
  responderChatCliente,
  editarChatCliente,
  excluirChatCliente,
  marcarChatClienteLido,
  obterContextoChatCliente,
} from "@/lib/crm/chat-cliente.functions";
import { criarTarefa } from "@/lib/operacional/tarefas.functions";
import { getMinhaSessao } from "@/lib/session.functions";
import { reagirMensagem } from "@/lib/chat-core/reacoes.functions";

import type { ChatAdapter, ChatClienteInfo, ContextoResposta } from "../types";

/**
 * Adaptador do chat Cliente ↔ correspondente/parceiro
 * (tabela `cliente_app_mensagens`).
 *
 * Este é o adaptador de referência do núcleo — a lógica de dados aqui é
 * exatamente a mesma que estava embutida no antigo `ChatClienteConversa`.
 */
export function useAdaptadorCliente({
  clienteId,
  atendenteId,
  info,
  somenteLeitura = false,
  atendenteNome,
  acoes,
}: {
  clienteId: string;
  atendenteId?: string;
  info?: ChatClienteInfo;
  somenteLeitura?: boolean;
  atendenteNome?: string;
  acoes?: React.ReactNode;
}): ChatAdapter {
  const listar = useServerFn(listarChatCliente);
  const responder = useServerFn(responderChatCliente);
  const editar = useServerFn(editarChatCliente);
  const excluir = useServerFn(excluirChatCliente);
  const marcarLido = useServerFn(marcarChatClienteLido);
  const contextoFn = useServerFn(obterContextoChatCliente);
  const sessaoFn = useServerFn(getMinhaSessao);
  const criarTarefaFn = useServerFn(criarTarefa);
  const reagirFn = useServerFn(reagirMensagem);


  const { data: sessao } = useQuery({
    queryKey: ["minha-sessao"],
    queryFn: () => sessaoFn(),
    staleTime: 5 * 60_000,
  });
  const { data: ctxCliente } = useQuery({
    queryKey: ["chat-contexto-cliente", clienteId],
    queryFn: () => contextoFn({ data: { cliente_id: clienteId } }),
    staleTime: 60_000,
  });

  const contextoResposta: ContextoResposta = useMemo(
    () => ({
      primeiro_nome:
        ctxCliente?.primeiro_nome ?? info?.nome?.trim().split(/\s+/)[0] ?? null,
      numero_proposta: ctxCliente?.numero_proposta ?? null,
      nome_banco: ctxCliente?.nome_banco ?? null,
      etapa: ctxCliente?.etapa_nome ?? info?.contexto ?? null,
    }),
    [ctxCliente, info?.nome, info?.contexto],
  );

  const meuNome = sessao?.profile?.nome?.trim() || null;
  const queryKey = useMemo(
    () => ["chat-cliente", clienteId, atendenteId ?? "eu"] as const,
    [clienteId, atendenteId],
  );

  return useMemo<ChatAdapter>(
    () => ({
      conversaId: clienteId,
      queryKey,
      meuNome,
      info,
      headerClienteId: clienteId,
      contextoResposta,
      acoes,
      somenteLeitura,
      atendenteNome,
      mineTipo: "time",
      peerNomeCitacao: info?.nome?.trim() || "Cliente",

      listar: () =>
        listar({ data: { cliente_id: clienteId, atendente_id: atendenteId } }),
      responder: (p) =>
        responder({
          data: {
            cliente_id: clienteId,
            atendente_id: atendenteId,
            mensagem: p.mensagem,
            responde_a: p.responde_a,
            interna: p.interna,
            anexo_path: p.anexo_path,
          },
        }),
      editar: (p) => editar({ data: p }),
      excluir: (p) => excluir({ data: p }),
      marcarLido: () => marcarLido({ data: { cliente_id: clienteId } }),

      origem: "cliente",
      reagir: (p) =>
        reagirFn({ data: { origem: "cliente", mensagem_id: p.mensagem_id, emoji: p.emoji } }),
      capabilities: { reagir: true },

      realtime: {
        channel: `chat-cli:${clienteId}`,
        bindings: [
          {
            table: "cliente_app_mensagens",
            filter: `cliente_id=eq.${clienteId}`,
          },
          { table: "chat_reacoes", filter: `origem=eq.cliente` },
        ],
      },


      typing: { id: clienteId, myRole: "time" },

      uploadAnexo: async (file: File) => {
        const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
        const path = `${clienteId}/chat/${Date.now()}-${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("cliente-documentos")
          .upload(path, file, {
            contentType: file.type || undefined,
            upsert: false,
          });
        if (error) throw error;
        return path;
      },

      criarTarefa: (p) =>
        criarTarefaFn({
          data: {
            titulo: p.titulo,
            descricao: p.descricao,
            prazo: p.prazo,
            cliente_id: clienteId,
            prioridade: "p2",
          },
        }),
    }),
    [
      clienteId,
      atendenteId,
      queryKey,
      meuNome,
      info,
      contextoResposta,
      acoes,
      somenteLeitura,
      atendenteNome,
      listar,
      responder,
      editar,
      excluir,
      marcarLido,
      criarTarefaFn,
    ],
  );
}
