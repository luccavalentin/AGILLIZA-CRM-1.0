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

        /**
         * Bancos assíncronos são reenviados até responderem.
         *
         * Não existe mais "desistir aos N minutos": o sistema insiste sozinho
         * e avisa na tela enquanto insiste. O único corte é a faxina de 24 h,
         * que já existia e continua sendo a rede final para o que nunca volta.
         *
         * O intervalo entre tentativas cresce para não martelar o provedor:
         * 45 s na primeira, depois 1min30, 2min15, 3min e daí a cada 5 min. A
         * mediana de resposta do Santander é de 23 s, então a primeira
         * insistência já cai num ponto útil.
         */
        const janelaDeRetentativa = (tentativas: number) => Math.min(0.75 * (tentativas + 1), 5);

        /** Quantas simulações órfãs (sem id na HomeFin) reenviar por rodada. */
        const MAX_ORFAS_POR_RODADA = 3;

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
            updated_at: new Date().toISOString(),
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
          const ids = presas24h.map((s) => s.id);
          await supabaseAdmin
            .from("simulacoes")
            .update({ status: "erro_banco" as any })
            .in("id", ids);
          await supabaseAdmin
            .from("simulacao_bancos")
            .update({
              status_banco: "erro" as any,
              mensagem_banco: "Banco não retornou resultado em tempo hábil (24h).",
            })
            .in("simulacao_id", ids)
            .eq("status_banco", "aguardando");
        }
        // --- FIM DA LIMPEZA ---

        const { chamarIntegracao } = await import("@/lib/simulacao/homefin.server");
        const { recalcularStatusSimulacao } = await import("@/lib/simulacao/simulacoes.functions");

        /**
         * 0. Órfãs: bancos em "aguardando" que nunca chegaram à HomeFin.
         *
         * São as linhas que a tela mostra como "Não enviado" — sem
         * `homefin_id_simulacao_banco` elas ficam fora da reconciliação
         * normal, que só resgata quem já tem id. Aqui o envio é refeito do
         * zero, do mesmo jeito que o botão "Reenviar" faz.
         *
         * Lote pequeno por rodada: cada envio é uma sequência de chamadas
         * reais à HomeFin e o worker tem tempo limitado. O cron roda a cada
         * 2 minutos, então a fila anda sozinha.
         */
        let reenviadasOrfas = 0;
        try {
          const { data: orfas } = await supabaseAdmin
            .from("simulacao_bancos")
            .select("simulacao_id, simulacoes!inner(usuario_criador_id, status, deleted_at)")
            .eq("status_banco", "aguardando")
            .is("homefin_id_simulacao_banco", null)
            .gte("created_at", limite24h_limpeza)
            .limit(60);

          const porSimulacao = new Map<string, string | null>();
          for (const o of orfas ?? []) {
            const sim = (o as any).simulacoes;
            if (!sim || sim.deleted_at) continue;
            if (!porSimulacao.has(o.simulacao_id)) {
              porSimulacao.set(o.simulacao_id, sim.usuario_criador_id ?? null);
            }
          }

          if (porSimulacao.size > 0) {
            const { enviarSimulacaoImpl } = await import("@/lib/simulacao/enviar.server");
            const fila = Array.from(porSimulacao.entries()).slice(0, MAX_ORFAS_POR_RODADA);

            for (const [simulacaoId, criadorId] of fila) {
              try {
                await supabaseAdmin
                  .from("simulacao_bancos")
                  .update({
                    mensagem_banco: "Reenviando automaticamente ao banco...",
                    updated_at: new Date().toISOString(),
                  })
                  .eq("simulacao_id", simulacaoId)
                  .eq("status_banco", "aguardando")
                  .is("homefin_id_simulacao_banco", null);

                await enviarSimulacaoImpl({
                  simulacaoId,
                  userId: criadorId ?? "",
                  ip: null,
                  supabase: supabaseAdmin,
                });
                reenviadasOrfas++;
              } catch (e) {
                console.error(`[reconciliar-simulacoes] falha ao reenviar órfã ${simulacaoId}:`, e);
              }
            }
          }
        } catch (e) {
          console.error("[reconciliar-simulacoes] falha ao varrer órfãs:", e);
        }

        // 1. Localizar simulação_bancos presas em 'aguardando' criadas nas últimas 24h
        const { data: pendentes, error } = await supabaseAdmin
          .from("simulacao_bancos")
          .select(
            `
            id, 
            simulacao_id, 
            homefin_id_simulacao_banco, 
            nome_banco,
            created_at,
            raw_response,
            simulacoes!inner(homefin_id_oportunidade, correspondente_id)
          `,
          )
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
        if (!pendentes || pendentes.length === 0)
          return Response.json({ ok: true, processadas: 0, reenviadasOrfas });

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
              correspondente_id: (bancos[0].simulacoes as any).correspondente_id,
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

                await supabaseAdmin
                  .from("simulacao_bancos")
                  .update({
                    status_banco: "simulada" as any,
                    valor_parcela: valorParcela,
                    taxa_juros_ano: taxaJuros ? Number(taxaJuros) : null,
                    taxa_cet_ano: taxaCet ? Number(taxaCet) : null,
                    valor_financiamento_max: apiSim.valorFinanciamento
                      ? Number(apiSim.valorFinanciamento)
                      : null,
                    mensagem_banco: null,
                    raw_response: apiSim,
                    simulado_em: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", b.id);

                await recalcularStatusSimulacao(b.simulacao_id, supabaseAdmin);
                recuperadas++;
              } else {
                // Sem valor de parcela. Antes só encerrávamos com erro
                // explícito, e o provedor quase nunca dá um: nas simulações
                // travadas de 08/09 (95284, 95326, 95335) `retornoIntegracao`
                // e `codigoSituacaoBanco` vinham nulos. Nenhum ramo executava
                // e a linha ficava "Em análise" até a faxina de 24 h.
                //
                // `codigoSituacaoBanco === "E"` também nunca casava: o "E"
                // aparece em `tipoSituacao`, não nesse campo.
                //
                // Agora o tempo decide. Em 30 dias, a mediana até a simulação
                // do Santander ficar pronta é de 23 s e apenas 17 de 1.755
                // passaram de 15 minutos; depois disso, esperar não traz
                // resultado — traz só um status que mente.
                const retorno = String(apiSim.retornoIntegracao ?? "").toLowerCase();
                const erroExplicito =
                  apiSim.codigoSituacaoBanco === "E" || retorno.includes("erro");
                const minutosEspera =
                  (Date.now() - new Date(b.created_at as string).getTime()) / 60_000;

                // `P` é o estado normal de uma simulação que ainda não virou
                // proposta — 95334 está em "P" com parcela de R$ 9.216,71. Por
                // isso ele só vira erro junto com a espera esgotada; o que
                // caracteriza a falha é continuar sem valor depois do prazo.
                // Antes de desistir, reenviamos a integração.
                //
                // É o que o operador faz na mão quando a linha trava, e os
                // números dizem que funciona: das 1.755 simulações do
                // Santander concluídas em 30 dias, 965 só saíram do lugar
                // depois do envio inicial — mais do que as 773 que vieram na
                // hora. O provedor responde 200 vazio e simplesmente não
                // processa; a segunda chamada costuma processar.
                //
                // `/integracao` é a mesma rota do botão "Reenviar": não cria
                // registro novo, apenas manda ao banco a simulação que já
                // existe e está identificada por id. Repetir é seguro.
                const tentativas = Number((b as any)?.raw_response?._retentativas_integracao ?? 0);
                const ultima = (b as any)?.raw_response?._ultima_retentativa as string | undefined;
                const minutosDesdeUltima = ultima
                  ? (Date.now() - new Date(ultima).getTime()) / 60_000
                  : minutosEspera;
                // Insiste enquanto o banco não se pronunciar; o intervalo
                // cresce a cada tentativa.
                const podeRetentar =
                  !erroExplicito && minutosDesdeUltima >= janelaDeRetentativa(tentativas);

                if (podeRetentar) {
                  try {
                    const reenvio = await chamarIntegracao<any>(
                      `/oportunidade/${idOp}/simulacao/${b.homefin_id_simulacao_banco}/integracao`,
                      "POST",
                      {},
                      {
                        simulacao_id: b.simulacao_id,
                        correspondente_id: (b.simulacoes as any).correspondente_id,
                      },
                    );
                    const parcelaReenvio = Number(reenvio?.valorParcelaBanco || 0);

                    if (parcelaReenvio > 0) {
                      await supabaseAdmin
                        .from("simulacao_bancos")
                        .update({
                          status_banco: "simulada" as any,
                          valor_parcela: parcelaReenvio,
                          taxa_juros_ano: reenvio.taxaJurosAnoBanco
                            ? Number(reenvio.taxaJurosAnoBanco)
                            : null,
                          taxa_cet_ano: reenvio.taxaCetAnoBanco
                            ? Number(reenvio.taxaCetAnoBanco)
                            : null,
                          mensagem_banco: null,
                          raw_response: reenvio,
                          simulado_em: new Date().toISOString(),
                          updated_at: new Date().toISOString(),
                        })
                        .eq("id", b.id);
                      await recalcularStatusSimulacao(b.simulacao_id, supabaseAdmin);
                      recuperadas++;
                      continue;
                    }

                    // Sem valor ainda: registra a tentativa para não repetir
                    // a cada rodada do cron e deixa a próxima janela decidir.
                    await supabaseAdmin
                      .from("simulacao_bancos")
                      .update({
                        raw_response: {
                          ...(reenvio ?? apiSim),
                          _retentativas_integracao: tentativas + 1,
                          _ultima_retentativa: new Date().toISOString(),
                        },
                        mensagem_banco: `Sem retorno do ${b.nome_banco ?? "banco"} ainda. Reenviando automaticamente (tentativa ${tentativas + 1})...`,
                        updated_at: new Date().toISOString(),
                      })
                      .eq("id", b.id);
                    continue;
                  } catch (erroReenvio) {
                    console.error(
                      `[reconciliar-simulacoes] falha ao reenviar ${b.homefin_id_simulacao_banco}:`,
                      erroReenvio,
                    );
                    await supabaseAdmin
                      .from("simulacao_bancos")
                      .update({
                        raw_response: {
                          ...(apiSim ?? {}),
                          _retentativas_integracao: tentativas + 1,
                          _ultima_retentativa: new Date().toISOString(),
                        },
                        updated_at: new Date().toISOString(),
                      })
                      .eq("id", b.id);
                    continue;
                  }
                }

                // Só um "não" do banco encerra a linha. Sem mensagem, ela
                // segue em análise e sendo reenviada — a faxina de 24 h é o
                // corte final.
                if (erroExplicito) {
                  await supabaseAdmin
                    .from("simulacao_bancos")
                    .update({
                      status_banco: "erro" as any,
                      mensagem_banco:
                        apiSim.retornoIntegracao ||
                        `O ${b.nome_banco ?? "banco"} não devolveu os valores desta simulação. Reenvie para tentar de novo.`,
                      raw_response: apiSim,
                      updated_at: new Date().toISOString(),
                    })
                    .eq("id", b.id);
                  await recalcularStatusSimulacao(b.simulacao_id, supabaseAdmin);
                  erros++;
                }
              }
            }
          } catch (e) {
            erros++;
            console.error(`[reconciliar-simulacoes] erro na op ${idOp}:`, e);
          }
        }

        return Response.json({
          ok: true,
          processadas: pendentes.length,
          recuperadas,
          erros,
          reenviadasOrfas,
        });
      },
    },
  },
});
