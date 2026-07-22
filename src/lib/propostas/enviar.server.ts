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

import {
  statusDaEtapa,
  ehFalhaIntegracaoBanco,
  MSG_FALHA_INTEGRACAO,
  extrairErroRetorno,
  statusInternoBanco,
  situacaoBancoDeTipo,
  bancoJaEnviado,
  numeroPropostaBancoReal,
  referenciaIntegracaoBanco,
  numeroBancoDaOportunidade,
  numeroAtualEhReferenciaTecnica,
  escolherSimulacaoBanco,
  statusDaAtividade,
} from "./enviar/helpers-retorno.server";
import { normalizarTexto } from "./enviar/shared-utils";

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
];

// statusDaEtapa foi extraído para ./enviar/helpers-retorno.server.ts

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

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Remove máscara/pontuação de números de documento (RG/CNH/RNE...) antes de
 * enviar ao banco. O Bradesco em particular rejeita silenciosamente valores
 * com pontos/hífens (ex.: "333.312.398-36"): precisa ir só com caracteres
 * alfanuméricos. Preservamos letras porque alguns tipos (ex.: RNE) as usam.
 */
function sanitizarNumeroDocumento(v: unknown): string | undefined {
  const s = String(v ?? "").replace(/[^0-9A-Za-z]/g, "").trim();
  return s.length ? s : undefined;
}

function enumBancoId(v: unknown): string | undefined {
  if (v == null || v === "") return undefined;
  if (typeof v === "object" && "id" in (v as Record<string, unknown>)) {
    return enumBancoId((v as Record<string, unknown>).id);
  }
  const s = String(v).trim();
  return s.length ? s : undefined;
}

function estadoCivilBanco(v: unknown): string | undefined {
  const raw = enumBancoId(v);
  if (!raw) return undefined;
  const upper = raw.toUpperCase();
  if (["CA", "S", "VI", "DI", "SL", "UE"].includes(upper)) return upper;
  const n = normalizarTexto(raw);
  if (n.includes("uniao") || n.includes("uniao estavel")) return "UE";
  if (n.includes("casad")) return "CA";
  if (n.includes("solteir")) return "S";
  if (n.includes("divorci")) return "DI";
  if (n.includes("viuv")) return "VI";
  if (n.includes("separ")) return "SL";
  return upper;
}

function exigeConjugePorEstadoCivil(v: unknown): boolean {
  const ec = estadoCivilBanco(v);
  return ec === "CA" || ec === "UE";
}

// ehFalhaIntegracaoBanco / MSG_FALHA_INTEGRACAO foram extraídos para
// ./enviar/helpers-retorno.server.ts e são re-exportados no fim do arquivo.

/**
 * Normaliza textos livres antes de enviar ao banco. O usuário pode preencher
 * livremente, mas alguns bancos recusam caracteres como parênteses em campos
 * de ocupação (ex.: "Administrador(a)").
 */
