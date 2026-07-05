/**
 * Envio de proposta à integração bancária (server-only).
 * Reutiliza o cliente da Etapa 04. Marca branca: nenhum texto ao usuário
 * cita o fornecedor.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { chamarIntegracao, IntegracaoBancariaError, sanitizarMensagemErro } from "@/lib/simulacao/homefin.server";
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
  if (n.includes("engenharia") || n.includes("vistoria") || n.includes("avaliaç")) return "engenharia_vistoria";
  if (n.includes("document")) return "aguardando_documentos";
  if (n.includes("aprov")) return "credito_aprovado";
  if (n.includes("análise") || n.includes("analise") || n.includes("crédito") || n.includes("credito")) return "em_analise_credito";
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
  bancos: { banco_id: string | null; nome_banco: string | null; status: string; mensagem?: string }[];
}

export async function enviarPropostaImpl({
  propostaId,
  userId,
  ip,
  supabase,
  bancoId,
}: EnviarArgs): Promise<EnviarResultado> {
  const { data: prop, error } = await supabase.from("propostas").select("*").eq("id", propostaId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!prop) throw new Error("Proposta não encontrada.");

  if (!prop.homefin_id_oportunidade) {
    throw new Error("Proposta sem oportunidade vinculada. Origine a partir de uma simulação enviada ao banco.");
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
    throw new Error(`Existem ${bloqueantes.length} documento(s) obrigatório(s) pendente(s) ou reprovado(s).`);
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
      .update({ status: "enviada_banco", enviada_em: new Date().toISOString(), ip_consentimento: ip, ultimo_erro: null })
      .eq("id", propostaId);
  }

  const ctx = { simulacao_id: prop.simulacao_id, proposta_id: propostaId, correspondente_id: prop.correspondente_id };
  const resultados: EnviarResultado["bancos"] = [];
  let sucesso = 0;

  for (const b of bancos as any[]) {
    try {
      await chamarIntegracao<any>(
        `/oportunidade/${prop.homefin_id_oportunidade}/incluir-proposta-integracao`,
        "POST",
        { idSimulacao: b.homefin_id_simulacao_banco ?? prop.homefin_id_simulacao },
        ctx,
      );
      await supabase.from("proposta_bancos").update({ status_banco: "enviada", selecionado: true, mensagem_banco: null }).eq("id", b.id);
      sucesso++;
      resultados.push({ banco_id: b.banco_id, nome_banco: b.nome_banco, status: "enviada" });
    } catch (e) {
      const msg = sanitizarMensagemErro(e instanceof IntegracaoBancariaError ? e.message : "Falha ao enviar ao banco.");
      await supabase.from("proposta_bancos").update({ status_banco: "erro", mensagem_banco: msg }).eq("id", b.id);
      resultados.push({ banco_id: b.banco_id, nome_banco: b.nome_banco, status: "erro", mensagem: msg });
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
    { simulacao_id: prop.simulacao_id, proposta_id: propostaId, correspondente_id: prop.correspondente_id },
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
    { simulacao_id: prop.simulacao_id, proposta_id: propostaId, correspondente_id: prop.correspondente_id },
  );
}

/**
 * Sincroniza o andamento da proposta consultando a integração bancária.
 * A API é baseada em consulta (polling): não há webhook/callback. Este
 * handler lê GET /oportunidade/{id} e atualiza status, valores aprovados,
 * histórico e notificação a partir de `tipoSituacao` (A/T/C) e da etapa ativa.
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
  const { data: prop, error } = await supabase.from("propostas").select("*").eq("id", propostaId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!prop) throw new Error("Proposta não encontrada.");
  if (!prop.homefin_id_oportunidade) {
    throw new Error("Proposta ainda não foi enviada ao banco.");
  }

  const ctx = { simulacao_id: prop.simulacao_id, proposta_id: propostaId, correspondente_id: prop.correspondente_id };
  const resp = await chamarIntegracao<any>(
    `/oportunidade/${prop.homefin_id_oportunidade}`,
    "GET",
    undefined,
    ctx,
  );
  const op = resp?.oportunidade ?? resp ?? {};
  const etapas: any[] = Array.isArray(resp?.etapa) ? resp.etapa : [];

  // etapa ativa (não concluída) de maior ordem, senão a última concluída
  const ativa = etapas
    .filter((e) => e?.active && !e?.completed)
    .sort((a, b) => (b?.ordemEtapa ?? 0) - (a?.ordemEtapa ?? 0))[0];
  const ultimaConcluida = etapas
    .filter((e) => e?.completed)
    .sort((a, b) => (b?.ordemEtapa ?? 0) - (a?.ordemEtapa ?? 0))[0];
  const nomeEtapa: string | null = (ativa?.nomeEtapa ?? ultimaConcluida?.nomeEtapa ?? null) || null;

  // tipoSituacao: A (Ativa) / T (Contrato Emitido) / C (Cancelada)
  const situacao = String(op?.tipoSituacao ?? "").toUpperCase().charAt(0);
  let novoStatus: string | null = null;
  if (situacao === "T") novoStatus = "contrato_emitido";
  else if (situacao === "C") novoStatus = "cancelada";
  else {
    // Situação ativa: avança o estado interno conforme a etapa do banco,
    // apenas para frente (nunca regride o funil).
    const derivado = statusDaEtapa(nomeEtapa);
    if (derivado) {
      const atual = ORDEM_STATUS.indexOf(prop.status as PropostaStatus);
      const alvo = ORDEM_STATUS.indexOf(derivado);
      if (alvo > atual && atual !== -1) novoStatus = derivado;
    }
  }

  const patch: Record<string, unknown> = { detalhe_status_atual: nomeEtapa };
  if (op?.codigoOportunidadeBanco) patch.codigo_oportunidade_homefin = op.codigoOportunidadeBanco;
  if (op?.valorFinanciamentoBanco != null) patch.valor_financiamento_aprovado = op.valorFinanciamentoBanco;
  if (op?.valorParcelaBanco != null) patch.valor_parcela_aprovado = op.valorParcelaBanco;
  if (op?.prazoPagamentoBanco != null) patch.prazo_aprovado = op.prazoPagamentoBanco;
  if (op?.taxaJurosAnoBanco != null) patch.taxa_juros_ano_aprovado = op.taxaJurosAnoBanco;

  const mudouStatus = novoStatus != null && novoStatus !== prop.status;
  if (mudouStatus) {
    patch.status = novoStatus;
    if (novoStatus === "contrato_emitido") patch.contrato_emitido_em = new Date().toISOString();
  }

  await supabase.from("propostas").update(patch as any).eq("id", propostaId);

  if (mudouStatus) {
    await supabase.from("proposta_historico").insert({
      proposta_id: propostaId,
      tipo_evento: "sincronizacao",
      descricao: nomeEtapa ? `Atualização do banco: ${nomeEtapa}` : "Situação atualizada pelo banco",
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
        corpo: nomeEtapa ? `Nova situação: ${nomeEtapa}.` : `Status alterado para ${novoStatus}.`,
        link: `/operacional/propostas/${propostaId}`,
      } as any);
    }
  }

  return { status: novoStatus ?? prop.status, etapa: nomeEtapa, atualizado: mudouStatus };
}
