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

        // ---------------------------------------------------------------
        // 0. RESGATE DAS IRMÃS NUNCA DESPACHADAS
        //
        // O despacho das simulações-irmãs (2º prazo / outro sistema) é
        // fire-and-forget: `enviarSimulacaoBanco(...).catch(...)` sem await.
        // Quando a resposta da requisição sai antes de essa chamada terminar,
        // ela é abortada — e o resultado é intermitente: a mesma operação
        // despacha a irmã às vezes sim, às vezes não.
        //
        // Essas linhas ficam com `homefin_id_simulacao_banco` NULO, e o
        // resgate abaixo (item 1) as ignora justamente por exigir esse id.
        // Ficavam presas em "Em análise" para sempre, sem nenhuma chamada
        // de API — visível na tela como um prazo inteiro sem valores.
        //
        // Aqui elas são redespachadas. O critério evita mexer em rascunho
        // que o usuário nunca mandou: só entra a simulação cujo AGRUPADOR
        // já teve alguma irmã efetivamente enviada.
        try {
          const { data: orfas } = await supabaseAdmin
            .from("simulacao_bancos")
            .select("simulacao_id, simulacoes!inner(agrupador_id, ultimo_envio_em, homefin_id_oportunidade)")
            .eq("status_banco", "aguardando")
            .is("homefin_id_simulacao_banco", null)
            .gte("created_at", limite24h_limpeza)
            .limit(60);

          const candidatas = new Map<string, string>(); // simulacao_id -> agrupador_id
          for (const o of orfas ?? []) {
            const s = (o as any).simulacoes;
            // Sem agrupador não há lote; e se ela própria já foi enviada,
            // o problema é outro (tratado no item 1).
            if (!s?.agrupador_id || s.ultimo_envio_em) continue;
            candidatas.set(String((o as any).simulacao_id), String(s.agrupador_id));
          }

          if (candidatas.size > 0) {
            const agrupadores = Array.from(new Set(candidatas.values()));
            const { data: enviadas } = await supabaseAdmin
              .from("simulacoes")
              .select("agrupador_id")
              .in("agrupador_id", agrupadores)
              .not("ultimo_envio_em", "is", null);
            const lotesAtivos = new Set((enviadas ?? []).map((e: any) => String(e.agrupador_id)));

            // `enviarSimulacaoBanco` é server fn com `requireSupabaseAuth` e
            // esta rota é pública (autenticada por apikey, sem sessão). Vamos
            // direto na camada de baixo, injetando o cliente admin — é o mesmo
            // caminho que aquela server fn percorre depois do middleware.
            // Teto por rodada. Havia 34 órfãs acumuladas quando isto foi
            // escrito; despachar todas de uma vez seriam ~100 chamadas num
            // único disparo, saturando a fila de concorrência (limite 3) e
            // atrasando as simulações que o usuário está fazendo AGORA.
            // Drenando de 5 em 5, o passivo some em poucas rodadas sem pico.
            const MAX_REDESPACHOS_POR_RODADA = 5;
            let redespachadas = 0;

            const { enviarSimulacaoImpl } = await import("@/lib/simulacao/enviar.server");
            for (const [simId, agrupador] of candidatas) {
              if (redespachadas >= MAX_REDESPACHOS_POR_RODADA) break;
              if (!lotesAtivos.has(agrupador)) continue; // lote nunca enviado: é rascunho mesmo
              redespachadas++;
              try {
                // Com await: aqui estamos numa rota dedicada, não no caminho
                // da resposta ao usuário — dá para esperar de verdade.
                await enviarSimulacaoImpl({
                  simulacaoId: simId,
                  userId: null as unknown as string,
                  ip: null,
                  supabase: supabaseAdmin as any,
                });
                console.info(`[reconciliar] irmã redespachada: ${simId}`);
              } catch (e) {
                console.error(`[reconciliar] falha ao redespachar ${simId}:`, e);
              }
            }
          }
        } catch (e) {
          console.error("[reconciliar] erro no resgate de irmãs não despachadas:", e);
        }

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
