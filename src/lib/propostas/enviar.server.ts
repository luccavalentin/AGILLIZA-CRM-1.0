/**
 * Envio de proposta à integração bancária (server-only).
 * Reutiliza o cliente da Etapa 04. Marca branca: nenhum texto ao usuário
 * cita o fornecedor.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  chamarIntegracao,
  IntegracaoBancariaError,
  sanitizarMensagemErro,
} from "@/lib/simulacao/homefin.server";
import { transicaoPermitida, type PropostaStatus } from "./state-machine";

/** Ordem de progressão do funil (para sincronização vinda do banco). */
const ORDEM_STATUS: PropostaStatus[] = [
  "rascunho",
  "enviada_banco",
  "em_analise_credito",
  "credito_aprovado",
  "aguardando_documentos",
  "engenharia_vistoria",
  "analise_juridica",
  "contrato_emitido",
  "registrado",
];

/** Deriva o status interno a partir do nome da etapa ativa retornada pelo banco. */
function statusDaEtapa(nomeEtapa: string | null): PropostaStatus | null {
  if (!nomeEtapa) return null;
  const n = nomeEtapa.toLowerCase();
  if (n.includes("registr")) return "registrado";
  if (n.includes("contrato")) return "contrato_emitido";
  if (n.includes("jurídic") || n.includes("juridic")) return "analise_juridica";
  if (n.includes("engenharia") || n.includes("vistoria") || n.includes("avaliaç"))
    return "engenharia_vistoria";
  if (n.includes("document")) return "aguardando_documentos";
  if (n.includes("aprov")) return "credito_aprovado";
  if (
    n.includes("análise") ||
    n.includes("analise") ||
    n.includes("crédito") ||
    n.includes("credito")
  )
    return "em_analise_credito";
  return null;
}

interface EnviarArgs {
  propostaId: string;
  userId: string;
  ip: string | null;
  supabase: SupabaseClient<any, any, any>;
  /** Quando informado, envia apenas este proposta_banco (envio por linha). */
  bancoId?: string | null;
}

interface EnviarResultado {
  status: string;
  bancos: {
    banco_id: string | null;
    nome_banco: string | null;
    status: string;
    mensagem?: string;
  }[];
}

function soDigitos(v: unknown): string | undefined {
  const s = String(v ?? "").replace(/\D/g, "");
  return s.length ? s : undefined;
}

/**
 * Garante que o(s) participante(s) da oportunidade tenham endereço preenchido
 * (principalmente a UF), pois integrações como a do Itaú validam
 * `proponents[0].address.state` e recusam a proposta quando está em branco.
 * A oportunidade cria o proponente principal sem endereço; aqui completamos os
 * dados a partir dos envolvidos da proposta (ou, na falta, do endereço do imóvel).
 */