function textoLivreParaBanco(v: unknown): string | undefined {
  const s = String(v ?? "")
    .replace(/\((?:a|o)\)/gi, "")
    .replace(/[(){}[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s || undefined;
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
 * Verifica no provedor se a simulação vinculada ao banco ainda pode ser usada
 * na inclusão da proposta. Simulações com tipoSituacao "R" (recusada) ou "A"
 * (aprovada) já foram consumidas — o provedor não permite reprocessá-las.
 * Nesses casos criamos uma NOVA simulação com os mesmos parâmetros e passamos
 * a apontar `proposta_bancos.homefin_id_simulacao_banco` para ela.
 * Retorna o `idSimulacao` (numérico) a ser usado no envio ao banco.
 */
async function renovarSimulacaoSeConsumida({
  idOportunidade,
  prop,
  pb,
  propostaId,
  ctx,
  supabase,
}: {
  idOportunidade: string;
  prop: any;
  pb: any;
  propostaId: string;
  ctx: { simulacao_id: any; proposta_id: string; correspondente_id: any };
  supabase: SupabaseClient<any, any, any>;
}): Promise<number> {
  const idAtual = pb.homefin_id_simulacao_banco;
  if (!idAtual) {
    throw new Error(
      `Banco ${pb.nome_banco ?? ""} não tem simulação vinculada. Refaça a simulação antes de enviar.`,
    );
  }
  let sim: any = null;
  try {
    const resp = await chamarIntegracao<any>(
      `/oportunidade/${idOportunidade}`,
      "GET",
      undefined,
      ctx,
    );
    const op = resp?.oportunidade ?? resp ?? {};
    const simulacoes: any[] = Array.isArray(op?.simulacoes) ? op.simulacoes : [];
    sim = simulacoes.find((s) => String(s?.idSimulacao) === String(idAtual)) ?? null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Não foi possível confirmar a simulação do ${pb.nome_banco ?? "banco"} antes do envio: ${sanitizarMensagemErro(msg)}`,
    );
  }
  if (!sim) return Number(idAtual);
  const tipo = String(sim?.tipoSituacao ?? "").toUpperCase().charAt(0);
  if (tipo !== "R" && tipo !== "A") return Number(idAtual);

  // Simulação já consumida: criar nova com os mesmos parâmetros.
  const { data: simLocal } = ctx.simulacao_id
    ? await supabase
        .from("simulacoes")
        .select("valor_despesas_financiadas, fg_financiar_despesas")
        .eq("id", ctx.simulacao_id)
        .maybeSingle()
    : { data: null };
  const idBanco = sim?.banco?.idBanco ?? sim?.idBanco ?? pb.homefin_id_banco;
  const valorImovel = num(prop.valor_imovel ?? sim?.valorImovel);
  const valorFinanciamento = num(prop.valor_financiamento ?? sim?.valorFinanciamento ?? sim?.valorTotalFinanciamento);
  const prazo = num(prop.prazo ?? sim?.prazo ?? sim?.prazoPagamentoSimulacao ?? sim?.prazoPagamentoBanco);
  if (!(valorImovel > 0) || !(valorFinanciamento > 0) || !(prazo > 0)) {
    throw new Error(
      `Dados financeiros incompletos para reenviar ao ${pb.nome_banco ?? "banco"}. Revise valor do imóvel, financiamento e prazo.`,
    );
  }
  const financiarDespesas = Boolean(prop.financia_despesas_cartorarias ?? simLocal?.fg_financiar_despesas);
  const valorDespesasFinanciadas = financiarDespesas
    ? num(simLocal?.valor_despesas_financiadas ?? sim?.valorDespesasFinanciadas)
    : 0;
  const novoPayload: Record<string, unknown> = {
    valorImovel,
    valorFinanciamento,
    prazo,
    codigoSistemaAmortizacaoBanco: { id: prop.sistema_amortizacao ?? sim?.codigoSistemaAmortizacaoBanco?.id ?? sim?.codigoSistemaAmortizacaoBanco ?? "S" },
    banco: idBanco ? { idBanco } : sim?.banco,
    fgFinanciarDespesas: financiarDespesas ? "S" : "N",
    valorDespesasFinanciadas,
    valorTotalFinanciamento: valorFinanciamento + valorDespesasFinanciadas,
    fgAutorizacaoDados: true,
  };
  const novaResp = await chamarIntegracao<any>(
    `/oportunidade/${idOportunidade}/simulacao`,
    "POST",
    novoPayload,
    ctx,
  );
  const novoId = Number(novaResp?.idSimulacao ?? novaResp?.data?.idSimulacao ?? 0);
  if (!novoId) {
    throw new Error(
      `Não foi possível criar uma nova simulação para reenviar ao ${pb.nome_banco ?? "banco"}. Refaça a simulação e tente novamente.`,
    );
  }
  await chamarIntegracao<any>(
    `/oportunidade/${idOportunidade}/simulacao/${novoId}`,
    "PUT",
    {
      valorImovel,
      valorFinanciamento,
      prazo,
      codigoSistemaAmortizacaoBanco: novoPayload.codigoSistemaAmortizacaoBanco,
      fgFinanciarDespesas: novoPayload.fgFinanciarDespesas,
      valorDespesasFinanciadas,
      valorTotalFinanciamento: valorFinanciamento + valorDespesasFinanciadas,
      fgAutorizacaoDados: true,
    },
    ctx,
  );
  await supabase
    .from("proposta_bancos")
    .update({ homefin_id_simulacao_banco: String(novoId) } as any)
    .eq("id", pb.id);
  // Reflete a nova simulação em memória para o restante do envio.
  pb.homefin_id_simulacao_banco = String(novoId);
  await supabase.from("proposta_historico").insert({
    proposta_id: propostaId,
    tipo_evento: "sincronizacao",
    descricao: `Nova simulação gerada para reenviar ao ${pb.nome_banco ?? "banco"} (a anterior já havia sido consumida).`,
  });
  return novoId;
}


// Observação: a sincronização de cônjuge no nível da OPORTUNIDADE foi removida.
// O `PUT /oportunidade` só aceita valorImovel/valorFinanciamento/prazo; enviar
// campos de cônjuge nesse endpoint faz o provedor interpretar como
// `spouse: false` e o Itaú devolve "spouse: O campo deve ser informado".
// Os campos de cônjuge são enviados no PUT do PARTICIPANTE titular
// (garantirEnderecoParticipantes) como strings simples, conforme a API oficial.


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
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Não foi possível consultar os participantes da oportunidade antes do envio: ${sanitizarMensagemErro(msg)}`,
    );
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

  // Simulação vinculada — necessária para preencher os dados de cônjuge quando
  // o proponente principal é casado. Sem isso, alguns bancos (Itaú) rejeitam a
  // inclusão da proposta com o erro `spouse: O campo deve ser informado`.
  let sim: any = null;
  if (prop.simulacao_id) {
    const { data } = await supabase
      .from("simulacoes")
      .select("*")
      .eq("id", prop.simulacao_id)
      .maybeSingle();
    sim = data;
  }
  for (const part of participantes) {
    const cpf = soDigitos(part?.cpfCnpj);
    const env = (envolvidos ?? []).find((e: any) => soDigitos(e.cpf_cnpj) === cpf);

    // Fontes de dados em ordem de prioridade: participante da API > envolvido >
    // cadastro do cliente (só para o proponente principal) > proposta/imóvel.
    const ehPrincipal = soDigitos(prop.cpf_cnpj) === cpf;
    const src = ehPrincipal ? cliente : null;

    // O cadastro atual do sistema é a fonte de verdade. O participante já salvo
    // no banco pode estar com estado civil antigo (ex.: antes era casado e virou
    // solteiro); se priorizarmos a API, o envio continua exigindo CPF do cônjuge.
    const estadoCivilAtualSistema =
      estadoCivilBanco(src?.estado_civil) ||
      estadoCivilBanco(env?.estado_civil) ||
      estadoCivilBanco(prop.estado_civil) ||
      estadoCivilBanco(sim?.estado_civil);
    const estadoCivil = estadoCivilAtualSistema || estadoCivilBanco(part?.tipoEstadoCivil) || null;
    const uf = part?.uf || env?.uf || src?.uf || prop.uf || null;
    // Profissão e empresa: prioriza o cadastro atual do sistema sobre o que já
    // está gravado na oportunidade bancária, pois a oportunidade pode conter um
    // valor antigo inválido (ex.: "Administrador(a)").
    const profissao =
      textoLivreParaBanco(env?.profissao) ||
      textoLivreParaBanco(src?.profissao) ||
      textoLivreParaBanco(part?.nomeProfissao) ||
      "Não informado";
    const empresa =
      textoLivreParaBanco(env?.empresa) ||
      textoLivreParaBanco(src?.empresa) ||
      textoLivreParaBanco(part?.nomeEmpresaProfissao) ||
      "Não informado";

    const conjuge = env
      ? (envolvidos ?? []).find((e: any) => String(e.conjuge_de ?? "") === String(env.id))
      : (envolvidos ?? []).find((e: any) => e.conjuge_de);
    const estadoCivilConjuge =
      estadoCivilBanco(sim?.estado_civil_conjuge) ||
      estadoCivilBanco(conjuge?.estado_civil) ||
      estadoCivilBanco(part?.tipoEstadoCivilConjuge) ||
      estadoCivil ||
      undefined;

    // Dados do cônjuge — obrigatórios em alguns bancos quando o proponente
    // principal está casado ou em união estável. Sempre reenviamos, pois a
    // oportunidade pode ter sido criada sem esses campos.
    const casado = ehPrincipal && exigeConjugePorEstadoCivil(estadoCivil);
    const dadosConjuge = casado
      ? {
          nomeConjuge:
            conjuge?.nome ?? src?.conjuge_nome ?? sim?.nome_conjuge ?? part?.nomeConjuge ?? undefined,
          cpfConjuge:
            soDigitos(conjuge?.cpf_cnpj ?? src?.conjuge_cpf ?? sim?.cpf_conjuge ?? part?.cpfConjuge),
          dataNascimentoConjuge:
            conjuge?.data_nascimento ??
            src?.conjuge_data_nascimento ??
            sim?.data_nascimento_conjuge ??
            part?.dataNascimentoConjuge ??
            undefined,
          tipoEstadoCivilConjuge: estadoCivilConjuge,
          tipoDocumentoIdentidadeConjuge:
            enumBancoId(conjuge?.tipo_documento_identidade) ??
            enumBancoId(src?.conjuge_tipo_documento_identidade) ??
            enumBancoId(part?.tipoDocumentoIdentidadeConjuge) ??
            undefined,
          numeroDocumentoConjuge: sanitizarNumeroDocumento(
            conjuge?.numero_documento ?? src?.conjuge_numero_documento ?? part?.numeroDocumentoConjuge,
          ),
          dataExpedicaoConjuge:
            conjuge?.data_expedicao ?? src?.conjuge_data_expedicao ?? part?.dataExpedicaoConjuge ?? undefined,
          orgaoExpedidorConjuge:
            conjuge?.orgao_expedidor ?? src?.conjuge_orgao_expedidor ?? part?.orgaoExpedidorConjuge ?? undefined,
          ufExpedicaoConjuge:
            conjuge?.uf_expedicao ?? src?.conjuge_uf_expedicao ?? part?.ufExpedicaoConjuge ?? undefined,
          nomeProfissaoConjuge:
            textoLivreParaBanco(conjuge?.profissao) ||
            textoLivreParaBanco(src?.conjuge_profissao) ||
            textoLivreParaBanco(part?.nomeProfissaoConjuge) ||
            undefined,
          rendaConjuge: conjuge?.renda ?? src?.conjuge_renda ?? sim?.renda_conjuge ?? part?.rendaConjuge ?? undefined,
          nomeEmpresaProfissaoConjuge:
            textoLivreParaBanco(conjuge?.empresa) ||
            textoLivreParaBanco(src?.conjuge_empresa) ||
            textoLivreParaBanco(part?.nomeEmpresaProfissaoConjuge) ||
            undefined,
          tipoSexoConjuge:
            enumBancoId(conjuge?.tipo_sexo) ??
            (src?.conjuge_sexo ? String(src.conjuge_sexo).trim().charAt(0).toUpperCase() : undefined) ??
            enumBancoId(part?.tipoSexoConjuge) ??
            undefined,
        }
      : {};

    if (casado && (!(dadosConjuge as any).nomeConjuge || !(dadosConjuge as any).cpfConjuge)) {
      throw new Error(
        "Cadastro do cônjuge incompleto. Informe nome e CPF do cônjuge antes de enviar ao banco.",
      );
    }

    // Chamamos a API quando falta estado civil, UF, profissão, empresa ou dados
    // de cônjuge (campos que mais derrubam a validação dos bancos). Se todos já
    // estão presentes no participante, nada a fazer.
    const faltaEstadoCivil = estadoCivilBanco(part?.tipoEstadoCivil) !== estadoCivil;
    const faltaUf = !(part?.uf && String(part.uf).trim());
    const faltaProfissao = !(part?.nomeProfissao && String(part.nomeProfissao).trim());
    const faltaEmpresa = !(part?.nomeEmpresaProfissao && String(part.nomeEmpresaProfissao).trim());
    const faltaConjuge = casado && !(part?.nomeConjuge && part?.cpfConjuge);
    // Quando temos um envolvido cadastrado no sistema, sempre sincronizamos os
    // dados complementares (documento, sexo, FGTS, endereço) com o banco.
    const temEnvolvido = Boolean(env);
    if (!temEnvolvido && !faltaEstadoCivil && !faltaUf && !faltaProfissao && !faltaEmpresa && !faltaConjuge)
      continue;
    // Sem meios de preencher estado civil ou UF, não adianta chamar a API —
    // profissão/empresa sempre têm fallback, então não bloqueiam.
    if (
      faltaEstadoCivil &&
      !estadoCivil &&
      faltaUf &&
      !uf &&
      !faltaProfissao &&
      !faltaEmpresa &&
      !faltaConjuge
    )
      continue;

    const payload: Record<string, unknown> = {
      tipoSituacao: enumBancoId(part?.tipoSituacao) ?? "A",
      nomeParticipante: part?.nomeParticipante ?? env?.nome ?? prop.nome_cliente,
      tipoQualificacao: enumBancoId(part?.tipoQualificacao) ?? "CO",
      tipoPessoa: enumBancoId(part?.tipoPessoa) ?? ((cpf?.length ?? 0) > 11 ? "J" : "F"),
      cpfCnpj: cpf,
      dataNascimento:
        part?.dataNascimento ?? env?.data_nascimento ?? src?.data_nascimento ?? prop.data_nascimento ?? undefined,
      tipoEstadoCivil: estadoCivil ?? undefined,
      tipoRegimeCasamento: exigeConjugePorEstadoCivil(estadoCivil)
        ? enumBancoId(env?.regime_casamento) ?? enumBancoId(src?.regime_casamento) ?? enumBancoId(part?.tipoRegimeCasamento)
        : undefined,
      tipoSexo: enumBancoId(part?.tipoSexo) ?? env?.tipo_sexo ?? undefined,
      tipoDocumentoIdentidade:
        enumBancoId(part?.tipoDocumentoIdentidade) ?? env?.tipo_documento_identidade ?? undefined,
      numeroDocumento: sanitizarNumeroDocumento(part?.numeroDocumento ?? env?.numero_documento),
      orgaoExpedidor: part?.orgaoExpedidor ?? env?.orgao_expedidor ?? undefined,
      ufExpedicao: part?.ufExpedicao ?? env?.uf_expedicao ?? undefined,
      dataExpedicao: part?.dataExpedicao ?? env?.data_expedicao ?? undefined,
      nomeProfissao: profissao,
      nomeEmpresaProfissao: empresa,
      nomeMae: part?.nomeMae ?? env?.nome_mae ?? src?.mae ?? undefined,
      renda: part?.renda ?? env?.renda ?? src?.renda_total_declarada ?? prop.renda_total ?? undefined,
      email: part?.email ?? env?.email ?? src?.email ?? prop.email ?? undefined,
      celular: part?.celular ?? soDigitos(env?.celular ?? src?.celular) ?? undefined,
      utilizaFgts: part?.utilizaFgts ?? (env?.utiliza_fgts ? "S" : "N"),
      fgAutorizacaoDados: env?.fg_autorizacao_dados ?? true,
      cep: soDigitos(env?.cep ?? prop.cep_imovel),
      logradouro: env?.logradouro ?? prop.endereco_imovel ?? undefined,
      numeroLogradouro: env?.numero_logradouro ?? undefined,
      complementoLogradouro: env?.complemento ?? undefined,
      bairro: env?.bairro ?? prop.bairro_imovel ?? undefined,
      municipio: env?.municipio ?? prop.cidade_imovel ?? undefined,
      uf: uf ?? undefined,
      ...dadosConjuge,
    };


    try {
      await chamarIntegracao<any>(
        `/oportunidade/${idOportunidade}/participante/${part.idParticipante}`,
        "PUT",
        payload,
        ctx,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(
        `Não foi possível atualizar os dados complementares do participante antes do envio: ${sanitizarMensagemErro(msg)}`,
      );
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

  // Cadastro complementar obrigatório: apenas dos compradores/coproponentes
  // "independentes". Cônjuges vinculados a outro envolvido (`conjuge_de`) são
  // editados dentro do formulário do titular e enviados ao banco pelo bloco
  // `nomeConjuge/cpfConjuge/...` da oportunidade — não exigem o mesmo conjunto
  // completo de campos, então não devem bloquear o envio.
  const { data: compradores } = await supabase
    .from("proposta_envolvidos")
    .select("*")
    .eq("proposta_id", propostaId)
    .in("tipo_qualificacao", ["CO", "TI"]);
  const principais = (compradores ?? []).filter((e: any) => !e.conjuge_de);
  if (principais.length === 0) {
    throw new Error(
      "Preencha o cadastro complementar do comprador antes de enviar a proposta ao banco.",
    );
  }
  const incompletos = principais.filter((e: any) => !envolvidoEnvioCompleto(e));
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
  if (!bancoId && bancos.length > 1) {
    throw new Error("Clique no botão Enviar da linha do banco que deseja enviar.");
  }
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

  // Alguns bancos (ex.: Itaú) rejeitam a proposta quando o participante titular
  // está sem endereço (proponents[0].address.state) OU quando os campos de
  // cônjuge não acompanham o participante casado (erro "spouse: O campo deve
  // ser informado"). Ambos os cenários são resolvidos pelo PUT no participante
  // feito em `garantirEnderecoParticipantes` (endereço + nomeConjuge/cpfConjuge/
  // tipoEstadoCivilConjuge/... como strings simples, formato exigido pela API).
  //
  // Importante: o `PUT /oportunidade` da API só aceita valorImovel,
  // valorFinanciamento e prazo. Enviar um bloco de cônjuge nesse endpoint faz
  // o provedor interpretar como `spouse: false` e derruba o Itaú com o erro
  // "spouse: O campo deve ser informado" — por isso NÃO sincronizamos cônjuge
  // no nível da oportunidade.
  const resultados: EnviarResultado["bancos"] = [];
  let sucesso = 0;

  // Envia a proposta para os bancos selecionados de forma SEQUENCIAL.
  // A API bancária inclui as propostas na MESMA oportunidade; disparar as
  // inclusões em paralelo gera condição de corrida e faz alguns bancos
  // falharem ("erro no envio") enquanto outros passam. Enviando um de cada
  // vez cada banco é processado isoladamente e todos os selecionados chegam
  // ao banco. Cada envio mantém seu próprio try/catch: a falha de um (ex.:
  // Itaú recusando por validação) não impede o envio dos demais.
  const enviarBancoIntegracao = async (b: any): Promise<EnviarResultado["bancos"][number]> => {
    try {
      await garantirEnderecoParticipantes({
        prop,
        idOportunidade: prop.homefin_id_oportunidade,
        ctx,
        supabase,
      });
      // Antes de reenviar, verifica se a simulação vinculada ao banco já foi
      // "consumida" por uma tentativa anterior (tipoSituacao "R" ou "A"). O
      // provedor não permite reprocessar a mesma simulação: nesse caso criamos
      // uma NOVA simulação com os mesmos parâmetros e passamos a usá-la.
      const idSimulacaoUsar = await renovarSimulacaoSeConsumida({
        idOportunidade: prop.homefin_id_oportunidade,
        prop,
        pb: b,
        propostaId,
        ctx,
        supabase,
      });
      const resp = await chamarIntegracao<any>(
        `/oportunidade/${prop.homefin_id_oportunidade}/incluir-proposta-integracao`,
        "POST",
        { idSimulacao: idSimulacaoUsar },
        ctx,
      );

      // No POST de inclusão alguns bancos devolvem códigos intermediários antes
      // do processamento assíncrono. Só tratamos como falha imediata quando há
      // mensagem/campo de validação claro; código isolado fica em análise e o
      // polling posterior reconcilia com o retorno definitivo do banco.
      const erroBanco =
        extrairErroRetorno(resp?.retornoIntegracao, { codigoApenasComoErro: false }) ??
        extrairErroRetorno(resp?.descricaoRespostaBanco?.retornoIntegracao, {
          codigoApenasComoErro: false,
        });
      if (erroBanco) {
        throw new IntegracaoBancariaError(erroBanco);
      }

      // Grava o RETORNO real do banco (taxa, parcela, financiamento, situação e
      // protocolo) em vez de apenas marcar "enviada". Assim o usuário vê o
      // desfecho imediato da comunicação com o banco.
      const situacaoTipo = String(resp?.tipoSituacao ?? "").trim();
      const mapa = statusInternoBanco(situacaoTipo, false, resp?.codigoSituacaoBanco);
      const statusBancoInicial = mapa.banco === "erro" ? "enviada" : mapa.banco || "enviada";
      const patchOk: Record<string, unknown> = {
        status_banco: statusBancoInicial,
        selecionado: true,
        mensagem_banco: null,
        raw_response: resp,
      };
      // situacao_banco é um enum interno (nao_enviado/em_analise/condicionado/
      // aprovado/recusado/cancelado). O tipoSituacao do banco vem como código
      // cru (S/P/N/A/R) — precisa ser mapeado, senão o valor não bate com o
      // <Select> da tela e a linha continua exibindo "Não enviado".
      patchOk.situacao_banco =
        mapa.banco === "erro"
          ? "em_analise"
          : situacaoBancoDeTipo(situacaoTipo, resp?.codigoSituacaoBanco, false);
      const numeroBanco = numeroPropostaBancoReal(resp);
      const referenciaBanco = referenciaIntegracaoBanco(resp);
      if (numeroBanco) patchOk.numero_proposta_banco = numeroBanco;
      else if (referenciaBanco && numeroAtualEhReferenciaTecnica(b, resp)) {
        patchOk.numero_proposta_banco = null;
      }
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
      if (numeroBanco) {
        await supabase
          .from("propostas")
          .update({ numero_proposta_banco: numeroBanco } as any)
          .eq("id", propostaId);
      }
      return {
        banco_id: b.banco_id,
        nome_banco: b.nome_banco,
        status: String(patchOk.status_banco),
        numero_proposta_banco: numeroBanco,
        mensagem: "Enviado. Aguardando atualização do banco.",
      };
    } catch (e) {
      const msg = sanitizarMensagemErro(
        e instanceof Error ? e.message : "Falha ao enviar ao banco.",
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

  const enviados: EnviarResultado["bancos"] = [];
  for (const b of bancos as any[]) {
    // Sequencial de propósito (ver comentário acima): evita a condição de
    // corrida na inclusão de múltiplas propostas na mesma oportunidade.
    const r = await enviarBancoIntegracao(b);
    enviados.push(r);
  }
  for (const r of enviados) {
    resultados.push(r);
    if (r.status !== "erro") sucesso++;
  }




  // No primeiro envio o status avança; em envios adicionais o status já reflete
  // a análise em andamento e não deve retroceder.
  let novoStatus = statusAtual;
  if (primeiroEnvio) {
    novoStatus = sucesso > 0 ? "enviada_banco" : "erro_envio";
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

  // O retorno definitivo dos bancos é reconciliado pelo polling automático.
  // Evitamos uma consulta imediata aqui para não transformar códigos
  // intermediários em falso "erro de envio" antes do banco concluir a análise.

  return { status: novoStatus, bancos: resultados };

}

export {
  enviarFollowupHomefinImpl,
  cancelarPropostaHomefinImpl,
} from "./enviar/lifecycle.server";

// Helpers de retorno/status foram extraídos para ./enviar/helpers-retorno.server.ts
// e são importados no topo deste arquivo.

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
  let algumFalhaIntegracao = false;
  const errosBanco: string[] = [];
  const bancosComFalhaIntegracao: string[] = [];
  let simEscolhida: any = null;
  let numeroPropostaBanco: string | null = null;

  for (const pb of (bancosProp ?? []) as any[]) {
    const sim = escolherSimulacaoBanco(pb, simulacoes);
    if (!sim) continue;

    let erroMsg = extrairErroRetorno(
      sim.retornoIntegracao ?? sim.descricaoRespostaBanco?.retornoIntegracao,
    );

    // Falha/erro de integração: a API define `P` como erro ao enviar proposta
    // e alguns bancos usam `E` para erro técnico/validação. Não converter esses
    // retornos em sucesso apenas por haver código externo no payload.
    const falhaIntegracao = ehFalhaIntegracaoBanco(sim);
    if (falhaIntegracao) {
      erroMsg = MSG_FALHA_INTEGRACAO;
      algumFalhaIntegracao = true;
      bancosComFalhaIntegracao.push(pb.nome_banco ?? "Banco");
    }
    const mapa = statusInternoBanco(sim.tipoSituacao, Boolean(erroMsg), sim.codigoSituacaoBanco, sim);


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
        sim,
      ),
      mensagem_banco: erroMsg ? sanitizarMensagemErro(erroMsg) : null,
      raw_response: sim,
    };
    // Salva apenas o número REAL da proposta no banco. Códigos de oportunidade
    // ou simulação são referências técnicas e não devem aparecer como "Nº banco".
    // Em falha de integração, NUNCA gravar protocolo: a proposta não existe na
    // esteira real do banco, então qualquer código devolvido é fantasma.
    const numeroReal = falhaIntegracao ? null : numeroPropostaBancoReal(sim);
    if (falhaIntegracao) {
      patchBanco.numero_proposta_banco = null;
    } else if (numeroReal) {
      patchBanco.numero_proposta_banco = numeroReal;
      if (!numeroPropostaBanco || sim.bancoEscolhido === "S" || mapa.proposta === "credito_aprovado") {
        numeroPropostaBanco = numeroReal;
      }
    } else if (numeroAtualEhReferenciaTecnica(pb, sim)) {
      patchBanco.numero_proposta_banco = null;
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
    let melhorIdx = atual;
    for (const c of candidatos) {
      const idx = ORDEM_STATUS.indexOf(c);
      if (idx > melhorIdx) {
        melhorIdx = idx;
        novoStatus = c;
      }
    }
    // Desfecho terminal de crédito recusado quando não houve avanço no funil.
    // credito_recusado não faz parte da ORDEM_STATUS (não é progressão), então o
    // laço acima nunca o seleciona — precisa ser tratado explicitamente aqui a
    // partir de QUALQUER sinal (bancos, etapa do funil ou atividade), senão a
    // proposta fica presa em "em_analise_credito" e o polling roda para sempre.
    // EXCEÇÃO: quando o único sinal de "recusa" vem de uma FALHA DE INTEGRAÇÃO
    // (Bradesco: recusa fantasma sem token do banco), NÃO marca recusado —
    // vira erro_envio para o operador reenviar.
    const houveRecusa =
      statusBancos === "credito_recusado" ||
      statusEtapa === "credito_recusado" ||
      statusAtividade.status === "credito_recusado";
    if (!novoStatus && houveRecusa && prop.status !== "credito_recusado") {
      novoStatus = "credito_recusado";
    }
    // Falha de integração sem outro desfecho positivo: força erro_envio para
    // habilitar reenvio (não é recusa de crédito real).
    if (
      algumFalhaIntegracao &&
      !algumAprovado &&
      !algumEmAnalise &&
      !algumRecusado &&
      novoStatus !== "credito_aprovado" &&
      novoStatus !== "em_analise_credito" &&
      novoStatus !== "contrato_emitido"
    ) {
      novoStatus = "erro_envio";
    }
  }

  // Detalhe coerente com o desfecho: a atividade real do banco tem prioridade;
  // quando há um desfecho de crédito (recusado/aprovado/análise) ou situação
  // terminal, nunca exibimos uma etapa anterior do funil (ex.: "Simulação"),
  // que contradiz o status e confunde o usuário.
  const statusEfetivo = (novoStatus ?? prop.status) as PropostaStatus;
  const ROTULO_DETALHE: Partial<Record<PropostaStatus, string>> = {
    credito_recusado: "Crédito recusado",
    credito_aprovado: "Crédito aprovado",
    em_analise_credito: "Em análise de crédito",
    aguardando_documentos: "Coleta de documentos",
    engenharia_vistoria: "Engenharia / vistoria",
    analise_juridica: "Análise jurídica",
    contrato_emitido: "Contrato emitido",
    cancelada: "Cancelada",
  };
  const patch: Record<string, unknown> = {
    detalhe_status_atual:
      statusAtividade.detalhe ?? ROTULO_DETALHE[statusEfetivo] ?? nomeEtapa,
    ultima_sincronizacao_em: new Date().toISOString(),
  };


  // Funil COMPLETO da oportunidade retornado pelo banco (pós-aprovação e demais
  // etapas). Persistido integralmente para exibir o andamento real sem cortar
  // nenhuma etapa da integração. Rótulos neutros — nenhum provedor citado.
  const funilBanco = etapas
    .map((e) => ({
      id: e?.idEtapa ?? null,
      nome: e?.nomeEtapa ?? null,
      ordem: Number(e?.ordemEtapa ?? 0),
      ativa: Boolean(e?.active),
      concluida: Boolean(e?.completed),
      atualizada_em: e?.dataHoraAlteracao ?? e?.dataHoraCriacao ?? null,
    }))
    .filter((e) => e.nome)
    .sort((a, b) => a.ordem - b.ordem);
  if (funilBanco.length > 0) patch.etapas_banco = funilBanco;
  const escolhida = simEscolhida ?? {};
  const numeroOportunidadeBanco = numeroBancoDaOportunidade(op);
  // Em falha de integração pura (sem nenhum banco realmente efetivado),
  // não persistir "Nº banco" — o código devolvido é fantasma, não existe
  // proposta na esteira do banco.
  const soFalhaIntegracao =
    algumFalhaIntegracao && !algumAprovado && !algumEmAnalise && !algumRecusado;
  if (soFalhaIntegracao) {
    patch.numero_proposta_banco = null;
  } else if (numeroPropostaBanco || numeroOportunidadeBanco) {
    patch.numero_proposta_banco = numeroPropostaBanco ?? numeroOportunidadeBanco;
  }
  else if (numeroAtualEhReferenciaTecnica({ numero_proposta_banco: prop.numero_proposta_banco }, escolhida)) {
    patch.numero_proposta_banco = null;
  }
  const referenciaEscolhida = referenciaIntegracaoBanco(escolhida);
  if (op?.codigoOportunidadeBanco || referenciaEscolhida)
    patch.codigo_oportunidade_homefin =
      op?.codigoOportunidadeBanco ?? referenciaEscolhida;
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
    const ehErroIntegracao = novoStatus === "erro_envio" && algumFalhaIntegracao;
    await supabase.from("proposta_historico").insert({
      proposta_id: propostaId,
      tipo_evento: ehErroIntegracao ? "erro_envio" : "sincronizacao",
      descricao: ehErroIntegracao
        ? `Falha na integração com o banco (${bancosComFalhaIntegracao.join(", ") || "banco"}). A proposta não foi efetivada. Reenvie para retomar o processo.`
        : nomeEtapa
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

  // ---- Importa as atividades (follow-ups) do banco na aba Follow-up ----
  // A API não expõe comentários livres do banco, mas as atividades da
  // oportunidade (`atividadesOportunidade`) são o acompanhamento oficial do
  // banco. Espelhamos essas atividades como comentários de origem "banco"
  // para que apareçam junto aos follow-ups internos/externos. Idempotente:
  // substitui o espelho atual a cada sincronização.
  try {
    const atvBanco = atividades
      .map((a: any) => {
        const nome = String(a?.atividade?.nomeAtividade ?? a?.nomeAtividade ?? "").trim();
        if (!nome) return null;
        const sit = String(a?.tipoSituacao ?? "").toUpperCase().charAt(0);
        const rotuloSit =
          sit === "C" ? "Concluída" : sit === "E" ? "Em andamento" : "Não iniciada";
        const etapaNome = String(a?.etapa?.nomeEtapa ?? "").trim();
        const dt =
          a?.dataHoraConclusao ??
          a?.dataHoraAtuacao ??
          a?.dataHoraCriacao ??
          a?.dataInclusao ??
          null;
        const partes: string[] = [];
        if (etapaNome) partes.push(`Etapa: ${etapaNome}`);
        partes.push(`Situação: ${rotuloSit}`);
        if (a?.dataPrevisaoConclusao) partes.push(`Previsão: ${a.dataPrevisaoConclusao}`);
        let iso = new Date().toISOString();
        if (dt) {
          const d = new Date(String(dt).replace(" ", "T"));
          if (!Number.isNaN(d.getTime())) iso = d.toISOString();
        }
        return { titulo: nome, comentario: partes.join(" · "), created_at: iso };
      })
      .filter(Boolean) as { titulo: string; comentario: string; created_at: string }[];

    if (atvBanco.length > 0) {
      await supabase
        .from("proposta_followups")
        .delete()
        .eq("proposta_id", propostaId)
        .eq("tipo", "banco");
      await supabase.from("proposta_followups").insert(
        atvBanco.map((a) => ({
          proposta_id: propostaId,
          tipo: "banco",
          titulo: a.titulo,
          comentario: a.comentario,
          homefin_enviado: true,
          created_at: a.created_at,
        })) as any,
      );
    }
  } catch (e) {
    console.error("[proposta] importação de follow-ups do banco falhou", e);
  }

  return { status: novoStatus ?? prop.status, etapa: nomeEtapa, atualizado: mudouStatus };
}

/* =========================================================================
 * Reexports — módulos extraídos para reduzir a superfície deste arquivo.
 *   - Envio de documentos ao banco → ./enviar/documentos.server.ts
 *   - Gestão de participantes/usuários parceiros → ./enviar/participantes-crud.server.ts
 *
 * A API pública (nomes exportados) permanece idêntica: consumidores continuam
 * importando de `@/lib/propostas/enviar.server`.
 * ========================================================================= */
export {
  enviarDocumentosBancoImpl,
  type EnviarDocumentosArgs,
  type EnviarDocumentosResultado,
} from "./enviar/documentos.server";
export {
  adicionarParticipanteImpl,
  removerParticipanteImpl,
  listarUsuariosParceirosImpl,
  type ParticipantePayload,
  type UsuarioParceiroBanco,
} from "./enviar/participantes-crud.server";
// Re-export públicos dos helpers de retorno para retrocompatibilidade da API.
export { ehFalhaIntegracaoBanco, bancoJaEnviado } from "./enviar/helpers-retorno.server";
