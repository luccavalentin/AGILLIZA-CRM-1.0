/**
 * Implementação do envio de simulação à integração bancária (server-only).
 * Segue o fluxo Oportunidade → Simulação → Integração do contrato oficial.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  chamarIntegracao,
  obterToken,
  IntegracaoBancariaError,
  sanitizarMensagemErro,
} from "./homefin.server";
import { humanizarErroBanco } from "./bank-error-humanizer";
import { prazoMaximoParaProponentes, PRAZO_MIN } from "./prazo";

interface EnviarArgs {
  simulacaoId: string;
  userId: string;
  ip: string | null;
  supabase: SupabaseClient<any, any, any>;
  /** Quando informado, reenvia apenas estes bancos (ex.: só os que deram erro). */
  bancoIds?: string[];
}

interface EnviarResultado {
  oportunidade_id: string | null;
  status: string;
  bancos: { banco_id: string | null; status: string; mensagem?: string }[];
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function enviarSimulacaoImpl({
  simulacaoId,
  userId,
  ip,
  supabase,
  bancoIds,
}: EnviarArgs): Promise<EnviarResultado> {
  const { data: sim, error } = await supabase
    .from("simulacoes")
    .select("*")
    .eq("id", simulacaoId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!sim) throw new Error("Simulação não encontrada.");

  // Trava anti-duplicidade: se um envio começou há menos de 45s e ainda não
  // concluiu, retorna sem duplicar (evita corrida em clique duplo/realtime).
  if (sim.status === "enviando" && sim.ultimo_envio_em) {
    const inicio = new Date(sim.ultimo_envio_em).getTime();
    if (Number.isFinite(inicio) && Date.now() - inicio < 45_000) {
      throw new Error("Um envio ao banco já está em andamento. Aguarde a conclusão.");
    }
  }

  // Regras de negócio
  if (!sim.consentimento_lgpd || !sim.consentimento_scr) {
    throw new Error(
      "É necessário registrar os consentimentos LGPD e SCR antes de enviar ao banco.",
    );
  }
  if (!sim.id_operacao_homefin) {
    throw new Error("Selecione a operação antes de enviar ao banco.");
  }


  // Todos os bancos selecionados (usados para registrar a oportunidade completa).
  const { data: bancosSelecionados } = await supabase
    .from("simulacao_bancos")
    .select("*")
    .eq("simulacao_id", simulacaoId)
    .eq("selecionado", true);
  if (!bancosSelecionados || bancosSelecionados.length === 0) {
    throw new Error("Selecione ao menos um banco antes de enviar.");
  }

  // Subconjunto que será processado nesta chamada (permite progresso por banco).
  const bancos =
    bancoIds && bancoIds.length > 0
      ? bancosSelecionados.filter((b: any) => bancoIds.includes(b.banco_id))
      : bancosSelecionados;
  if (!bancos || bancos.length === 0) {
    throw new Error("Selecione ao menos um banco antes de enviar.");
  }

  const correspondente_id = sim.correspondente_id;

  // ===== Financiar despesas =====
  // A API HomeFin espera a flag como string "S"/"N" (nunca booleano) e, quando
  // marcada, os valores de despesas e o total financiado (financiamento + despesas).
  const financiarDespesas = Boolean(sim.fg_financiar_despesas);
  const fgFinanciarDespesas = financiarDespesas ? "S" : "N";
  const valorDespesasFinanciadas = financiarDespesas
    ? num(sim.valor_despesas_financiadas)
    : 0;
  const valorFinanciamentoBase = num(sim.valor_financiamento);
  const valorTotalFinanciamento = valorFinanciamentoBase + valorDespesasFinanciadas;

  // Regra de bloqueio: não enviar ao banco se "financiar despesas" está marcado
  // mas os valores não foram informados/calculados corretamente.
  if (financiarDespesas) {
    if (!(valorDespesasFinanciadas > 0)) {
      throw new Error(
        'Financiar despesas está marcado, mas o valor das despesas a financiar está vazio ou zerado.',
      );
    }
    if (!(valorTotalFinanciamento > valorFinanciamentoBase)) {
      throw new Error(
        'Valor total do financiamento inválido para simulação com despesas financiadas.',
      );
    }
  }

  // Rede de segurança do PRAZO por idade: mesmo que a simulação tenha sido
  // criada por outra origem (API, importação), ajustamos o prazo pela regra
  // mais restritiva (idade "corrida" do proponente mais velho) para que TODAS
  // as IFs aceitem o envio sem recusar por idade ao término do contrato.
  const { data: parts } = await supabase
    .from("simulacao_participantes")
    .select("data_nascimento")
    .eq("simulacao_id", simulacaoId);
  const datasProponentes = [
    sim.data_nascimento,
    sim.data_nascimento_conjuge,
    ...((parts ?? []) as any[]).map((p) => p.data_nascimento),
  ];
  const prazoMaxIdade = prazoMaximoParaProponentes(datasProponentes);
  const prazoOriginal = num(sim.prazo);
  const prazoSeguro =
    prazoMaxIdade != null && prazoOriginal > prazoMaxIdade
      ? Math.max(PRAZO_MIN, prazoMaxIdade)
      : prazoOriginal;
  if (prazoSeguro !== prazoOriginal) {
    await supabase.from("simulacoes").update({ prazo: prazoSeguro }).eq("id", simulacaoId);
    await supabase.from("simulacao_historico").insert({
      simulacao_id: simulacaoId,
      tipo: "ajuste",
      descricao: `Prazo ajustado de ${prazoOriginal} para ${prazoSeguro} meses conforme a idade do proponente (aceito por todas as instituições).`,
      ator_id: userId,
    });
    sim.prazo = prazoSeguro;
  }


  // grava consentimento_ip e status enviando
  await supabase
    .from("simulacoes")
    .update({
      status: "enviando",
      consentimento_ip: ip,
      consentimento_em: new Date().toISOString(),
      ultimo_envio_em: new Date().toISOString(),
      ultimo_erro: null,
    })
    .eq("id", simulacaoId);

  const ctx = { simulacao_id: simulacaoId, correspondente_id };

  try {
    // Identificadores do parceiro/regional/usuário vêm da autenticação da integração
    const auth = await obterToken();

    // 1) Oportunidade (idempotência: reutiliza se já existe)
    let idOportunidade = sim.homefin_id_oportunidade as string | null;

    // Campos que dependem da simulação atual e podem ter mudado desde a
    // primeira criação da oportunidade (ex.: usuário marcou "financiar despesas"
    // e reenviou). Precisam ser sincronizados também no reenvio, senão o banco
    // continua recebendo os valores antigos.
    const dadosOportunidade: Record<string, unknown> = {
      tipoImovel: { id: sim.tipo_imovel },
      usoImovel: { id: sim.uso_imovel },
      uf: { codigo: sim.uf },
      situacaoImovel: { codigo: sim.situacao_imovel },
      valorImovel: num(sim.valor_imovel),
      valorFinanciamento: num(sim.valor_financiamento),
      prazo: num(sim.prazo),
      utilizaFgtsSimulacao: sim.utiliza_fgts ?? "N",
      fgFinanciarDespesas,
      valorDespesasFinanciadas,
      valorTotalFinanciamento,
      codigoSistemaAmortizacaoBanco: { id: sim.sistema_amortizacao ?? "S" },
    };

    if (!idOportunidade) {
      const payload: Record<string, unknown> = {
        operacao: { idOperacao: String(sim.id_operacao_homefin) },
        ...(auth.idRegional ? { regional: { idRegional: auth.idRegional } } : {}),
        ...(auth.idParceiro ? { parceiro: { idParceiro: auth.idParceiro } } : {}),
        ...(auth.idUsuarioParceiro
          ? { usuarioParceiro: { idUsuarioParceiro: auth.idUsuarioParceiro } }
          : {}),
        ...dadosOportunidade,
        bancos: bancosSelecionados.map((b: any) => ({
          idBanco: b.homefin_id_banco,
          codigoBanco: b.codigo_banco,
          nomeBanco: b.nome_banco,
          flagSimulacao: "S",
        })),
        cpfCnpj: (sim.cpf_cnpj ?? "").replace(/\D/g, ""),
        nome: sim.nome_cliente,
        rendaTotal: num(sim.renda_total),
        dataNascimento: sim.data_nascimento,
        email: sim.email,
        celular: (sim.celular ?? "").replace(/\D/g, ""),
        tipoEstadoCivil: { id: sim.estado_civil },
        fgCompoeRenda: Boolean(sim.compoe_renda),
        ...(sim.possui_conjuge
          ? {
              nomeConjuge: sim.nome_conjuge,
              cpfConjuge: (sim.cpf_conjuge ?? "").replace(/\D/g, ""),
              emailConjuge: sim.email_conjuge,
              celularConjuge: (sim.celular_conjuge ?? "").replace(/\D/g, ""),
              rendaConjuge: num(sim.renda_conjuge),
              dataNascimentoConjuge: sim.data_nascimento_conjuge,
              tipoEstadoCivilConjuge: { id: sim.estado_civil_conjuge },
            }
          : {}),
      };

      const resp = await chamarIntegracao<any>("/oportunidade", "POST", payload, ctx);
      const op = resp?.oportunidade ?? resp ?? {};
      idOportunidade = String(op.idOportunidade ?? op.id ?? "");
      await supabase
        .from("simulacoes")
        .update({
          homefin_id_oportunidade: idOportunidade,
          codigo_oportunidade_homefin: op.codigoOportunidade ?? null,
        })
        .eq("id", simulacaoId);
    } else {
      // Reenvio: sincroniza os dados da oportunidade (inclui fgFinanciarDespesas)
      // antes de rodar as simulações, para o banco receber os valores atuais.
      //
      // IMPORTANTE: essa sincronização é "best-effort". Se a integração retornar
      // erro aqui (ex.: HTTP 500 intermitente no PUT da oportunidade), NÃO
      // abortamos todo o envio — cada banco reenvia seus próprios valores no
      // POST da simulação logo abaixo. Abortar aqui deixaria os bancos presos
      // em "aguardando" para sempre.
      try {
        await chamarIntegracao<any>(
          `/oportunidade/${idOportunidade}`,
          "PUT",
          dadosOportunidade,
          ctx,
        );
      } catch (e) {
        console.warn(
          "Falha ao sincronizar oportunidade (PUT). Prosseguindo com o envio por banco.",
          e instanceof Error ? e.message : String(e),
        );
      }
    }


    // 2 + 3) Simulação + integração por banco.
    // Enviamos um banco de cada vez (SEQUENCIAL): disparar as chamadas em
    // paralelo na mesma oportunidade gera condição de corrida e faz alguns
    // bancos falharem ("erro no envio") enquanto outros passam. Cada banco
    // mantém seu próprio try/catch — a falha de um não impede os demais.
    const enviarBanco = async (b: any): Promise<EnviarResultado["bancos"][number]> => {
      try {
        const simPayload = {
          valorImovel: num(sim.valor_imovel),
          valorFinanciamento: num(sim.valor_financiamento),
          prazo: num(sim.prazo),
          codigoSistemaAmortizacaoBanco: { id: sim.sistema_amortizacao ?? "S" },
          banco: { idBanco: b.homefin_id_banco },
          fgFinanciarDespesas,
          valorDespesasFinanciadas,
          valorTotalFinanciamento,
          fgAutorizacaoDados: true,
        };
        console.log(
          "Payload enviado para criar simulação HomeFin:",
          JSON.stringify(simPayload),
        );
        const simResp = await chamarIntegracao<any>(
          `/oportunidade/${idOportunidade}/simulacao`,
          "POST",
          simPayload,
          ctx,
        );
        const idSimulacao = String(simResp?.idSimulacao ?? "");

        // PUT completo da simulação: garante que a HomeFin persista os campos de
        // despesas financiadas ANTES da integração bancária. Enviamos o payload
        // completo (não parcial) para não apagar/ignorar demais campos.
        const putPayload = {
          valorImovel: num(sim.valor_imovel),
          valorFinanciamento: num(sim.valor_financiamento),
          prazo: num(sim.prazo),
          codigoSistemaAmortizacaoBanco: { id: sim.sistema_amortizacao ?? "S" },
          valorDespesasFinanciadas,
          valorTotalFinanciamento,
          fgFinanciarDespesas,
          fgAutorizacaoDados: true,
        };
        console.log(
          "Payload enviado para atualizar simulação HomeFin:",
          JSON.stringify(putPayload),
          "fgFinanciarDespesas:",
          fgFinanciarDespesas,
          "valorDespesasFinanciadas:",
          valorDespesasFinanciadas,
          "valorTotalFinanciamento:",
          valorTotalFinanciamento,
        );
        const putResp = await chamarIntegracao<any>(
          `/oportunidade/${idOportunidade}/simulacao/${idSimulacao}`,
          "PUT",
          putPayload,
          ctx,
        );
        console.log(
          "Retorno atualização simulação HomeFin:",
          JSON.stringify(putResp),
        );

        // Confirma que a HomeFin persistiu a flag antes de integrar ao banco.
        if (financiarDespesas) {
          const persistido =
            putResp?.simulacao?.fgFinanciarDespesas ?? putResp?.fgFinanciarDespesas;
          if (persistido != null && String(persistido).toUpperCase() !== "S") {
            throw new Error(
              "A integração não confirmou o financiamento de despesas na simulação. Envio ao banco cancelado.",
            );
          }
        }

        // A resposta da integração traz os valores retornados pelo banco
        const integ = await chamarIntegracao<any>(
          `/oportunidade/${idOportunidade}/simulacao/${idSimulacao}/integracao`,
          "POST",
          {},
          ctx,
        );


        const dados = integ ?? simResp;
        const dadosApi = dados?.simulacao ?? dados?.data ?? dados;

        await supabase
          .from("simulacao_bancos")
          .update({
            homefin_id_simulacao_banco: idSimulacao,
            status_banco: "simulada",
            raw_response: dados,
            simulado_em: new Date().toISOString(),
            valor_parcela: dadosApi?.valorParcelaBanco ?? dadosApi?.valorParcelaSimulacao ?? null,
            taxa_juros_ano: dadosApi?.taxaJurosAnoBanco ?? null,
            prazo_pagamento_max:
              dadosApi?.prazoPagamentoBancoMax ??
              dadosApi?.prazoPagamentoBanco ??
              dadosApi?.prazoPagamentoSimulacao ??
              num(sim.prazo) ??
              null,
            valor_financiamento_max:
              dadosApi?.valorFinanciamentoBancoMax ??
              dadosApi?.valorFinanciamentoBanco ??
              dadosApi?.valorTotalFinanciamento ??
              dadosApi?.valorFinanciamentoSimulacao ??
              num(sim.valor_financiamento) ??
              null,
            valor_parcela_max: dadosApi?.valorParcelaBancoMax ?? null,
            codigo_indexador: dadosApi?.codigoIndexadorBanco ?? null,
            valor_iof: dadosApi?.valorIofBanco ?? null,
            // A API devolve `codigoSistemaAmortizacaoBanco` ora como string
            // ("S"/"P"), ora como objeto `{ id: "S" }` — normalizamos para
            // string curta antes de persistir na coluna texto.
            sistema_amortizacao_banco: (() => {
              const v = dadosApi?.codigoSistemaAmortizacaoBanco;
              if (v == null) return null;
              if (typeof v === "string") return v;
              if (typeof v === "object" && "id" in (v as any))
                return String((v as any).id ?? "") || null;
              return String(v);
            })(),

          })
          .eq("id", b.id);
        return { banco_id: b.banco_id, status: "simulada" as const };
      } catch (e) {
        const msg =
          e instanceof IntegracaoBancariaError ? e.message : humanizarErroBanco(null, String(e));
        await supabase
          .from("simulacao_bancos")
          .update({ status_banco: "erro", mensagem_banco: msg })
          .eq("id", b.id);
        return { banco_id: b.banco_id, status: "erro" as const, mensagem: msg };
      }
    };

    const resultados: EnviarResultado["bancos"] = [];
    for (const b of bancos as any[]) {
      resultados.push(await enviarBanco(b));
    }

    // Status geral considerando TODOS os bancos selecionados (não só os desta
    // chamada), pois o envio pode ser feito banco a banco para dar progresso.
    const { data: todosBancos } = await supabase
      .from("simulacao_bancos")
      .select("status_banco")
      .eq("simulacao_id", simulacaoId)
      .eq("selecionado", true);
    const listaStatus = (todosBancos ?? []) as { status_banco: string | null }[];
    const sucesso = listaStatus.filter((r) => r.status_banco === "simulada").length;
    const pendentes = listaStatus.filter(
      (r) => r.status_banco !== "simulada" && r.status_banco !== "erro",
    ).length;

    const novoStatus =
      pendentes > 0
        ? "enviando"
        : sucesso === listaStatus.length
          ? "simulada"
          : sucesso > 0
            ? "parcialmente_simulada"
            : "erro_banco";
    await supabase.from("simulacoes").update({ status: novoStatus }).eq("id", simulacaoId);
    await supabase.from("simulacao_historico").insert({
      simulacao_id: simulacaoId,
      tipo: "envio",
      descricao:
        novoStatus === "simulada"
          ? "Enviada ao banco — retornos recebidos"
          : novoStatus === "parcialmente_simulada"
            ? "Enviada ao banco — retorno parcial"
            : "Falha ao enviar ao banco",
      ator_id: userId,
    });

    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase,
      userId,
      correspondenteId: correspondente_id,
      acao: "simulacao.enviar_banco",
      entidade: "simulacoes",
      entidadeId: simulacaoId,
      payloadNovo: { status: novoStatus, bancos: resultados.length },
    });

    return { oportunidade_id: idOportunidade, status: novoStatus, bancos: resultados };
  } catch (e) {
    const bruto =
      e instanceof IntegracaoBancariaError
        ? e.message
        : e instanceof Error && e.message
          ? e.message
          : "Falha ao enviar ao banco.";
    const msg = sanitizarMensagemErro(bruto);
    // Nenhum banco deste lote pode ficar preso em "aguardando"/"enviando":
    // marca os pendentes como erro para o usuário poder reenviar.
    const idsLote = (bancos as any[]).map((b) => b.id);
    if (idsLote.length > 0) {
      await supabase
        .from("simulacao_bancos")
        .update({ status_banco: "erro", mensagem_banco: msg })
        .in("id", idsLote)
        .in("status_banco", ["aguardando", "enviando"]);
    }
    await supabase
      .from("simulacoes")
      .update({ status: "erro_banco", ultimo_erro: msg })
      .eq("id", simulacaoId);
    throw new Error(msg);
  }
}