async function garantirEnderecoParticipantes({
  prop,
  idOportunidade,
  ctx,
  supabase,
}: {
  prop: any;
  idOportunidade: string;
  ctx: { simulacao_id: any; proposta_id: string; correspondente_id: any };
  supabase: SupabaseClient<any, any, any>;
}): Promise<void> {
  let participantes: any[] = [];
  try {
    const resp = await chamarIntegracao<any>(
      `/oportunidade/${idOportunidade}`,
      "GET",
      undefined,
      ctx,
    );
    const op = resp?.oportunidade ?? resp ?? {};
    participantes = Array.isArray(op?.participantes) ? op.participantes : [];
  } catch {
    // Sem a lista de participantes não há como completar o endereço; segue o envio.
    return;
  }
  if (participantes.length === 0) return;

  const { data: envolvidos } = await supabase
    .from("proposta_envolvidos")
    .select("*")
    .eq("proposta_id", prop.id);

  for (const part of participantes) {
    // Já possui UF cadastrada — nada a corrigir.
    if (part?.uf && String(part.uf).trim()) continue;

    const cpf = soDigitos(part?.cpfCnpj);
    const env = (envolvidos ?? []).find(
      (e: any) => soDigitos(e.cpf_cnpj) === cpf,
    );

    const uf = env?.uf ?? prop.uf ?? null;
    if (!uf) continue; // sem UF não é possível satisfazer a validação do banco

    const payload: Record<string, unknown> = {
      tipoSituacao: part?.tipoSituacao ?? "A",
      nomeParticipante: part?.nomeParticipante ?? prop.nome_cliente,
      tipoQualificacao: part?.tipoQualificacao ?? "CO",
      tipoPessoa: part?.tipoPessoa ?? ((cpf?.length ?? 0) > 11 ? "J" : "F"),
      cpfCnpj: cpf,
      dataNascimento: part?.dataNascimento ?? undefined,
      tipoEstadoCivil: part?.tipoEstadoCivil ?? env?.estado_civil ?? undefined,
      renda: part?.renda ?? undefined,
      email: part?.email ?? env?.email ?? prop.email ?? undefined,
      celular: part?.celular ?? soDigitos(env?.celular) ?? undefined,
      fgAutorizacaoDados: true,
      cep: soDigitos(env?.cep ?? prop.cep_imovel),
      logradouro: env?.logradouro ?? prop.endereco_imovel ?? undefined,
      numeroLogradouro: env?.numero_logradouro ?? undefined,
      complementoLogradouro: env?.complemento ?? undefined,
      bairro: env?.bairro ?? prop.bairro_imovel ?? undefined,
      municipio: env?.municipio ?? prop.cidade_imovel ?? undefined,
      uf,
    };

    try {
      await chamarIntegracao<any>(
        `/oportunidade/${idOportunidade}/participante/${part.idParticipante}`,
        "PUT",
        payload,
        ctx,
      );
    } catch {
      // Falha ao completar o endereço não deve abortar o envio dos demais bancos.
    }
  }
}



