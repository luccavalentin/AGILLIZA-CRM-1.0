import { createFileRoute } from "@tanstack/react-router";

/**
 * Reconciliação de simulações em estado "aguardando" (polling pós-envio).
 * Necessário para bancos assíncronos (como Santander) que não devolvem
 * os valores de parcela/taxa imediatamente no POST da integração.
 */
export const Route = createFileRoute("/api/public/reconciliar-simulacoes")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const anon = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
        const provided = request.headers.get("apikey");
        if (!anon || provided !== anon) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // --- NOVA ROTINA DE LIMPEZA DE LOCKS E PRESAS ---
        const limite2min = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        const limite30min = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        const limite24h_limpeza = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        // 1. Limpar locks órfãos
        await supabaseAdmin
          .from("simulacoes")
          .update({ oportunidade_lock_em: null })
          .lt("oportunidade_lock_em", limite2min);

        // 2. Tratar simulações presas em 'enviando' sem ID HomeFin (nunca saíram)
        await supabaseAdmin
          .from("simulacoes")
          .update({ 
            status: "erro_banco" as any, 
            updated_at: new Date().toISOString() 
          })
          .eq("status", "enviando")
          .is("homefin_id_oportunidade", null)
          .lt("created_at", limite30min);

        // 3. Marcar erro em simulações com ID HomeFin que nunca retornaram nada após 24h
        const { data: presas24h } = await supabaseAdmin
          .from("simulacoes")
          .select("id")
          .eq("status", "enviando")
          .not("homefin_id_oportunidade", "is", null)
          .lt("created_at", limite24h_limpeza);
        
        if (presas24h && presas24h.length > 0) {
          const ids = presas24h.map(s => s.id);
          await supabaseAdmin.from("simulacoes").update({ status: "erro_banco" as any }).in("id", ids);
          await supabaseAdmin.from("simulacao_bancos").update({ 
            status_banco: "erro" as any, 
            mensagem_banco: "Banco não retornou resultado em tempo hábil (24h)." 
          }).in("simulacao_id", ids).eq("status_banco", "aguardando");
        }
        // --- FIM DA LIMPEZA ---

        const { chamarIntegracao } = await import("@/lib/simulacao/homefin.server");
        const { recalcularStatusSimulacao } = await import("@/lib/simulacao/simulacoes.functions");

        // 1. Localizar simulação_bancos presas em 'aguardando' criadas nas últimas 24h
        const { data: pendentes, error } = await supabaseAdmin
          .from("simulacao_bancos")
          .select(`
            id, 
            simulacao_id, 
            homefin_id_simulacao_banco, 
            nome_banco,
            simulacoes!inner(homefin_id_oportunidade, correspondente_id)
          `)
          .eq("status_banco", "aguardando")
          .not("homefin_id_simulacao_banco", "is", null)
          .gte("created_at", limite24h_limpeza)
          // Sem ordem explícita o lote saía na ordem física da tabela, e as
          // pendências mais novas — as que alguém está olhando agora — podiam
          // ficar fora dele assim que o volume passasse do limite. As mais
          // recentes vêm primeiro; as antigas têm a limpeza de 24h como rede.
          .order("created_at", { ascending: false })
          .limit(50); // Lote pequeno para evitar timeout do worker

        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
        if (!pendentes || pendentes.length === 0) return Response.json({ ok: true, processadas: 0 });

        let recuperadas = 0;
        let erros = 0;

        // Agrupar por oportunidade para economizar GETs
        const porOportunidade = new Map<string, any[]>();
        for (const p of pendentes) {
          const idOp = (p.simulacoes as any).homefin_id_oportunidade;
          if (!idOp) continue;
          const lista = porOportunidade.get(idOp) ?? [];
          lista.push(p);
          porOportunidade.set(idOp, lista);
        }

        for (const [idOp, bancos] of porOportunidade.entries()) {
          try {
            // Consultar a oportunidade na HomeFin
            const resp = await chamarIntegracao<any>(`/oportunidade/${idOp}`, "GET", undefined, {
              simulacao_id: bancos[0].simulacao_id,
              correspondente_id: (bancos[0].simulacoes as any).correspondente_id
            });

            // Ver `homefin-shape.ts`: o GET devolve as simulações dentro de um
            // envelope `oportunidade`. Ler a raiz dava sempre `[]` e nenhum
            // banco assíncrono era reconciliado.
            const { acharSimulacaoBanco } = await import("@/lib/simulacao/homefin-shape");
            
            for (const b of bancos) {
              const apiSim = acharSimulacaoBanco(resp, b.homefin_id_simulacao_banco);

              if (!apiSim) continue;

              const valorParcela = Number(apiSim.valorParcelaBanco || 0);
              const concluiu = valorParcela > 0;

              if (concluiu && valorParcela > 0) {
                const taxaJuros = apiSim.taxaJurosAnoBanco ?? apiSim.taxaJurosAno;
                const taxaCet = apiSim.taxaCetAnoBanco ?? apiSim.taxaCetAno;

                await supabaseAdmin.from("simulacao_bancos").update({
                  status_banco: "simulada" as any,
                  valor_parcela: valorParcela,
                  taxa_juros_ano: taxaJuros ? Number(taxaJuros) : null,
                  taxa_cet_ano: taxaCet ? Number(taxaCet) : null,
                  valor_financiamento_max: apiSim.valorFinanciamento ? Number(apiSim.valorFinanciamento) : null,
                  mensagem_banco: null,
                  raw_response: apiSim,
                  simulado_em: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                }).eq("id", b.id);

                await recalcularStatusSimulacao(b.simulacao_id, supabaseAdmin);
                recuperadas++;
              } else if (apiSim.codigoSituacaoBanco === "E" || apiSim.retornoIntegracao?.toLowerCase().includes("erro")) {
                 // Se houver erro explícito, marcamos como erro
                 await supabaseAdmin.from("simulacao_bancos").update({
                   status_banco: "erro" as any,
                   mensagem_banco: apiSim.retornoIntegracao || "Erro retornado pela instituição.",
                   raw_response: apiSim,
                   updated_at: new Date().toISOString()
                 }).eq("id", b.id);
                 await recalcularStatusSimulacao(b.simulacao_id, supabaseAdmin);
              }
            }
          } catch (e) {
            erros++;
            console.error(`[reconciliar-simulacoes] erro na op ${idOp}:`, e);
          }
        }

        return Response.json({ ok: true, processadas: pendentes.length, recuperadas, erros });
      },
    },
  },
});
