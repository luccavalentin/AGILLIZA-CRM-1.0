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
  "checklist_documentacao",
  "cadastro_complementar",
  "dossie_completo",
  "formularios",
  "envio_documentos_banco",
  "vistoria_agendamento",
  "vistoria_concluida",
  "emissao_contrato",
  "contrato_emitido",
];

/** Deriva o status interno a partir do nome da etapa ativa retornada pelo banco. */
function statusDaEtapa(nomeEtapa: string | null): PropostaStatus | null {
  if (!nomeEtapa) return null;
  const n = nomeEtapa.toLowerCase();
  if (n.includes("contrato") || n.includes("registr")) return "contrato_emitido";
  if (n.includes("emiss")) return "emissao_contrato";
  if (n.includes("vistoria") || n.includes("engenharia") || n.includes("avaliaç"))
    return "vistoria_agendamento";
  if (n.includes("document")) return "envio_documentos_banco";
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
    numero_proposta_banco?: string | null;
    mensagem?: string;
  }[];
}

function soDigitos(v: unknown): string | undefined {
  const s = String(v ?? "").replace(/\D/g, "");
  return s.length ? s : undefined;
}

/**
 * Um envolvido tem o cadastro complementar completo (obrigatório para enviar
 * a proposta ao banco). Espelha a validação do formulário no front-end.
 */
function envolvidoEnvioCompleto(e: any): boolean {
  const base =
    e.nome &&
    e.cpf_cnpj &&
    e.tipo_documento_identidade &&
    e.numero_documento &&
    e.orgao_expedidor &&
    e.uf_expedicao &&
    e.profissao &&
    e.renda &&
    e.email &&
    e.celular &&
    e.cep &&
    e.logradouro &&
    e.numero_logradouro &&
    e.bairro &&
    e.municipio &&
    e.uf &&
    e.fg_autorizacao_dados;
  const pf = (e.tipo_pessoa ?? "F") === "F";
  const pessoais = !pf || (e.data_nascimento && e.nome_mae && e.tipo_sexo && e.estado_civil);
  return Boolean(base && pessoais);
}