export async function enviarPropostaImpl({
  propostaId,
  userId,
  ip,
  supabase,
  bancoId,
}: EnviarArgs): Promise<EnviarResultado> {
  const { data: prop, error } = await supabase
    .from("propostas")
    .select("*")
    .eq("id", propostaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!prop) throw new Error("Proposta não encontrada.");

  if (!prop.homefin_id_oportunidade) {
    throw new Error(
      "Proposta sem oportunidade vinculada. Origine a partir de uma simulação enviada ao banco.",
    );
  }

  const statusAtual = prop.status as PropostaStatus;
  // Primeiro envio = ainda em rascunho ou após um erro de envio.
  // Envio adicional = a proposta já foi ao banco e queremos incluir outro(s)
  // banco(s) na MESMA oportunidade (a API permite várias propostas por oportunidade).
  const primeiroEnvio = statusAtual === "rascunho" || statusAtual === "erro_envio";
  const STATUS_BLOQUEIA_NOVO_BANCO: PropostaStatus[] = [
    "cancelada",
    "registrado",
    "credito_recusado",
    "contrato_emitido",
  ];

  if (primeiroEnvio) {
    // valida a transição pela máquina de estados (só rascunho/erro_envio podem iniciar)
    if (!transicaoPermitida(statusAtual, "enviada_banco")) {
      throw new Error("Esta proposta não pode ser enviada no estado atual.");
    }
  } else if (STATUS_BLOQUEIA_NOVO_BANCO.includes(statusAtual)) {
    throw new Error("Esta proposta não aceita novos bancos no estado atual.");
  }

  // documentos obrigatórios pendentes OU reprovados bloqueiam o envio
  const { data: docsObrig } = await supabase
    .from("proposta_documentos")
    .select("id, status")
    .eq("proposta_id", propostaId)
    .eq("obrigatorio", true);
  const bloqueantes = (docsObrig ?? []).filter(
    (d: any) => d.status === "pendente" || d.status === "reprovado",
  );
  if (bloqueantes.length > 0) {
    throw new Error(
      `Existem ${bloqueantes.length} documento(s) obrigatório(s) pendente(s) ou reprovado(s).`,
    );
  }

  // Bancos a enviar: por linha (bancoId) ou todos os selecionados ainda não enviados.
  let query = supabase.from("proposta_bancos").select("*").eq("proposta_id", propostaId);
  if (bancoId) {
    query = query.eq("id", bancoId);
  } else {
    query = query.eq("selecionado", true);
  }
  const { data: bancosSel } = await query;
  const bancos = (bancosSel ?? []).filter((b: any) => b.status_banco !== "enviada");
  if (bancos.length === 0) {
    throw new Error(
      bancoId
        ? "Este banco já foi enviado ou não está disponível para envio."
        : primeiroEnvio
          ? "Selecione ao menos um banco antes de enviar."
          : "Nenhum banco novo selecionado. Selecione outro banco para enviar.",
    );
  }

  if (primeiroEnvio) {
    await supabase
      .from("propostas")
      .update({
        status: "enviada_banco",
        enviada_em: new Date().toISOString(),
        ip_consentimento: ip,
        ultimo_erro: null,
      })
      .eq("id", propostaId);
  }

  const ctx = {
    simulacao_id: prop.simulacao_id,
    proposta_id: propostaId,
    correspondente_id: prop.correspondente_id,
  };

  // Alguns bancos (ex.: Itaú) rejeitam a proposta quando o proponente está sem
  // endereço (proponents[0].address.state). Garantimos o endereço do(s)
  // participante(s) na oportunidade ANTES de incluir as propostas.
  await garantirEnderecoParticipantes({ prop, idOportunidade: prop.homefin_id_oportunidade, ctx, supabase });

  const resultados: EnviarResultado["bancos"] = [];
  let sucesso = 0;


  for (const b of bancos as any[]) {
    try {
      const resp = await chamarIntegracao<any>(
        `/oportunidade/${prop.homefin_id_oportunidade}/incluir-proposta-integracao`,
        "POST",
        { idSimulacao: b.homefin_id_simulacao_banco ?? prop.homefin_id_simulacao },
        ctx,
      );

      // A integração devolve HTTP 200 mesmo quando o banco RECUSA a proposta na
      // validação (ex.: Itaú com "maritalStatus cannot be null"). O erro real
      // vem no campo retornoIntegracao (nível superior ou dentro de
      // descricaoRespostaBanco). Se houver erro, a proposta NÃO foi aceita.
      const erroBanco =
        extrairErroRetorno(resp?.retornoIntegracao) ??
        extrairErroRetorno(resp?.descricaoRespostaBanco?.retornoIntegracao);
      if (erroBanco) {
        throw new IntegracaoBancariaError(erroBanco);
      }

      await supabase
        .from("proposta_bancos")
        .update({ status_banco: "enviada", selecionado: true, mensagem_banco: null })
        .eq("id", b.id);
      sucesso++;
      resultados.push({ banco_id: b.banco_id, nome_banco: b.nome_banco, status: "enviada" });
    } catch (e) {
      const msg = sanitizarMensagemErro(
        e instanceof IntegracaoBancariaError ? e.message : "Falha ao enviar ao banco.",
      );
      await supabase
        .from("proposta_bancos")
        .update({ status_banco: "erro", mensagem_banco: msg })
        .eq("id", b.id);
      resultados.push({
        banco_id: b.banco_id,
        nome_banco: b.nome_banco,
        status: "erro",
        mensagem: msg,
      });
    }
  }


  // No primeiro envio o status avança; em envios adicionais o status já reflete
  // a análise em andamento e não deve retroceder.
  let novoStatus = statusAtual;
  if (primeiroEnvio) {
    novoStatus = sucesso > 0 ? "em_analise_credito" : "erro_envio";
    await supabase.from("propostas").update({ status: novoStatus }).eq("id", propostaId);
  }

  await supabase.from("proposta_historico").insert({
    proposta_id: propostaId,
    tipo_evento: sucesso > 0 ? "enviada_ao_banco" : "erro_envio",
    descricao: sucesso > 0 ? "Proposta enviada ao banco" : "Falha ao enviar proposta ao banco",
    status_novo: novoStatus,
    ator_id: userId,
  });

  const { registrarAuditoria } = await import("@/lib/admin/audit.server");
  await registrarAuditoria({
    supabase,
    userId,
    correspondenteId: prop.correspondente_id,
    acao: "proposta.enviar_banco",
    entidade: "propostas",
    entidadeId: propostaId,
    payloadNovo: { status: novoStatus, bancos: resultados.length },
  });

  return { status: novoStatus, bancos: resultados };
}

