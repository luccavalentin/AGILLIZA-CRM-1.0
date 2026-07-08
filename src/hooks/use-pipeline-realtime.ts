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

  useEffect(() => {
    const invalidar = () => {
      qc.invalidateQueries({ queryKey: ["crm-painel"] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      qc.invalidateQueries({ queryKey: ["cliente-pipeline"] });
      qc.invalidateQueries({ queryKey: ["cliente"] });
    };

    const channel = supabase
      .channel("cliente-pipeline-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cliente_pipeline" },
        invalidar,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
