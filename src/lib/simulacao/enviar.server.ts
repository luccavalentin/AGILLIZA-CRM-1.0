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

interface EnviarArgs {
  simulacaoId: string;
  userId: string;
  ip: string | null;
  supabase: SupabaseClient<any, any, any>;
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
}: EnviarArgs): Promise<EnviarResultado> {
  const { data: sim, error } = await supabase
    .from("simulacoes")
    .select("*")
    .eq("id", simulacaoId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!sim) throw new Error("Simulação não encontrada.");

  // Regras de negócio
  if (!sim.consentimento_lgpd || !sim.consentimento_scr) {
    throw new Error(
      "É necessário registrar os consentimentos LGPD e SCR antes de enviar ao banco.",
    );
  }
  if (!sim.id_operacao_homefin) {
    throw new Error("Selecione a operação antes de enviar ao banco.");
  }

  const { data: bancos } = await supabase
    .from("simulacao_bancos")
    .select("*")
    .eq("simulacao_id", simulacaoId)
    .eq("selecionado", true);
  if (!bancos || bancos.length === 0) {
    throw new Error("Selecione ao menos um banco antes de enviar.");
  }

  const correspondente_id = sim.correspondente_id;

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
    if (!idOportunidade) {
      const payload: Record<string, unknown> = {
        operacao: { idOperacao: String(sim.id_operacao_homefin) },
        ...(auth.idRegional ? { regional: { idRegional: auth.idRegional } } : {}),
        ...(auth.idParceiro ? { parceiro: { idParceiro: auth.idParceiro } } : {}),
        ...(auth.idUsuarioParceiro
          ? { usuarioParceiro: { idUsuarioParceiro: auth.idUsuarioParceiro } }
          : {}),
        tipoImovel: { id: sim.tipo_imovel },
        usoImovel: { id: sim.uso_imovel },
        uf: { codigo: sim.uf },
        situacaoImovel: { codigo: sim.situacao_imovel },
        valorImovel: num(sim.valor_imovel),
        valorFinanciamento: num(sim.valor_financiamento),
        prazo: num(sim.prazo),
        utilizaFgtsSimulacao: sim.utiliza_fgts ?? "N",
        codigoSistemaAmortizacaoBanco: { id: sim.sistema_amortizacao ?? "S" },
        bancos: bancos.map((b: any) => ({
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
    }

    // 2 + 3) Simulação + integração por banco
    let sucesso = 0;
    const resultados: EnviarResultado["bancos"] = [];
    for (const b of bancos as any[]) {
      try {
        const simPayload = {
          valorImovel: num(sim.valor_imovel),
          valorFinanciamento: num(sim.valor_financiamento),
          prazo: num(sim.prazo),
          codigoSistemaAmortizacaoBanco: { id: sim.sistema_amortizacao ?? "S" },
          banco: { idBanco: b.homefin_id_banco },
          fgAutorizacaoDados: true,
        };
        const simResp = await chamarIntegracao<any>(
          `/oportunidade/${idOportunidade}/simulacao`,
          "POST",
          simPayload,
          ctx,
        );
        const idSimulacao = String(simResp?.idSimulacao ?? "");

        // A resposta da integração traz os valores retornados pelo banco
        const integ = await chamarIntegracao<any>(
          `/oportunidade/${idOportunidade}/simulacao/${idSimulacao}/integracao`,
          "POST",
          {},
          ctx,
        );

        const dados = integ ?? simResp;

        await supabase
          .from("simulacao_bancos")
          .update({
            homefin_id_simulacao_banco: idSimulacao,
            status_banco: "simulada",
            raw_response: dados,
            simulado_em: new Date().toISOString(),
            valor_parcela: dados?.valorParcelaBanco ?? dados?.valorParcelaSimulacao ?? null,
            taxa_juros_ano: dados?.taxaJurosAnoBanco ?? null,
            prazo_pagamento_max:
              dados?.prazoPagamentoBancoMax ??
              dados?.prazoPagamentoBanco ??
              dados?.prazoPagamentoSimulacao ??
              num(sim.prazo) ??
              null,
            valor_financiamento_max:
              dados?.valorFinanciamentoBancoMax ??
              dados?.valorFinanciamentoBanco ??
              dados?.valorTotalFinanciamento ??
              dados?.valorFinanciamentoSimulacao ??
              num(sim.valor_financiamento) ??
              null,
            valor_parcela_max: dados?.valorParcelaBancoMax ?? null,
            codigo_indexador: dados?.codigoIndexadorBanco ?? null,
            valor_iof: dados?.valorIofBanco ?? null,
            sistema_amortizacao_banco: dados?.codigoSistemaAmortizacaoBanco ?? null,
          })
          .eq("id", b.id);
        sucesso++;
        resultados.push({ banco_id: b.banco_id, status: "simulada" });
      } catch (e) {
        const msg =
          e instanceof IntegracaoBancariaError ? e.message : humanizarErroBanco(null, String(e));
        await supabase
          .from("simulacao_bancos")
          .update({ status_banco: "erro", mensagem_banco: msg })
          .eq("id", b.id);
        resultados.push({ banco_id: b.banco_id, status: "erro", mensagem: msg });
      }
    }

    const novoStatus =
      sucesso === bancos.length ? "simulada" : sucesso > 0 ? "parcialmente_simulada" : "erro_banco";
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
    await supabase
      .from("simulacoes")
      .update({ status: "erro_banco", ultimo_erro: msg })
      .eq("id", simulacaoId);
    throw new Error(msg);
  }
}