export async function enviarFollowupHomefinImpl({
  propostaId,
  titulo,
  comentario,
  supabase,
}: {
  propostaId: string;
  titulo: string;
  comentario: string;
  supabase: SupabaseClient<any, any, any>;
}): Promise<void> {
  const { data: prop } = await supabase
    .from("propostas")
    .select("homefin_id_oportunidade, simulacao_id, correspondente_id")
    .eq("id", propostaId)
    .maybeSingle();
  if (!prop?.homefin_id_oportunidade) return;
  await chamarIntegracao<any>(
    `/oportunidade/${prop.homefin_id_oportunidade}/follow-up`,
    "POST",
    { idOportunidade: prop.homefin_id_oportunidade, tipoFup: "E", titulo, comentario },
    {
      simulacao_id: prop.simulacao_id,
      proposta_id: propostaId,
      correspondente_id: prop.correspondente_id,
    },
  );
}

export async function cancelarPropostaHomefinImpl({
  propostaId,
  supabase,
}: {
  propostaId: string;
  supabase: SupabaseClient<any, any, any>;
}): Promise<void> {
  const { data: prop } = await supabase
    .from("propostas")
    .select("homefin_id_oportunidade, simulacao_id, correspondente_id")
    .eq("id", propostaId)
    .maybeSingle();
  if (!prop?.homefin_id_oportunidade) return;
  await chamarIntegracao<any>(
    `/oportunidade/${prop.homefin_id_oportunidade}`,
    "PUT",
    { tipoSituacao: "C" },
    {
      simulacao_id: prop.simulacao_id,
      proposta_id: propostaId,
      correspondente_id: prop.correspondente_id,
    },
  );
}

/** Extrai mensagem de erro legível do campo retornoIntegracao do banco. */
function extrairErroRetorno(retorno: unknown): string | null {
  if (!retorno) return null;
  let obj: any = retorno;
  if (typeof retorno === "string") {
    try {
      obj = JSON.parse(retorno);
    } catch {
      return retorno;
    }
  }
  if (obj && Array.isArray(obj.fields) && obj.fields.length > 0) {
    return (
      obj.fields
        .map((f: any) => f?.message)
        .filter(Boolean)
        .join("; ") ||
      obj.message ||
      null
    );
  }
  return obj?.message ?? null;
}

/** Traduz o tipoSituacao da proposta (por banco) para status interno do banco. */
function statusInternoBanco(
  tipo: string,
  temErro: boolean,
): {
  banco: string;
  proposta: PropostaStatus | "credito_recusado" | null;
} {
  const t = String(tipo ?? "")
    .toUpperCase()
    .charAt(0);
  if (temErro) return { banco: "erro", proposta: null };
  switch (t) {
    case "A":
      return { banco: "aprovada", proposta: "credito_aprovado" };
    case "R":
      return { banco: "recusada", proposta: "credito_recusado" };
    case "N":
      return { banco: "em_analise", proposta: "em_analise_credito" };
    case "P":
      return { banco: "erro", proposta: null };
    case "E":
      // "E" observado como enviada/em análise quando não há erro de retorno.
      return { banco: "em_analise", proposta: "em_analise_credito" };
    case "S":
      return { banco: "enviada", proposta: "em_analise_credito" };
    default:
      return { banco: "enviada", proposta: null };
  }
}

/**
 * Sincroniza o andamento da proposta consultando a integração bancária.
 * A API é baseada em consulta (polling): não há webhook/callback. Este handler
 * lê GET /oportunidade/{id} e reconcilia o status a partir de DUAS fontes:
 *  1. `oportunidade.simulacoes[]` — status por banco da integração automática
 *     (Análise Crédito / Crédito Aprovado / Crédito Recusado / erro de envio);
 *  2. a etapa ativa do funil (Engenharia / Jurídica / Contrato / Registro) e
 *     `tipoSituacao` da oportunidade (T = Contrato / C = Cancelada).
 */
