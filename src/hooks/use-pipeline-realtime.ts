import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Mantém as visões de etapa do cliente (painel/kanban, lista, ficha) em sincronia
 * com QUALQUER processo que movimente a esteira — cadastro, endereço, documentos,
 * criação/envio de proposta, avanço manual, etc.
 *
 * A esteira é avançada por triggers no banco e por várias server fns; em vez de
 * depender de cada mutação invalidar todas as telas, ouvimos a tabela
 * `cliente_pipeline` via Realtime e revalidamos as queries dependentes.
 */
export function usePipelineRealtime() {
  const qc = useQueryClient();
  // Nome único por instância: evita colisão de canais entre múltiplas abas/telas.
  const channelName = useRef(`cliente-pipeline-sync-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    // Debounce: várias mutações consecutivas (ex.: envio de proposta que muda
    // status + created followup + updated pipeline) disparam vários eventos em
    // sequência. Coalescemos em uma única invalidação por burst.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const invalidar = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["crm-painel"] });
        qc.invalidateQueries({ queryKey: ["clientes"] });
        qc.invalidateQueries({ queryKey: ["cliente-pipeline"] });
        qc.invalidateQueries({ queryKey: ["cliente"] });
        timer = null;
      }, 400);
    };

    const channel = supabase
      .channel(channelName.current)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cliente_pipeline" },
        invalidar,
      )
      // O painel/ficha do CRM mostram o status da proposta lido de `propostas`.
      // O polling do banco atualiza `propostas.status` sem necessariamente mudar
      // a macro-etapa em `cliente_pipeline`, então ouvimos as duas tabelas para
      // que o painel reflita o banco em tempo real sem refetch manual.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "propostas" },
        invalidar,
      )
      .subscribe();


    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
