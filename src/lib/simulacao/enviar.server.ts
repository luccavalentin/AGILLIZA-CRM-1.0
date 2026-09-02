import { EnviarArgs, EnviarResultado, IntegracaoBancariaError } from "./enviar.types";
import { chamarIntegracao } from "./homefin.server";
import { num, sanitizarMensagemErro, estadoCivilCrmParaCodigo, recalcularStatusSimulacao } from "./simulacoes.functions";
import { SupabaseClient } from "@supabase/supabase-js";

export async function enviarSimulacaoImpl({ simulacaoId, userId, supabase, bancoIds }: EnviarArgs): Promise<EnviarResultado> {
  const { supabaseAdmin: sbAdminGlobal } = await import("@/integrations/supabase/client.server");


  try {
    const { data: sim } = await supabase.from("simulacoes").select("*, cliente:clientes(*)").eq("id", simulacaoId).maybeSingle();
    if (!sim) throw new Error("Simulação não encontrada.");

    // REDE DE SEGURANÇA NO SERVIDOR (OBRIGATÓRIA): Validar prazo contra idade
    const { data: latestParts } = await supabase.from("simulacao_participantes").select("nome, vinculo, data_nascimento").eq("simulacao_id", simulacaoId).eq("compoe_renda", true);
    const { prazoMaximoParaProponentes, modoTetoIdade } = await import("./prazo");
    const proponentes = [
      { nome: sim.nome_cliente || "Titular", vinculo: "Titular", dataNascimento: sim.data_nascimento },
      // O cônjuge entra no cálculo mesmo sem compor renda — ele assina o
      // contrato de qualquer forma. O que muda é QUEM dita o teto: com
      // composição de renda, o mais velho; sem composição, o mais novo.
      ...(sim.data_nascimento_conjuge ? [{ nome: sim.nome_conjuge || "Cônjuge", vinculo: "cônjuge", dataNascimento: sim.data_nascimento_conjuge }] : []),
      ...(latestParts || []).map(p => ({ nome: p.nome, vinculo: p.vinculo, dataNascimento: p.data_nascimento }))
    ];
    
    // ANALISE DE PRAZO: Centralizada e respeitando restrições de produto/uso
    const compoeRendaConjuge = Boolean(sim.compoe_renda) && sim.compoe_renda_conjuge !== false;
    const analise = prazoMaximoParaProponentes(proponentes, new Date(), modoTetoIdade(compoeRendaConjuge));
    const tMaxIdade = analise?.prazo ?? 420;
    
    // Restrições de Produto/Uso (replicadas da lógica UI para garantia absoluta)
    const { calcularRestricaoEspecial } = await import("./use-simulacao-completa/bancos-helpers");
    const isHE = sim.produto === "home_equity";
    
    const { data: todosBancos } = await supabase.from("simulacao_bancos").select("*").eq("simulacao_id", simulacaoId);
    const bancosMapped = (todosBancos ?? []).map(b => ({ id: b.banco_id, ...b }));
    const restr = calcularRestricaoEspecial(sim, bancosMapped);
    const tMaxOperacional = Math.min(restr.ativo ? restr.prazoMax : 420, isHE ? 240 : 420);
    
    const teto = Math.min(tMaxIdade, tMaxOperacional);
    
    if (sim.prazo > teto) {
      const limitador = analise?.limitador;
      const nascimento = proponentes.find(p => p.nome === limitador?.nome)?.dataNascimento;

      const msgAjuste = limitador 
        ? `Prazo ajustado automaticamente de ${sim.prazo} para ${teto} meses pelo limite de idade de ${limitador.nome} (${limitador.idadeAnos} anos) ou restrição operacional.`
        : `Prazo ajustado automaticamente de ${sim.prazo} para ${teto} meses pelo limite de idade ou restrição operacional.`;

      const infoLog = `[SIM-PRAZO][SERVER] simulacao=${simulacaoId} nascimento=${nascimento} tMaxIdade=${tMaxIdade} tMaxOperacional=${tMaxOperacional} teto=${teto} prazoAntes=${sim.prazo} prazoDepois=${teto} Motivo: ${msgAjuste}`;
      console.warn(infoLog);
      
      const { supabaseAdmin: sbAdmin } = await import("@/integrations/supabase/client.server");
      await sbAdmin.from("simulacoes").update({ prazo: teto }).eq("id", simulacaoId);
      sim.prazo = teto;
    }




    const t0 = performance.now();
    console.info(`[SIM-PERF] inicio total_ms=0`);

    const { data: bancosSelecionados } = await supabase.from("simulacao_bancos").select("*").eq("simulacao_id", simulacaoId).eq("selecionado", true);
    const bancosEscolhidos = bancoIds && bancoIds.length > 0 ? (bancosSelecionados ?? []).filter((b: any) => bancoIds.includes(b.banco_id)) : (bancosSelecionados ?? []);

    // ===== Pessoa jurídica: última barreira antes da consulta =====
    // Simulações criadas antes desta trava, ou reenviadas direto por id, podem
    // trazer bancos que não operam PJ. Consultá-los é recusa certa: marcamos
    // com o motivo em vez de gastar a consulta e devolver "erro interno".
    const ehPJ =
      String((sim as any).tipo_pessoa ?? "").toUpperCase() === "PJ" ||
      String(sim.cpf_cnpj ?? "").replace(/\D/g, "").length === 14;
    let bancosParaProcessar = bancosEscolhidos;
    if (ehPJ) {
      const { bancoOperaPJ } = await import("./use-simulacao-completa/bancos-helpers");
      bancosParaProcessar = bancosEscolhidos.filter((b: any) => bancoOperaPJ(b));
      const recusados = bancosEscolhidos.filter((b: any) => !bancoOperaPJ(b));
      if (recusados.length > 0) {
        const { supabaseAdmin: sbAdminPJ } = await import("@/integrations/supabase/client.server");
        await sbAdminPJ
          .from("simulacao_bancos")
          .update({
            status_banco: "erro" as any,
            mensagem_banco: "Este banco não opera financiamento para pessoa jurídica. Hoje só o Bradesco atende esta modalidade.",
          })
          .in("id", recusados.map((b: any) => b.id));
        console.warn(
          `[enviar.server][PJ] simulacao=${simulacaoId} bancos ignorados: ${recusados.map((b: any) => b.nome_banco).join(", ")}`,
        );
      }
    }

    const { supabaseAdmin: sbAdminEnvio } = await import("@/integrations/supabase/client.server");
    await sbAdminEnvio.from("simulacoes").update({ ultimo_envio_em: new Date().toISOString() }).eq("id", simulacaoId);

    console.info(`[SIM-PERF] dados_carregados total_ms=${(performance.now() - t0).toFixed(0)}`);
    if (bancosParaProcessar.length === 0) {
      // Em PJ pode não ter sobrado banco algum — nesse caso a simulação não foi
      // simulada, foi recusada. Recalcula em vez de reportar sucesso.
      if (ehPJ && bancosEscolhidos.length > 0) {
        const statusPJ = (await recalcularStatusSimulacao(simulacaoId, supabase)) as EnviarResultado["status"];
        await sbAdminEnvio.from("simulacoes").update({ status: statusPJ }).eq("id", simulacaoId);
        return { oportunidade_id: sim.homefin_id_oportunidade, status: statusPJ, bancos: [] };
      }
      return { oportunidade_id: sim.homefin_id_oportunidade, status: "simulada", bancos: [] };
    }

    let idOportunidade = sim.homefin_id_oportunidade;
    
    // CACHE DE PREPARAÇÃO: Evitar chamadas redundantes (GET Oportunidade / PUT Participante)
    // Se a simulação já tem homefin_id_oportunidade, não precisamos criar nem preparar participantes novamente.
    // O backend já faz o trabalho pesado na FASE A (preparação individual do banco).
    
    try {
      const { supabaseAdmin: sbAdminContext } = await import("@/integrations/supabase/client.server");

      const tokenInfo = await (await import("./homefin.server")).obterToken();
      console.info(`[SIM-PERF] token_pronto total_ms=${(performance.now() - t0).toFixed(0)}`);

      if (!idOportunidade) {
        // LOCK PESSIMISTA PARA CRIAÇÃO DE OPORTUNIDADE (Eleição de Líder)
        // Evita que SAC e PRICE criem duas oportunidades simultâneas para o mesmo agrupador/agente
        const tLock = performance.now();
        const { data: lockOk, error: lockError } = await sbAdminContext.rpc("eleger_lider_oportunidade", {
          p_simulacao_id: simulacaoId
        });
        console.info(`[SIM-PERF] oportunidade_lock_ms=${(performance.now() - tLock).toFixed(0)} result=${lockOk} err=${lockError?.message || 'none'}`);

        if (lockError) {
          console.error(`[SIM-PERF] Erro crítico na assinatura da RPC eleger_lider_oportunidade:`, lockError);
        }

        if (!lockOk && !lockError) {
          let opId = null;
          for (let i = 0; i < 20; i++) {
            const { supabaseAdmin: sbAdmin } = await import("@/integrations/supabase/client.server");
            const { data: check } = await sbAdmin.from("simulacoes").select("homefin_id_oportunidade").eq("id", simulacaoId).maybeSingle();
            if (check?.homefin_id_oportunidade) {
              opId = check.homefin_id_oportunidade;
              break;
            }

            await new Promise(r => setTimeout(r, 500));
          }
          idOportunidade = opId;
        }


        if (!idOportunidade) {
          const { data: terceiros } = await supabase.from("simulacao_participantes").select("*").eq("simulacao_id", simulacaoId);
          const rendaTerceiros = (terceiros ?? [])
            .filter((p: any) => p.compoe_renda)
            .reduce((acc: number, p: any) => acc + num(p.renda), 0);

          const fgFinanciarDespesas = sim.fg_financiar_despesas ? "S" : "N";
          const valorDespesasFinanciadas = sim.fg_financiar_despesas ? num(sim.valor_despesas_financiadas) : 0;
          const valorFinanciamento = num(sim.valor_financiamento);
          const valorTotalFinanciamento = valorFinanciamento + valorDespesasFinanciadas;

          const { supabaseAdmin: sbAdminPayload } = await import("@/integrations/supabase/client.server");

          const payloadOp: any = {

            nome: sim.nome_cliente, cpfCnpj: String(sim.cpf_cnpj || "").replace(/\D/g, ""), dataNascimento: sim.data_nascimento, email: sim.email,
            celular: String(sim.celular || "").replace(/\D/g, ""),
            rendaTotal: num(sim.renda_total) + (sim.compoe_renda_conjuge ? num(sim.renda_conjuge) : 0) + rendaTerceiros,
            fgCompoeRenda: Boolean(sim.possui_conjuge && sim.compoe_renda_conjuge), utilizaFgtsSimulacao: "N", valorImovel: num(sim.valor_imovel),
            valorTotalFinanciamento, valorFinanciamento, valorDespesasFinanciadas,
            fgFinanciarDespesas, prazo: num(sim.prazo), uf: { codigo: sim.uf }, tipoEstadoCivil: { id: estadoCivilCrmParaCodigo(sim.estado_civil) },
            tipoImovel: { id: sim.tipo_imovel === "CS" ? "CS" : "AP" }, situacaoImovel: { codigo: sim.situacao_imovel === "N" ? "N" : "U" },
            usoImovel: { id: sim.uso_imovel === "R" ? "R" : "C" }, operacao: { idOperacao: String(sim.id_operacao_homefin || "1") },
            parceiro: { idParceiro: tokenInfo.idParceiro || "167" }, regional: { idRegional: tokenInfo.idRegional || "1" },
            usuarioParceiro: { idUsuarioParceiro: tokenInfo.idUsuarioParceiro || "159" },
            codigoSistemaAmortizacaoBanco: { id: sim.sistema_amortizacao === "P" ? "P" : "S" },
            bancos: bancosParaProcessar.map(b => ({ idBanco: b.homefin_id_banco || b.codigo_banco, nomeBanco: b.nome_banco, codigoBanco: b.codigo_banco, flagSimulacao: "N" }))
          };

          // Só manda cônjuge quando ele existe de fato: estado civil casado e
          // identificação preenchida. Confiar em `possui_conjuge` já enviou
          // cônjuge fantasma de titular solteiro.
          const ecSim = String(sim.estado_civil ?? "").trim().toLowerCase();
          const casadoSim =
            ecSim === "ca" || ecSim === "ue" || ecSim === "casado" || ecSim === "uniao_estavel";
          const conjugeIdentificado =
            String(sim.nome_conjuge ?? "").trim() !== "" ||
            String(sim.cpf_conjuge ?? "").replace(/\D/g, "") !== "";
          if (casadoSim && conjugeIdentificado) {
            payloadOp.nomeConjuge = sim.nome_conjuge; payloadOp.cpfConjuge = String(sim.cpf_conjuge || "").replace(/\D/g, "");
            payloadOp.dataNascimentoConjuge = sim.data_nascimento_conjuge; payloadOp.emailConjuge = sim.email_conjuge;
            payloadOp.celularConjuge = String(sim.celular_conjuge || "").replace(/\D/g, ""); payloadOp.rendaConjuge = num(sim.renda_conjuge);
            // Usa o estado civil do próprio cônjuge; só cai no do titular
            // quando a coluna dedicada está vazia.
            payloadOp.tipoEstadoCivilConjuge = {
              id: estadoCivilCrmParaCodigo(sim.estado_civil_conjuge || sim.estado_civil),
            };
          }

          const resp = await chamarIntegracao<any>("/oportunidade", "POST", payloadOp, { simulacao_id: simulacaoId });
          idOportunidade = String(resp?.oportunidade?.idOportunidade || resp?.idOportunidade || resp?.id || "");
          
          if (idOportunidade) {
            // --- Pessoa jurídica -------------------------------------------
            // O `POST /oportunidade` JÁ cria o participante titular e, quando o
            // documento é um CNPJ, já o marca com `tipoPessoa: "J"` sozinho.
            // Postar um segundo participante com o mesmo CNPJ deixava a
            // oportunidade com dois compradores idênticos e o Bradesco devolvia
            // `INT-006 ... falhou: undefined` — quebrava antes de formular uma
            // recusa (a PF, com documentos distintos, recebia códigos normais
            // como "121-L"). Então aqui a gente ATUALIZA o participante que já
            // existe, em vez de criar outro.
            const docTitular = String(sim.cpf_cnpj ?? "").replace(/\D/g, "");
            if (docTitular.length === 14) {
              const { data: empresa } = await sbAdminPayload
                .from("clientes")
                .select(
                  "tipo_empresa, faturamento_empresa, patrimonio_liquido_empresa, capital_social_empresa",
                )
                // O mesmo CNPJ pode existir em mais de um correspondente; sem o
                // escopo, `maybeSingle` estoura com "multiple rows returned".
                .eq("correspondente_id", sim.correspondente_id)
                .eq("documento", docTitular)
                .maybeSingle();

              try {
                // Localiza o participante que a oportunidade criou para este
                // CNPJ. Preferimos o comprador principal; qualquer um com o
                // mesmo documento serve de alvo.
                const respOp = await chamarIntegracao<any>(
                  `/oportunidade/${idOportunidade}`,
                  "GET",
                  undefined,
                  { simulacao_id: simulacaoId },
                );
                const participantesOp: any[] =
                  respOp?.oportunidade?.participantes ?? respOp?.participantes ?? [];
                const mesmoDoc = participantesOp.filter(
                  (p: any) => String(p?.cpfCnpj ?? "").replace(/\D/g, "") === docTitular,
                );
                const alvo =
                  mesmoDoc.find((p: any) => p?.compradorPrincipal === "S") ?? mesmoDoc[0] ?? null;
                const idAlvo = alvo?.idParticipante ?? null;

                const c: any = sim.cliente ?? {};
                await chamarIntegracao<any>(
                  // Sem alvo (a API mudou o comportamento, ou o titular não foi
                  // criado), cai no POST — melhor um participante a mais do que
                  // uma oportunidade PJ sem dados de empresa.
                  idAlvo
                    ? `/oportunidade/${idOportunidade}/participante/${idAlvo}`
                    : `/oportunidade/${idOportunidade}/participante`,
                  idAlvo ? "PUT" : "POST",
                  {
                    // Obrigatórios do contrato (marcados com "S" na
                    // documentação) — valem também para pessoa jurídica, ainda
                    // que alguns não tenham equivalente natural numa empresa.
                    // Onde falta dado, seguimos o mesmo padrão de preenchimento
                    // já usado no envio de terceiros.
                    tipoSituacao: "A",
                    tipoQualificacao: "CO",
                    tipoPessoa: "J",
                    nomeParticipante: sim.nome_cliente,
                    cpfCnpj: docTitular,
                    dataNascimento: sim.data_nascimento,
                    nomeMae: c.mae || "NAO INFORMADO",
                    tipoSexo: c.sexo || "M",
                    tipoEstadoCivil: estadoCivilCrmParaCodigo(c.estado_civil) || "S",
                    tipoDocumentoIdentidade: c.tipo_documento_identidade || "RG",
                    numeroDocumento: c.numero_documento || docTitular,
                    orgaoExpedidor: c.orgao_expedidor || "JUCESP",
                    ufExpedicao: c.uf_expedicao || sim.uf || "SP",
                    nomeProfissao: c.profissao || "EMPRESARIO",
                    renda: num(sim.renda_total),
                    email: sim.email,
                    celular: String(sim.celular ?? "").replace(/\D/g, ""),
                    cep: String(c.imovel_cep ?? sim.cep_imovel ?? "01001000").replace(/\D/g, ""),
                    logradouro: c.imovel_logradouro || "Nao informado",
                    numeroLogradouro: c.imovel_numero || "SN",
                    bairro: c.imovel_bairro || "Centro",
                    municipio: c.imovel_cidade || "Sao Paulo",
                    uf: c.imovel_uf || sim.uf || "SP",
                    utilizaFgts: "N",
                    fgAutorizacaoDados: true,
                    // Opcionais no contrato: enviados quando o cadastro tem.
                    // Em PJ a data de abertura mora no mesmo campo da data de
                    // nascimento.
                    dataRegistroEmpresa: sim.data_nascimento,
                    tipoEmpresa: empresa?.tipo_empresa ?? undefined,
                    faturamentoEmpresa: num(empresa?.faturamento_empresa) || undefined,
                    patrimonioLiquidoEmpresa: num(empresa?.patrimonio_liquido_empresa) || undefined,
                    capitalSocialEmpresa: num(empresa?.capital_social_empresa) || undefined,
                  },
                  { simulacao_id: simulacaoId },
                );
                console.info(
                  `[PJ] participante jurídico ${idAlvo ? `atualizado (PUT ${idAlvo})` : "criado (POST)"} na oportunidade ${idOportunidade}`,
                );
              } catch (e) {
                console.error("[PJ] falha ao enviar participante jurídico:", e);
              }
            }

            if (terceiros && terceiros.length > 0) {
              for (const p of terceiros) {
                if (p.homefin_id_participante) continue;
                try {
                  const dados = (p.dados as any) || {};
                  const payloadPart = {
                    tipoQualificacao: "CO",
                    tipoPessoa: (p.cpf_cnpj || "").replace(/\D/g, "").length > 11 ? "J" : "F",
                    nomeParticipante: p.nome,
                    cpfCnpj: (p.cpf_cnpj || "").replace(/\D/g, ""),
                    dataNascimento: p.data_nascimento,
                    nomeMae: dados.nome_mae || "NÃO INFORMADO",
                    tipoSexo: (dados.sexo || p.sexo) || "M",
                    tipoEstadoCivil: estadoCivilCrmParaCodigo(p.estado_civil) || "S",
                    renda: num(p.renda),
                    email: dados.email || "agilliza@agilliza.com.br",
                    celular: (dados.celular || "11999999999").replace(/\D/g, ""),
                    cep: (dados.cep || "01001000").replace(/\D/g, ""),
                    logradouro: dados.logradouro || "Rua Não Informada",
                    numeroLogradouro: dados.numero || "SN",
                    complementoLogradouro: dados.complemento || "",
                    bairro: dados.bairro || "Centro",
                    municipio: dados.municipio || "São Paulo",
                    uf: dados.uf || "SP"
                  };
                  const respPart = await chamarIntegracao<any>(`/oportunidade/${idOportunidade}/participante`, "POST", payloadPart, { simulacao_id: simulacaoId });
                  const idPart = String(respPart?.participante?.idParticipante || respPart?.idParticipante || respPart?.id || "");
                  if (idPart) {
                    const { supabaseAdmin: sbAdminPart } = await import("@/integrations/supabase/client.server");
                    await sbAdminPart.from("simulacao_participantes").update({ homefin_id_participante: idPart }).eq("id", p.id);

                  }

                } catch (errPart) {
                  console.error(`[enviar.server] Falha ao enviar participante ${p.nome}:`, errPart);
                }
              }
            }

            const { supabaseAdmin: sbAdminUpdate } = await import("@/integrations/supabase/client.server");

            const updatePayload = { 
              homefin_id_oportunidade: idOportunidade, 
              codigo_oportunidade_homefin: resp?.oportunidade?.codigoOportunidade || resp?.codigoOportunidade || null 
            };
            await sbAdminUpdate.from("simulacoes").update(updatePayload).eq("id", simulacaoId);

            if (sim.agrupador_id) {
              await sbAdminUpdate.from("simulacoes")
                .update(updatePayload)
                .eq("agrupador_id", sim.agrupador_id)
                .eq("cliente_id", sim.cliente_id)
                .is("homefin_id_oportunidade", null);
            }

          }
        }
      }

    } catch (e) { 
      console.error(`[enviar.server] Falha Oportunidade na simulação ${simulacaoId}:`, e); 
      if (!idOportunidade) throw e; 
    }

    const resultados: EnviarResultado["bancos"] = [];
    
    // ETAPA 3: Paralelização controlada de bancos no servidor.
    // Otimização: Garantimos que cada banco use o idOportunidade cacheado.
    const CONCORRENCIA_INTEGRACOES = 3;
    const processarEmLotes = async (bancos: any[], concurrency: number) => {
      const resultadosLocais: any[] = [];
      const fila = [...bancos];
      
      const worker = async () => {
        while (fila.length > 0) {
          const b = fila.shift();
          if (!b) continue;
          
          try {
            const { data: bAtual } = await supabase.from("simulacao_bancos").select("status_banco, valor_parcela, homefin_id_simulacao_banco").eq("id", b.id).maybeSingle();
            
            if (bAtual?.homefin_id_simulacao_banco) {
              if (num(bAtual.valor_parcela) > 0 || bAtual.status_banco === "simulada") {
                resultadosLocais.push({ banco_id: b.banco_id, status: "simulada" });
                continue;
              }
              
              const origin = process.env.VITE_SITE_URL || "http://localhost:8080";
              const apiKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
              
              const global = globalThis as any;
              const lastRec = global[`_last_rec_${idOportunidade}`] || 0;
              if (performance.now() - lastRec > 2000) {
                global[`_last_rec_${idOportunidade}`] = performance.now();
                // A reconciliação agora é disparada via fetch mas sem await, 
                // para não segurar a resposta interativa do worker.
                fetch(`${origin}/api/public/reconciliar-simulacoes`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "apikey": apiKey || "" },
                }).catch(e => console.error("[reconciliar-simulacoes] falha ao disparar polling background:", e));
              }
              
              resultadosLocais.push({ banco_id: b.banco_id, status: "aguardando" });
              continue;
            }
    
            const tStartOp = performance.now();
            console.info(`[SIM-PERF] [${b.nome_banco}] oportunidade_start_ms=${(tStartOp - t0).toFixed(0)}`);
            const res = await processarBancoIndividual(b, idOportunidade!, sim, supabase, t0);
            resultadosLocais.push({ banco_id: b.banco_id, status: res.status });
          } catch (err) {
            console.error(`[enviar.server][${b.nome_banco}] Erro fatal:`, err);
            const { supabaseAdmin: sbAdminErr } = await import("@/integrations/supabase/client.server");
            await sbAdminErr.from("simulacao_bancos").update({ 
              status_banco: "erro" as any, 
              mensagem_banco: sanitizarMensagemErro(String(err)) 
            }).eq("id", b.id);
            resultadosLocais.push({ banco_id: b.banco_id, status: "erro" });
          }
        }
      };
      
      await Promise.all(Array.from({ length: Math.min(concurrency, bancos.length) }, worker));
      return resultadosLocais;
    };
    
    const results = await processarEmLotes(bancosParaProcessar, CONCORRENCIA_INTEGRACOES);
    resultados.push(...results);

    // ETAPA 4: Persistência imediata do status (ERRO CRÍTICO 2)
    const statusFinal = (await recalcularStatusSimulacao(simulacaoId, supabase)) as EnviarResultado["status"];
    const { supabaseAdmin: sbAdminFinal } = await import("@/integrations/supabase/client.server");
    await sbAdminFinal.from("simulacoes").update({ status: statusFinal }).eq("id", simulacaoId);


    // ETAPA 5: Rotinas Auxiliares (Comparativo de CPF, PDF, Reconciliação)
    // REMOVIDO: Recursão do comparativo de CPF via reenviar() (ERRO CRÍTICO 1)
    
    return { oportunidade_id: idOportunidade, status: statusFinal, bancos: resultados };
  } catch (e: any) {
    console.error(`[enviarSimulacaoImpl] Erro fatal:`, e);
    throw e;
  }
}