export async function sincronizarPropostaImpl({
  propostaId,
  userId,
  supabase,
}: {
  propostaId: string;
  userId: string;
  supabase: SupabaseClient<any, any, any>;
}): Promise<{ status: string; etapa: string | null; atualizado: boolean }> {
  const { data: prop, error } = await supabase
    .from("propostas")
    .select("*")
    .eq("id", propostaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!prop) throw new Error("Proposta não encontrada.");
  if (!prop.homefin_id_oportunidade) {
    throw new Error("Proposta ainda não foi enviada ao banco.");
  }

  const ctx = {
    simulacao_id: prop.simulacao_id,
    proposta_id: propostaId,
    correspondente_id: prop.correspondente_id,
  };
  const resp = await chamarIntegracao<any>(
    `/oportunidade/${prop.homefin_id_oportunidade}`,
    "GET",
    undefined,
    ctx,
  );
  const op = resp?.oportunidade ?? resp ?? {};
  const etapas: any[] = Array.isArray(resp?.etapa) ? resp.etapa : [];
  const simulacoes: any[] = Array.isArray(op?.simulacoes) ? op.simulacoes : [];

  // etapa ativa (não concluída) de maior ordem, senão a última concluída
  const ativa = etapas
    .filter((e) => e?.active && !e?.completed)
    .sort((a, b) => (b?.ordemEtapa ?? 0) - (a?.ordemEtapa ?? 0))[0];
  const ultimaConcluida = etapas
    .filter((e) => e?.completed)
    .sort((a, b) => (b?.ordemEtapa ?? 0) - (a?.ordemEtapa ?? 0))[0];
  const nomeEtapa: string | null = (ativa?.nomeEtapa ?? ultimaConcluida?.nomeEtapa ?? null) || null;

  // ---- 1) Reconciliação por banco (oportunidade.simulacoes) ----
  const { data: bancosProp } = await supabase
    .from("proposta_bancos")
    .select("*")
    .eq("proposta_id", propostaId);

  let algumAprovado = false;
  let algumEmAnalise = false;
  let algumRecusado = false;
  let algumErro = false;
  const errosBanco: string[] = [];
  let simEscolhida: any = null;

  for (const pb of (bancosProp ?? []) as any[]) {
    const sim = simulacoes.find(
      (s) => String(s?.idSimulacao) === String(pb.homefin_id_simulacao_banco),
    );
    if (!sim) continue;

    const erroMsg = extrairErroRetorno(sim.retornoIntegracao);
    const mapa = statusInternoBanco(sim.tipoSituacao, Boolean(erroMsg));

    if (mapa.proposta === "credito_aprovado") algumAprovado = true;
    else if (mapa.proposta === "em_analise_credito") algumEmAnalise = true;
    else if (mapa.proposta === "credito_recusado") algumRecusado = true;
    if (mapa.banco === "erro") {
      algumErro = true;
      if (erroMsg)
        errosBanco.push(`${pb.nome_banco ?? "Banco"}: ${sanitizarMensagemErro(erroMsg)}`);
    }
    if (sim.bancoEscolhido === "S" || mapa.proposta === "credito_aprovado") simEscolhida = sim;

    const patchBanco: Record<string, unknown> = {
      status_banco: mapa.banco,
      mensagem_banco: erroMsg ? sanitizarMensagemErro(erroMsg) : null,
    };
    if (sim.valorParcelaBanco != null) patchBanco.valor_parcela = sim.valorParcelaBanco;
    if (sim.taxaJurosAnoBanco != null) patchBanco.taxa_juros_ano = sim.taxaJurosAnoBanco;
    if (sim.prazoPagamentoBancoMax != null)
      patchBanco.prazo_pagamento_max = sim.prazoPagamentoBancoMax;
    if (sim.valorFinanciamentoBancoMax != null)
      patchBanco.valor_financiamento_max = sim.valorFinanciamentoBancoMax;
    if (sim.valorIofBanco != null) patchBanco.valor_iof = sim.valorIofBanco;
    if (sim.codigoSistemaAmortizacaoBanco)
      patchBanco.sistema_amortizacao_banco = sim.codigoSistemaAmortizacaoBanco;
    if (sim.codigoIndexadorBanco) patchBanco.codigo_indexador = sim.codigoIndexadorBanco;
    await supabase
      .from("proposta_bancos")
      .update(patchBanco as any)
      .eq("id", pb.id);
  }

  // Status candidato a partir dos bancos (melhor desfecho prevalece).
  let statusBancos: PropostaStatus | null = null;
  if (algumAprovado) statusBancos = "credito_aprovado";
  else if (algumEmAnalise) statusBancos = "em_analise_credito";
  else if (algumRecusado) statusBancos = "credito_recusado";
  else if (algumErro) statusBancos = "erro_envio";

  // ---- 2) Situação da oportunidade / etapa do funil ----
  const situacao = String(op?.tipoSituacao ?? "")
    .toUpperCase()
    .charAt(0);
  const statusEtapa = statusDaEtapa(nomeEtapa);

  // ---- Decisão final ----
  let novoStatus: string | null = null;
  if (situacao === "T") {
    novoStatus = "contrato_emitido";
  } else if (situacao === "C") {
    novoStatus = "cancelada";
  } else {
    // Avança apenas para frente no funil (nunca regride).
    const atual = ORDEM_STATUS.indexOf(prop.status as PropostaStatus);
    const candidatos = [statusBancos, statusEtapa].filter(Boolean) as PropostaStatus[];
    for (const c of candidatos) {
      const idx = ORDEM_STATUS.indexOf(c);
      if (idx > atual) novoStatus = c;
    }
    // Desfecho terminal de crédito recusado quando não houve avanço no funil.
    if (!novoStatus && statusBancos === "credito_recusado" && prop.status !== "credito_recusado") {
      novoStatus = "credito_recusado";
    }
  }

  const patch: Record<string, unknown> = { detalhe_status_atual: nomeEtapa };
  const escolhida = simEscolhida ?? {};
  if (op?.codigoOportunidadeBanco || escolhida.codigoOportunidadeBanco)
    patch.codigo_oportunidade_homefin =
      op?.codigoOportunidadeBanco ?? escolhida.codigoOportunidadeBanco;
  const vFin = op?.valorFinanciamentoBanco ?? escolhida.valorFinanciamentoBanco;
  const vParc = op?.valorParcelaBanco ?? escolhida.valorParcelaBanco;
  const vPrazo = op?.prazoPagamentoBanco ?? escolhida.prazoPagamentoBanco;
  const vTaxa = op?.taxaJurosAnoBanco ?? escolhida.taxaJurosAnoBanco;
  if (vFin != null) patch.valor_financiamento_aprovado = vFin;
  if (vParc != null) patch.valor_parcela_aprovado = vParc;
  if (vPrazo != null) patch.prazo_aprovado = vPrazo;
  if (vTaxa != null) patch.taxa_juros_ano_aprovado = vTaxa;

  const mudouStatus = novoStatus != null && novoStatus !== prop.status;
  if (mudouStatus) {
    patch.status = novoStatus;
    if (novoStatus === "contrato_emitido") patch.contrato_emitido_em = new Date().toISOString();
    if (
      errosBanco.length > 0 &&
      (novoStatus === "erro_envio" || novoStatus === "credito_recusado")
    ) {
      patch.ultimo_erro = errosBanco.join(" | ");
    }
  }

  await supabase
    .from("propostas")
    .update(patch as any)
    .eq("id", propostaId);

  if (mudouStatus) {
    await supabase.from("proposta_historico").insert({
      proposta_id: propostaId,
      tipo_evento: "sincronizacao",
      descricao: nomeEtapa
        ? `Atualização do banco: ${nomeEtapa}`
        : "Situação atualizada pelo banco",
      status_anterior: prop.status as any,
      status_novo: novoStatus as any,
      ator_id: userId,
    });
    if (prop.usuario_responsavel_id) {
      await supabase.from("notificacoes").insert({
        user_id: prop.usuario_responsavel_id,
        correspondente_id: prop.correspondente_id,
        tipo: "proposta",
        titulo: "Atualização de proposta",
        corpo:
          errosBanco.length > 0
            ? errosBanco.join(" | ")
            : nomeEtapa
              ? `Nova situação: ${nomeEtapa}.`
              : `Status alterado para ${novoStatus}.`,
        link: `/operacional/propostas/${propostaId}`,
      } as any);
    }
  }

  return { status: novoStatus ?? prop.status, etapa: nomeEtapa, atualizado: mudouStatus };
}
