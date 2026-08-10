import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Tabelas que impactam KPIs/cards de relatórios e painéis. */
export const TABELAS_METRICAS = [
  "propostas",
  "simulacoes",
  "clientes",
  "demandas",
  "tasks",
  "comissoes",
  "financial_receivables",
  "financial_payables",
] as const;

/**
 * Assina alterações no Postgres e invalida as queries informadas, mantendo
 * cards, KPIs e gráficos atualizados em tempo real (inclusive ticket médio).
 */
export function useRealtimeInvalidate(
  canal: string,
  chaves: string[][],
  tabelas: readonly string[] = TABELAS_METRICAS,
) {
  const qc = useQueryClient();
  const tabelasKey = tabelas.join(",");
  const chavesKey = JSON.stringify(chaves);

  useEffect(() => {
    const lista = tabelasKey ? tabelasKey.split(",") : [];
    const alvos: string[][] = JSON.parse(chavesKey);
    if (!lista.length || !alvos.length) return;

    let pendente: ReturnType<typeof setTimeout> | null = null;
    const invalidar = () => {
      if (pendente) clearTimeout(pendente);
      // Debounce: várias alterações seguidas geram um único refetch.
      pendente = setTimeout(() => {
        alvos.forEach((queryKey) => qc.invalidateQueries({ queryKey }));
      }, 400);
    };

    const channel = supabase.channel(`rt-${canal}`);
    lista.forEach((table) => {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, invalidar);
    });
    channel.subscribe();

    return () => {
      if (pendente) clearTimeout(pendente);
      supabase.removeChannel(channel);
    };
  }, [canal, chavesKey, qc, tabelasKey]);
}
