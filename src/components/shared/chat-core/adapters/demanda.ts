import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  comentarDemanda,
  listarChatDemanda,
  marcarDemandaLida,
  editarChatDemanda,
  excluirChatDemanda,
} from "@/lib/operacional/demandas.functions";
import { reagirMensagem } from "@/lib/chat-core/reacoes.functions";
import { getMinhaSessao } from "@/lib/session.functions";

import type { ChatAdapter, ChatClienteInfo, ContextoResposta } from "../types";

/**
 * Adaptador do chat de Demandas (tabela `demanda_mensagens`).
 *
 * Reaproveita o núcleo de chat com um conjunto reduzido de recursos:
 * sem editar/excluir/responder (a tabela não guarda esses campos),
 * sem "nota interna"/tarefa/retorno.
 */
export function useAdaptadorDemanda({
  demandaId,
  info,
  acoes,
  renderHeader,
}: {
  demandaId: string;
  info?: ChatClienteInfo;
  acoes?: React.ReactNode;
  renderHeader?: ChatAdapter["renderHeader"];
}): ChatAdapter {
  const listarFn = useServerFn(listarChatDemanda);
  const comentarFn = useServerFn(comentarDemanda);
  const marcarLidaFn = useServerFn(marcarDemandaLida);
  const sessaoFn = useServerFn(getMinhaSessao);

  const { data: sessao } = useQuery({
    queryKey: ["minha-sessao"],
    queryFn: () => sessaoFn(),
    staleTime: 5 * 60_000,
  });
  const meuNome = sessao?.profile?.nome?.trim() || null;
  const meuId = sessao?.profile?.id ?? null;

  const queryKey = useMemo(() => ["chat-demanda", demandaId] as const, [demandaId]);

  const contextoResposta: ContextoResposta = useMemo(
    () => ({
      primeiro_nome: info?.nome?.trim().split(/\s+/)[0] ?? null,
      numero_proposta: null,
      nome_banco: null,
      etapa: info?.contexto ?? null,
    }),
    [info?.nome, info?.contexto],
  );

  return useMemo<ChatAdapter>(
    () => ({
      conversaId: demandaId,
      queryKey,
      meuNome,
      info,
      contextoResposta,
      acoes,
      somenteLeitura: false,
      mineTipo: "time",
      peerNomeCitacao: info?.nome?.trim() || "Usuário",

      capabilities: {
        responder: false,
        editar: false,
        excluir: false,
        notaInterna: false,
        tarefa: false,
        retorno: false,
        anexo: true,
        respostasRapidas: false,
        audio: true,
      },

      renderHeader,

      listar: async () => {
        const lista = await listarFn({ data: { demanda_id: demandaId } });
        return lista as any;
      },
      responder: (p) =>
        comentarFn({
          data: {
            demanda_id: demandaId,
            corpo: p.mensagem ?? "",
            visivel_cliente: false,
            anexo_path: p.anexo_path ?? null,
          },
        }),
      editar: async () => {
        throw new Error("Edição indisponível em demandas.");
      },
      excluir: async () => {
        throw new Error("Exclusão indisponível em demandas.");
      },
      marcarLido: () => marcarLidaFn({ data: { demanda_id: demandaId } }),

      realtime: {
        channel: `demanda:${demandaId}`,
        bindings: [
          { table: "demanda_mensagens", filter: `demanda_id=eq.${demandaId}` },
          { table: "demandas", filter: `id=eq.${demandaId}` },
        ],
      },

      // Papel único por usuário — permite múltiplos participantes digitando.
      typing: { id: demandaId, myRole: meuId ?? "eu" },

      uploadAnexo: async (file: File) => {
        const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
        const path = `${demandaId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("demanda-anexos")
          .upload(path, file, {
            contentType: file.type || undefined,
            upsert: false,
          });
        if (error) throw error;
        return path;
      },
    }),
    [
      demandaId,
      queryKey,
      meuNome,
      meuId,
      info,
      contextoResposta,
      acoes,
      renderHeader,
      listarFn,
      comentarFn,
      marcarLidaFn,
    ],
  );
}
