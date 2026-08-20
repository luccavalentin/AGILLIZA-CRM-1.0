import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Função administrativa para destravar simulações e limpar locks.
 */
export const destravarSimulacoes = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ confirm: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { chamarIntegracao } = await import("@/lib/simulacao/homefin.server");
    const { recalcularStatusSimulacao } = await import("@/lib/simulacao/simulacoes.functions");

    if (!data.confirm) throw new Error("Confirmação necessária.");

    const logs: string[] = [];
    let locksLiberados = 0;
    let simulacoesReconsultadas = 0;
    let simulacoesEncerradas = 0;

    // 1. Liberar locks órfãos (> 2 minutos)
    const { data: locks, error: errLock } = await supabaseAdmin
      .from("simulacoes")
      .update({ oportunidade_lock_em: null })
      .lt("oportunidade_lock_em", new Date(Date.now() - 2 * 60 * 1000).toISOString())
      .select("id");
    
    locksLiberados = locks?.length || 0;
    if (locksLiberados > 0) logs.push(`${locksLiberados} locks órfãos liberados.`);

    // 2. Tratar simulações presas em "enviando" (> 30 minutos)
    const limite30min = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const limite24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: presas } = await supabaseAdmin
      .from("simulacoes")
      .select("id, numero_simulacao, status, created_at, codigo_oportunidade_homefin, correspondente_id, homefin_id_oportunidade")
      .eq("status", "enviando")
      .lt("created_at", limite30min);

    if (presas && presas.length > 0) {
      for (const s of presas) {
        // Caso A: Tem ID HomeFin -> Tentar reconsultar
        if (s.homefin_id_oportunidade) {
          try {
            const resp = await chamarIntegracao<any>(`/oportunidade/${s.homefin_id_oportunidade}`, "GET", undefined, {
              simulacao_id: s.id,
              correspondente_id: s.correspondente_id
            });

            const bancosApi = resp?.simulacoes || [];
            let algumSucesso = false;

            for (const apiB of bancosApi) {
              const valor = Number(apiB.valorParcelaBanco || 0);
              if (valor > 0) {
                algumSucesso = true;
                // Atualizar o banco correspondente
                await supabaseAdmin.from("simulacao_bancos").update({
                  status_banco: "simulada",
                  valor_parcela: valor,
                  taxa_juros_ano: apiB.taxaJurosAnoBanco || apiB.taxaJurosAno,
                  taxa_cet_ano: apiB.taxaCetAnoBanco || apiB.taxaCetAno,
                  simulado_em: new Date().toISOString()
                }).eq("simulacao_id", s.id).eq("homefin_id_simulacao_banco", apiB.idSimulacao);
              }
            }

            if (algumSucesso) {
              await recalcularStatusSimulacao(s.id, supabaseAdmin);
              simulacoesReconsultadas++;
            } else if (new Date(s.created_at) < new Date(limite24h)) {
              // Se passou 24h e nada, marca erro
              await supabaseAdmin.from("simulacoes").update({
                status: "erro_banco",
                updated_at: new Date().toISOString()
              }).eq("id", s.id);
              
              await supabaseAdmin.from("simulacao_bancos").update({
                status_banco: "erro",
                mensagem_banco: "Banco não retornou resultado em tempo hábil (24h)."
              }).eq("simulacao_id", s.id).eq("status_banco", "enviando" as any);
              
              simulacoesEncerradas++;
            }
          } catch (e) {
            console.error(`Erro ao reconsultar simulação ${s.numero_simulacao}:`, e);
          }
        } else {
          // Caso B: Não tem ID HomeFin -> Nunca saiu do CRM
          await supabaseAdmin.from("simulacoes").update({
            status: "erro_banco",
            updated_at: new Date().toISOString()
          }).eq("id", s.id);

          await supabaseAdmin.from("simulacao_bancos").update({
            status_banco: "erro",
            mensagem_banco: "Envio não foi concluído. Reenvie a simulação."
          }).eq("simulacao_id", s.id).eq("status_banco", "enviando" as any);

          simulacoesEncerradas++;
        }
      }
    }

    return {
      ok: true,
      locksLiberados,
      simulacoesReconsultadas,
      simulacoesEncerradas,
      logs
    };
  });

/**
 * Retorna contagem de registros que seriam afetados pelo destravamento.
 */
export const obterSumarioDestravamento = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const limite2min = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const limite30min = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const [locks, presas] = await Promise.all([
      supabaseAdmin.from("simulacoes").select("id", { count: "exact", head: true }).lt("oportunidade_lock_em", limite2min),
      supabaseAdmin.from("simulacoes").select("id, homefin_id_oportunidade", { count: "exact" }).eq("status", "enviando").lt("created_at", limite30min)
    ]);

    const comId = (presas.data || []).filter(p => !!p.homefin_id_oportunidade).length;
    const semId = (presas.data || []).filter(p => !p.homefin_id_oportunidade).length;

    return {
      locksVencidos: locks.count || 0,
      presasComId: comId,
      presasSemId: semId
    };
  });