async function processarBancoIndividual(b: any, idOportunidade: string, sim: any, supabase: SupabaseClient, t0: number): Promise<{ status: any }> {
  const { supabaseAdmin: sbAdminProc } = await import("@/integrations/supabase/client.server");
  const simulacaoId = sim.id;

  try {
    // FASE A: Preparação (Criação da simulação bancária)
    await sbAdminProc.from("simulacao_bancos").update({ status_banco: "aguardando", mensagem_banco: "Iniciando preparação...", updated_at: new Date().toISOString() }).eq("id", b.id);
    
    const fgFinanciarDespesas = sim.fg_financiar_despesas ? "S" : "N";
    const valorDespesasFinanciadas = sim.fg_financiar_despesas ? num(sim.valor_despesas_financiadas) : 0;
    const valorFinanciamento = num(sim.valor_financiamento);
    const valorTotalFinanciamento = valorFinanciamento + valorDespesasFinanciadas;

    const payloadSim = {
      idOportunidade, banco: { idBanco: b.homefin_id_banco || b.codigo_banco },
      codigoSistemaAmortizacaoBanco: { id: sim.sistema_amortizacao === "P" ? "P" : "S" },
      prazo: num(sim.prazo), // Já normalizado acima caso estivesse inválido
      valorImovel: num(sim.valor_imovel), valorFinanciamento,
      // O contrato define `fgAutorizacaoDados` como BOOLEAN (Swagger e
      // documentação). Enviávamos a string "S", que é o formato dos flags
      // S/N de outros campos — aqui o tipo é outro.
      valorTotalFinanciamento, valorDespesasFinanciadas, fgFinanciarDespesas, fgAutorizacaoDados: true,
      // Empresa não tem sexo, então em PJ este campo saía ausente — e ausência
      // é a única diferença que sobrou entre os envios que o Bradesco responde
      // e os que ele quebra sem devolver motivo. Mandamos o mesmo valor que já
      // gravamos no participante jurídico, para o payload ficar coerente.
      tipoSexo:
        (sim.cliente?.sexo || (sim.dados as any)?.sexo) ||
        (String(sim.cpf_cnpj ?? "").replace(/\D/g, "").length === 14 ? "M" : undefined),
      tipoSexoConjuge: (sim.cliente?.conjuge_sexo || (sim.dados as any)?.conjuge_sexo || (sim.cliente?.dados as any)?.conjuge_sexo) || undefined
    };


    const respSim = await chamarIntegracao<any>(`/oportunidade/${idOportunidade}/simulacao`, "POST", payloadSim, { simulacao_id: simulacaoId });
    const idSimulacaoBanco = String(respSim?.simulacao?.idSimulacao ?? respSim?.idSimulacao ?? respSim?.id ?? "");
    if (!idSimulacaoBanco) throw new Error("ID simulação banco ausente.");

    await sbAdminProc.from("simulacao_bancos").update({ homefin_id_simulacao_banco: idSimulacaoBanco, mensagem_banco: "Simulação bancária preparada." }).eq("id", b.id);

    // FASE B: Integração (Chamada pesada)
    await sbAdminProc.from("simulacao_bancos").update({ mensagem_banco: "Integrando com a instituição..." }).eq("id", b.id);
    const respInt = await chamarIntegracao<any>(`/oportunidade/${idOportunidade}/simulacao/${idSimulacaoBanco}/integracao`, "POST", {}, { simulacao_id: simulacaoId });

    const fonte = respInt ?? respSim;
    const valorParcela = num(fonte?.valorParcelaBanco ?? fonte?.valorParcelaSimulacao ?? fonte?.simulacao?.valorParcelaBanco ?? respSim?.valorParcelaBanco);
    
    if (valorParcela > 0) {
      const taxaJuros = fonte?.taxaJurosAnoBanco ?? respSim?.taxaJurosAnoBanco ?? fonte?.taxaJurosAno ?? respSim?.taxaJurosAno;
      const taxaCet = fonte?.taxaCetAnoBanco ?? respSim?.taxaCetAnoBanco ?? fonte?.taxaCetAno ?? respSim?.taxaCetAno;

      await sbAdminProc.from("simulacao_bancos").update({ 

        status_banco: "simulada" as any, 
        valor_parcela: valorParcela, 
        taxa_juros_ano: taxaJuros != null && num(taxaJuros) > 0 ? num(taxaJuros) : undefined,
        taxa_cet_ano: taxaCet != null && num(taxaCet) > 0 ? num(taxaCet) : undefined,
        mensagem_banco: null,
        raw_response: fonte, 
        simulado_em: new Date().toISOString() 
      }).eq("id", b.id);
      return { status: "simulada" };
    } else {
      await sbAdminProc.from("simulacao_bancos").update({ 
        status_banco: "aguardando" as any, 
        mensagem_banco: "Aguardando resposta da instituição...",
        raw_response: fonte 
      }).eq("id", b.id);
      
      const origin = process.env.VITE_SITE_URL || "http://localhost:8080";
      const apiKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
      
      const global = globalThis as any;
      const lastRec = global[`_last_rec_${idOportunidade}`] || 0;
      if (performance.now() - lastRec > 2000) {
        global[`_last_rec_${idOportunidade}`] = performance.now();
        fetch(`${origin}/api/public/reconciliar-simulacoes`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": apiKey || "" },
        }).catch(e => console.error("[reconciliar-simulacoes] falha ao disparar polling background:", e));
      }
      
      return { status: "aguardando" };
    }
  } catch (e: any) {
    let msg = sanitizarMensagemErro(e instanceof Error ? e.message : String(e));
    const { supabaseAdmin: sbAdminErr } = await import("@/integrations/supabase/client.server");
    
    const { data: latestSim } = await sbAdminErr.from("simulacoes").select("data_nascimento, possui_conjuge, compoe_renda_conjuge, data_nascimento_conjuge").eq("id", simulacaoId).single();
    const { data: latestParts } = await sbAdminErr.from("simulacao_participantes").select("data_nascimento").eq("simulacao_id", simulacaoId).eq("compoe_renda", true);

    
    const { idadeEmMesesCorridos } = await import("./prazo");
    const todasDatas = [latestSim?.data_nascimento];
    if (latestSim?.possui_conjuge && latestSim?.compoe_renda_conjuge) todasDatas.push(latestSim.data_nascimento_conjuge);
    (latestParts || []).forEach(p => todasDatas.push(p.data_nascimento));
    
    const idades = todasDatas.map(d => d ? idadeEmMesesCorridos(d) : 0).filter((i): i is number => !!i && i > 0);
    const idadeMaxMeses = idades.length > 0 ? Math.max(...idades) : 0;

    let prazoMinBanco = null;
    let prazoMaxBanco = null;
    const matchMin = msg.match(/superior a[:\s]+(\d+)/i) || msg.match(/mínimo aceito[^:]*[:\s]+(\d+)/i);
    if (matchMin) prazoMinBanco = parseInt(matchMin[1]);
    const matchMax = msg.match(/maximo de (\d+)/i) || msg.match(/máximo aceito[^:]*[:\s]+(\d+)/i);
    if (matchMax) prazoMaxBanco = parseInt(matchMax[1]);

    await sbAdminErr.from("simulacao_bancos").update({ 
      status_banco: "erro" as any, 
      mensagem_banco: msg, 
      raw_response: {
        error: String(e),
        instrumentacao: {
          prazo_enviado: num(sim.prazo),
          idade_proponente_velho_meses: idadeMaxMeses,
          soma_prazo_idade: num(sim.prazo) + idadeMaxMeses,
          http_status: e instanceof IntegracaoBancariaError ? (e as any).statusHttp : undefined,
          prazo_min_detectado: prazoMinBanco,
          prazo_max_detectado: prazoMaxBanco
        }
      },
      ...({ prazo_min_banco: prazoMinBanco, prazo_max_banco: prazoMaxBanco } as any)
    }).eq("id", b.id);

    return { status: "erro" };
  }
}
