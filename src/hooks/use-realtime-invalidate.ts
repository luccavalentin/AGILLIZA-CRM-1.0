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

    // No máximo uma recarga a cada 30 s. As tabelas ouvidas mudam o tempo todo
    // (cada envio de simulação gera várias alterações) e cada recarga refaz o
    // painel inteiro para cada pessoa com ele aberto. A primeira alteração
    // recarrega em 0,4 s, como antes; as que chegam dentro da janela viram
    // uma recarga só ao fim dela — nenhuma alteração fica de fora.
    const INTERVALO_MINIMO_MS = 30_000;
    let ultimaRecarga = 0;
    let pendente: ReturnType<typeof setTimeout> | null = null;
    const invalidar = () => {
      if (pendente) return;
      const espera = Math.max(400, ultimaRecarga + INTERVALO_MINIMO_MS - Date.now());
      pendente = setTimeout(() => {
        pendente = null;
        ultimaRecarga = Date.now();
        alvos.forEach((queryKey) => qc.invalidateQueries({ queryKey }));
      }, espera);
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