/**
 * Garante que o(s) participante(s) da oportunidade tenham os dados obrigatórios
 * exigidos pelos bancos (estado civil / maritalStatus, endereço com UF, data de
 * nascimento e renda). Vários bancos (ex.: Itaú) recusam a proposta quando
 * `maritalStatus` ou `address.state` chegam nulos. A oportunidade cria o
 * proponente principal com dados mínimos; aqui completamos a partir dos
 * envolvidos da proposta, do próprio cadastro do cliente e, por fim, do imóvel.
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
    // Sem a lista de participantes não há como completar os dados; segue o envio.
    return;
  }
  if (participantes.length === 0) return;

  const { data: envolvidos } = await supabase
    .from("proposta_envolvidos")
    .select("*")
    .eq("proposta_id", prop.id);

  // Cadastro do cliente principal (fallback quando a proposta não tem envolvidos).
  let cliente: any = null;
  if (prop.cliente_id) {
    const { data } = await supabase
      .from("clientes")
      .select("*")
      .eq("id", prop.cliente_id)
      .maybeSingle();
    cliente = data;
  }

  for (const part of participantes) {
    const cpf = soDigitos(part?.cpfCnpj);
    const env = (envolvidos ?? []).find((e: any) => soDigitos(e.cpf_cnpj) === cpf);

    // Fontes de dados em ordem de prioridade: participante da API > envolvido >
    // cadastro do cliente (só para o proponente principal) > proposta/imóvel.
    const ehPrincipal = soDigitos(prop.cpf_cnpj) === cpf;
    const src = ehPrincipal ? cliente : null;

    const estadoCivil =
      part?.tipoEstadoCivil || env?.estado_civil || src?.estado_civil || prop.estado_civil || null;
    const uf = part?.uf || env?.uf || src?.uf || prop.uf || null;
    // Profissão e empresa: o Itaú (entre outros) recusa a proposta quando
    // `profession`/`company` do proponente chegam nulos. Completamos a partir do
    // envolvido, do cadastro do cliente e, por fim, de um valor padrão seguro.
    const profissao =
      part?.nomeProfissao || env?.profissao || src?.profissao || "Não informado";
    const empresa =
      part?.nomeEmpresaProfissao || env?.empresa || src?.empresa || "Não informado";

    // Chamamos a API quando falta estado civil, UF, profissão ou empresa (os
    // campos que mais derrubam a validação dos bancos). Se todos já estão
    // presentes no participante, nada a fazer.
    const faltaEstadoCivil = !(part?.tipoEstadoCivil && String(part.tipoEstadoCivil).trim());
    const faltaUf = !(part?.uf && String(part.uf).trim());
    const faltaProfissao = !(part?.nomeProfissao && String(part.nomeProfissao).trim());
    const faltaEmpresa = !(part?.nomeEmpresaProfissao && String(part.nomeEmpresaProfissao).trim());
    // Quando temos um envolvido cadastrado no sistema, sempre sincronizamos os
    // dados complementares (documento, sexo, FGTS, endereço) com o banco.
    const temEnvolvido = Boolean(env);
    if (!temEnvolvido && !faltaEstadoCivil && !faltaUf && !faltaProfissao && !faltaEmpresa) continue;
    // Sem meios de preencher estado civil ou UF, não adianta chamar a API —
    // profissão/empresa sempre têm fallback, então não bloqueiam.
    if (faltaEstadoCivil && !estadoCivil && faltaUf && !uf && !faltaProfissao && !faltaEmpresa)
      continue;

    const payload: Record<string, unknown> = {
      tipoSituacao: part?.tipoSituacao ?? "A",
      nomeParticipante: part?.nomeParticipante ?? env?.nome ?? prop.nome_cliente,
      tipoQualificacao: part?.tipoQualificacao ?? "CO",
      tipoPessoa: part?.tipoPessoa ?? ((cpf?.length ?? 0) > 11 ? "J" : "F"),
      cpfCnpj: cpf,
      dataNascimento:
        part?.dataNascimento ?? env?.data_nascimento ?? src?.data_nascimento ?? prop.data_nascimento ?? undefined,
      tipoEstadoCivil: estadoCivil ?? undefined,
      tipoRegimeCasamento: part?.tipoRegimeCasamento ?? env?.regime_casamento ?? undefined,
      tipoSexo: part?.tipoSexo ?? env?.tipo_sexo ?? undefined,
      tipoDocumentoIdentidade:
        part?.tipoDocumentoIdentidade ?? env?.tipo_documento_identidade ?? undefined,
      numeroDocumento: part?.numeroDocumento ?? env?.numero_documento ?? undefined,
      orgaoExpedidor: part?.orgaoExpedidor ?? env?.orgao_expedidor ?? undefined,
      ufExpedicao: part?.ufExpedicao ?? env?.uf_expedicao ?? undefined,
      dataExpedicao: part?.dataExpedicao ?? env?.data_expedicao ?? undefined,
      nomeProfissao: profissao,
      nomeEmpresaProfissao: empresa,
      nomeMae: part?.nomeMae ?? env?.nome_mae ?? src?.mae ?? undefined,
      renda: part?.renda ?? env?.renda ?? src?.renda_total_declarada ?? prop.renda_total ?? undefined,
      email: part?.email ?? env?.email ?? src?.email ?? prop.email ?? undefined,
      celular: part?.celular ?? soDigitos(env?.celular ?? src?.celular) ?? undefined,
      utilizaFgts: part?.utilizaFgts ?? Boolean(env?.utiliza_fgts) ?? undefined,
      fgAutorizacaoDados: env?.fg_autorizacao_dados ?? true,
      cep: soDigitos(env?.cep ?? prop.cep_imovel),
      logradouro: env?.logradouro ?? prop.endereco_imovel ?? undefined,
      numeroLogradouro: env?.numero_logradouro ?? undefined,
      complementoLogradouro: env?.complemento ?? undefined,
      bairro: env?.bairro ?? prop.bairro_imovel ?? undefined,
      municipio: env?.municipio ?? prop.cidade_imovel ?? undefined,
      uf: uf ?? undefined,
    };


    try {
      await chamarIntegracao<any>(
        `/oportunidade/${idOportunidade}/participante/${part.idParticipante}`,
        "PUT",
        payload,
        ctx,
      );
    } catch {
      // Falha ao completar os dados não deve abortar o envio dos demais bancos.
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

  // Cadastro complementar obrigatório: todos os compradores/coproponentes
  // (CO/TI) precisam estar com os dados completos antes de enviar ao banco.
  const { data: compradores } = await supabase
    .from("proposta_envolvidos")
    .select("*")
    .eq("proposta_id", propostaId)
    .in("tipo_qualificacao", ["CO", "TI"]);
  if (!compradores || compradores.length === 0) {
    throw new Error(
      "Preencha o cadastro complementar do comprador antes de enviar a proposta ao banco.",
    );
  }
  const incompletos = compradores.filter((e: any) => !envolvidoEnvioCompleto(e));
  if (incompletos.length > 0) {
    const nomes = incompletos.map((e: any) => e.nome || "sem nome").join(", ");
    throw new Error(
      `Cadastro complementar incompleto para: ${nomes}. Preencha todos os dados obrigatórios antes de enviar.`,
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
  const bancos = (bancosSel ?? []).filter((b: any) => !bancoJaEnviado(b));
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

  // Envia a proposta para TODOS os bancos selecionados de forma SIMULTÂNEA.
  // Cada banco tem seu próprio try/catch: a falha de um (ex.: Itaú recusando
  // por validação) não impede nem atrasa o envio dos demais (ex.: Bradesco).
  const enviarBancoIntegracao = async (b: any): Promise<EnviarResultado["bancos"][number]> => {
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

      // Grava o RETORNO real do banco (taxa, parcela, financiamento, situação e
      // protocolo) em vez de apenas marcar "enviada". Assim o usuário vê o
      // desfecho imediato da comunicação com o banco.
      const situacaoTipo = String(resp?.tipoSituacao ?? "").trim();
      const mapa = statusInternoBanco(situacaoTipo, false, resp?.codigoSituacaoBanco);
      const patchOk: Record<string, unknown> = {
        status_banco: mapa.banco || "enviada",
        selecionado: true,
        mensagem_banco: null,
        raw_response: resp,
      };
      // situacao_banco é um enum interno (nao_enviado/em_analise/condicionado/
      // aprovado/recusado/cancelado). O tipoSituacao do banco vem como código
      // cru (S/P/N/A/R) — precisa ser mapeado, senão o valor não bate com o
      // <Select> da tela e a linha continua exibindo "Não enviado".
      patchOk.situacao_banco = situacaoBancoDeTipo(
        situacaoTipo,
        resp?.codigoSituacaoBanco,
        false,
      );
      const protocolo =
        resp?.codigoOportunidadeBanco ??
        resp?.codigoOportunidadeBancoInterno ??
        resp?.codigoSimulacaoBanco ??
        null;
      if (protocolo) patchOk.numero_proposta_banco = String(protocolo);
      if (resp?.valorParcelaBanco != null) patchOk.valor_parcela = resp.valorParcelaBanco;
      if (resp?.taxaJurosAnoBanco != null) patchOk.taxa_juros_ano = resp.taxaJurosAnoBanco;
      if (resp?.prazoPagamentoBancoMax != null)
        patchOk.prazo_pagamento_max = resp.prazoPagamentoBancoMax;
      if (resp?.valorFinanciamentoBanco != null || resp?.valorFinanciamentoBancoMax != null)
        patchOk.valor_financiamento_max =
          resp.valorFinanciamentoBanco ?? resp.valorFinanciamentoBancoMax;
      if (resp?.valorIofBanco != null) patchOk.valor_iof = resp.valorIofBanco;
      if (resp?.codigoSistemaAmortizacaoBanco)
        patchOk.sistema_amortizacao_banco = resp.codigoSistemaAmortizacaoBanco;
      if (resp?.codigoIndexadorBanco) patchOk.codigo_indexador = resp.codigoIndexadorBanco;

      const { error: upErr } = await supabase
        .from("proposta_bancos")
        .update(patchOk as any)
        .eq("id", b.id);
      if (upErr) {
        // O banco aceitou a proposta, mas não conseguimos registrar o retorno.
        // Logamos para não perder o rastro — o polling reconcilia em seguida.
        console.error("[proposta] falha ao gravar retorno do banco", upErr.message);
      }
      if (protocolo) {
        await supabase
          .from("propostas")
          .update({ numero_proposta_banco: String(protocolo) } as any)
          .eq("id", propostaId);
      }
      return {
        banco_id: b.banco_id,
        nome_banco: b.nome_banco,
        status: String(patchOk.status_banco),
        numero_proposta_banco: protocolo ? String(protocolo) : null,
      };
    } catch (e) {
      const msg = sanitizarMensagemErro(
        e instanceof IntegracaoBancariaError ? e.message : "Falha ao enviar ao banco.",
      );
      await supabase
        .from("proposta_bancos")
        .update({ status_banco: "erro", mensagem_banco: msg })
        .eq("id", b.id);
      return {
        banco_id: b.banco_id,
        nome_banco: b.nome_banco,
        status: "erro",
        mensagem: msg,
      };
    }
  };

  const enviados = await Promise.all((bancos as any[]).map(enviarBancoIntegracao));
  for (const r of enviados) {
    resultados.push(r);
    if (r.status !== "erro") sucesso++;
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

  // Logo após enviar, consulta a oportunidade algumas vezes em curto intervalo.
  // Alguns bancos aceitam a inclusão primeiro e só gravam o número/status da
  // proposta alguns segundos depois; essa reconciliação curta evita que a tela
  // fique parada em "em análise" até o próximo agendamento.
  if (sucesso > 0) {
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      try {
        if (tentativa > 0) await new Promise((resolve) => setTimeout(resolve, 2_500));
        const sinc = await sincronizarPropostaImpl({ propostaId, userId, supabase });
        if (sinc?.status) novoStatus = sinc.status as PropostaStatus;
        if (!["enviada_banco", "em_analise_credito"].includes(String(sinc?.status ?? ""))) {
          break;
        }
      } catch (e) {
        console.error("[proposta] sincronização pós-envio falhou", e);
        break;
      }
    }
  }

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
  const direto = obj?.message ?? obj?.erro ?? obj?.error_description ?? null;
  if (direto) return String(direto);
  const error = obj?.error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    if (error.message) return String(error.message);
    if (Array.isArray(error.fields) && error.fields.length > 0) {
      return error.fields.map((f: any) => f?.message).filter(Boolean).join("; ") || null;
    }
  }
  return null;
}

/** Traduz o tipoSituacao da proposta (por banco) para status interno do banco. */
function statusInternoBanco(
  tipo: string,
  temErro: boolean,
  codigoSituacaoBanco?: string | null,
): {
  banco: string;
  proposta: PropostaStatus | "credito_recusado" | null;
} {
  if (temErro) return { banco: "erro", proposta: null };

  const codigo = normalizarTexto(codigoSituacaoBanco);
  const codigoNumerico = String(codigoSituacaoBanco ?? "").replace(/\D/g, "");
  if (
    codigo.includes("desfavoravel") ||
    codigo.includes("nao favoravel") ||
    codigo.includes("nao aprovado") ||
    codigo.includes("recus") ||
    codigo.includes("reprov") ||
    codigo.includes("negad") ||
    codigo.includes("indefer") ||
    codigo.includes("rejeit") ||
    codigoNumerico === "514"
  ) {
    return { banco: "recusada", proposta: "credito_recusado" };
  }
  if (codigo.includes("cond")) return { banco: "condicionado", proposta: "credito_aprovado" };
  if (codigo.includes("aprov") || codigo.includes("favoravel")) {
    return { banco: "aprovada", proposta: "credito_aprovado" };
  }
  const t = String(tipo ?? "")
    .toUpperCase()
    .charAt(0);
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

function normalizarTexto(v: unknown): string {
  return String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Traduz o `tipoSituacao` cru do banco (S/P/N/A/R) para o enum interno usado
 * na coluna `proposta_bancos.situacao_banco` e no <Select> "Situação de crédito"
 * (nao_enviado/em_analise/condicionado/aprovado/recusado/cancelado).
 */
function situacaoBancoDeTipo(
  tipo: string,
  codigoSituacaoBanco?: string | null,
  temErro = false,
): string {
  const mapa = statusInternoBanco(tipo, temErro, codigoSituacaoBanco);
  if (mapa.banco === "aprovada" || mapa.banco === "aprovado") return "aprovado";
  if (mapa.banco === "recusada" || mapa.banco === "recusado") return "recusado";
  if (mapa.banco === "condicionado") return "condicionado";
  if (mapa.banco === "em_analise" || mapa.banco === "enviada") return "em_analise";
  return "nao_enviado";
}

/**
 * Um banco já foi incluído no banco (não deve ser reenviado) quando já tem
 * protocolo (numero_proposta_banco) ou um status_banco que indica proposta
 * ativa na integração. Só `nao_enviado`/`aguardando`/`erro`/vazio podem enviar.
 */
const STATUS_BANCO_JA_ENVIADO = new Set([
  "enviada",
  "em_analise",
  "condicionado",
  "aprovada",
  "aprovado",
  "recusada",
  "recusado",
]);

export function bancoJaEnviado(b: {
  status_banco?: string | null;
  numero_proposta_banco?: string | null;
}): boolean {
  return (
    Boolean(b.numero_proposta_banco) ||
    STATUS_BANCO_JA_ENVIADO.has(String(b.status_banco ?? ""))
  );
}

function codigoBancoDe(v: any): string | null {
  const raw = v?.codigo_banco ?? v?.codigoBanco ?? v?.banco?.codigoBanco ?? null;
  if (raw == null || raw === "") return null;
  return String(raw);
}

function nomeBancoNormalizado(v: unknown): string {
  return String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\bbanco\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function mesmoBanco(pb: any, sim: any): boolean {
  const codigoPb = codigoBancoDe(pb);
  const codigoSim = codigoBancoDe(sim);
  if (codigoPb && codigoSim && codigoPb === codigoSim) return true;
  const nomePb = nomeBancoNormalizado(pb?.nome_banco);
  const nomeSim = nomeBancoNormalizado(sim?.nome_banco ?? sim?.nomeBanco ?? sim?.banco?.nomeBanco);
  return Boolean(nomePb && nomeSim && (nomePb.includes(nomeSim) || nomeSim.includes(nomePb)));
}

function protocoloBanco(sim: any): string | null {
  const proto =
    sim?.codigoOportunidadeBanco ??
    sim?.codigoOportunidadeBancoInterno ??
    sim?.codigoSimulacaoBanco ??
    sim?.numeroPropostaBanco ??
    sim?.numeroProposta ??
    sim?.proposalNumber ??
    null;
  return proto == null || proto === "" ? null : String(proto);
}

function prioridadeSimulacao(sim: any, exata: boolean): number {
  const erroMsg = extrairErroRetorno(sim?.retornoIntegracao ?? sim?.descricaoRespostaBanco?.retornoIntegracao);
  const mapa = statusInternoBanco(sim?.tipoSituacao, Boolean(erroMsg), sim?.codigoSituacaoBanco);
  const statusScore =
    mapa.proposta === "credito_aprovado"
      ? 80
      : mapa.proposta === "credito_recusado"
        ? 75
        : mapa.proposta === "em_analise_credito"
          ? 60
          : mapa.banco === "erro"
            ? 10
            : 30;
  const protocoloScore = protocoloBanco(sim) ? 12 : 0;
  const retornoScore = sim?.dataHoraRetornoIntegracao ? 4 : 0;
  return (exata ? 100 : 0) + statusScore + protocoloScore + retornoScore;
}

function escolherSimulacaoBanco(pb: any, simulacoes: any[]): any | null {
  const idPb = String(pb?.homefin_id_simulacao_banco ?? "");
  const candidatas = simulacoes
    .map((sim) => ({
      sim,
      exata: idPb.length > 0 && String(sim?.idSimulacao) === idPb,
    }))
    .filter(({ sim, exata }) => exata || mesmoBanco(pb, sim));
  if (!candidatas.length) return null;
  return candidatas
    .sort((a, b) => prioridadeSimulacao(b.sim, b.exata) - prioridadeSimulacao(a.sim, a.exata))[0]
    .sim;
}

function statusDaAtividade(atividades: any[]): { status: PropostaStatus | null; detalhe: string | null } {
  const ativas = atividades
    .filter((a) => String(a?.tipoSituacao ?? "").toUpperCase() !== "N")
    .sort((a, b) => {
      const etapaA = Number(a?.etapa?.ordemEtapa ?? a?.idEtapa ?? 0);
      const etapaB = Number(b?.etapa?.ordemEtapa ?? b?.idEtapa ?? 0);
      const ordemA = Number(a?.atividade?.ordemAtividade ?? a?.idAtividade ?? 0);
      const ordemB = Number(b?.atividade?.ordemAtividade ?? b?.idAtividade ?? 0);
      return etapaB - etapaA || ordemB - ordemA;
    });
  for (const a of ativas) {
    const nome = String(a?.atividade?.nomeAtividade ?? a?.nomeAtividade ?? "");
    const n = nomeBancoNormalizado(nome);
    if (n.includes("credito nao aprovado") || n.includes("credito reprov") || n.includes("recus")) {
      return { status: "credito_recusado", detalhe: nome || null };
    }
    if (n.includes("credito aprovado") || n.includes("aprovado")) {
      return { status: "credito_aprovado", detalhe: nome || null };
    }
    if (n.includes("condicionado")) return { status: "credito_aprovado", detalhe: nome || null };
    if (n.includes("analise de credito") || n.includes("credito")) {
      return { status: "em_analise_credito", detalhe: nome || null };
    }
  }
  return { status: null, detalhe: null };
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
  const atividades: any[] = Array.isArray(op?.atividadesOportunidade)
    ? op.atividadesOportunidade
    : [];

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
  let numeroPropostaBanco: string | null = null;

  for (const pb of (bancosProp ?? []) as any[]) {
    const sim = escolherSimulacaoBanco(pb, simulacoes);
    if (!sim) continue;

    const erroMsg = extrairErroRetorno(
      sim.retornoIntegracao ?? sim.descricaoRespostaBanco?.retornoIntegracao,
    );
    const mapa = statusInternoBanco(sim.tipoSituacao, Boolean(erroMsg), sim.codigoSituacaoBanco);

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
      situacao_banco: situacaoBancoDeTipo(
        sim.tipoSituacao,
        sim.codigoSituacaoBanco,
        Boolean(erroMsg),
      ),
      mensagem_banco: erroMsg ? sanitizarMensagemErro(erroMsg) : null,
      raw_response: sim,
    };
    // Mantém o protocolo do banco na linha (usado para saber que já foi enviada).
    const protoSim = protocoloBanco(sim);
    if (protoSim) {
      patchBanco.numero_proposta_banco = protoSim;
      if (!numeroPropostaBanco || sim.bancoEscolhido === "S" || mapa.proposta === "credito_aprovado") {
        numeroPropostaBanco = protoSim;
      }
    }
    if (sim.valorParcelaBanco != null) patchBanco.valor_parcela = sim.valorParcelaBanco;
    if (sim.taxaJurosAnoBanco != null) patchBanco.taxa_juros_ano = sim.taxaJurosAnoBanco;
    if (sim.prazoPagamentoBanco != null || sim.prazoPagamentoBancoMax != null)
      patchBanco.prazo_pagamento_max = sim.prazoPagamentoBanco ?? sim.prazoPagamentoBancoMax;
    if (sim.valorFinanciamentoBanco != null || sim.valorFinanciamentoBancoMax != null)
      patchBanco.valor_financiamento_max =
        sim.valorFinanciamentoBanco ?? sim.valorFinanciamentoBancoMax;
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
  const statusAtividade = statusDaAtividade(atividades);

  // ---- Decisão final ----
  let novoStatus: string | null = null;
  if (situacao === "T") {
    novoStatus = "contrato_emitido";
  } else if (situacao === "C") {
    novoStatus = "cancelada";
  } else {
    // Avança apenas para frente no funil (nunca regride).
    const atual = ORDEM_STATUS.indexOf(prop.status as PropostaStatus);
    const candidatos = [statusBancos, statusAtividade.status, statusEtapa].filter(
      Boolean,
    ) as PropostaStatus[];
    for (const c of candidatos) {
      const idx = ORDEM_STATUS.indexOf(c);
      if (idx > atual) novoStatus = c;
    }
    // Desfecho terminal de crédito recusado quando não houve avanço no funil.
    if (!novoStatus && statusBancos === "credito_recusado" && prop.status !== "credito_recusado") {
      novoStatus = "credito_recusado";
    }
  }

  const patch: Record<string, unknown> = { detalhe_status_atual: statusAtividade.detalhe ?? nomeEtapa };
  const escolhida = simEscolhida ?? {};
  if (numeroPropostaBanco) patch.numero_proposta_banco = numeroPropostaBanco;
  if (op?.codigoOportunidadeBanco || escolhida.codigoOportunidadeBanco || numeroPropostaBanco)
    patch.codigo_oportunidade_homefin =
      op?.codigoOportunidadeBanco ?? escolhida.codigoOportunidadeBanco ?? numeroPropostaBanco;
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
