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
  TIPO_BANCO_SANTANDER,
} from "@/lib/simulacao/homefin.server";
import { faltantesEnvolvido, ehProponenteEnviadoAoBanco } from "./campos-obrigatorios";
import { msgCadastroIncompleto } from "./mensagens-envio";

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

/**
 * Função única e centralizada para derivar o status global da proposta
 * a partir do estado das suas linhas de banco (proposta_bancos).
 * Garante que propostas.status nunca divirja do desfecho dos bancos.
 */
export async function recalcularStatusGlobalProposta(
  supabase: SupabaseClient<any, any, any>,
  propostaId: string,
): Promise<PropostaStatus | null> {
  const { data: bancos } = await supabase
    .from("proposta_bancos")
    .select("situacao_banco")
    .eq("proposta_id", propostaId);

  if (!bancos || bancos.length === 0) return null;

  let algumAprovado = false;
  let algumEmAnalise = false;
  let algumRecusado = false;
  let algumErroEnvio = false;

  for (const b of bancos) {
    const s = String(b.situacao_banco);
    if (s === "aprovado" || s === "condicionado") algumAprovado = true;
    else if (s === "em_analise") algumEmAnalise = true;
    else if (s === "recusado") algumRecusado = true;
    else if (s === "erro") algumErroEnvio = true;
  }

  // Hierarquia de relevância para o cabeçalho
  if (algumAprovado) return "credito_aprovado";
  if (algumEmAnalise) return "em_analise_credito";
  if (algumRecusado) return "credito_recusado";
  if (algumErroEnvio) return "erro_envio";

  return "enviada_banco";
}

export interface IntegracaoErroEstruturado {
  codigo: "CADASTRO_INCOMPLETO" | "TIMEOUT" | "FALHA_CONEXAO" | "ERRO_BANCO";
  mensagem: string;
  campos?: {
    envolvido_id: string;
    campo: string;
    rotulo: string;
    secao?: string;
  }[];
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
    erro_estruturado?: IntegracaoErroEstruturado;
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
  const s = String(v ?? "")
    .replace(/[^0-9A-Za-z]/g, "")
    .trim();
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

function sistemaAmortizacaoBanco(v: unknown): string {
  const bruto = enumBancoId(v) ?? "S";
  const s = String(bruto).trim().toUpperCase();
  // Aceita "PRICE", "SAC" ou apenas a primeira letra "P", "S"
  if (s.startsWith("P")) return "P";
  return "S";
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
  // Caso 3a: Registro de payload completo em proposta_logs_homefin
  // Nota: O log agora preserva campos estruturais e mascara apenas CPF, e-mail e renda.
  // A lógica de mascaramento foi ajustada em homefin.server.ts para este fim.
  return s || undefined;
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

  // Payload financeiro oficial para a API. Em tentativas anteriores algumas
  // simulações de proposta foram criadas sem `valorFinanciamento`/`prazo`; se
  // reutilizadas, o banco devolve financingValue/period = 0. Por isso TODO
  // envio sincroniza a simulação antes do POST de inclusão da proposta.
  const { data: simLocal } = ctx.simulacao_id
    ? await supabase
        .from("simulacoes")
        .select(
          "valor_imovel, valor_financiamento, prazo, sistema_amortizacao, valor_despesas_financiadas, fg_financiar_despesas",
        )
        .eq("id", ctx.simulacao_id)
        .maybeSingle()
    : { data: null };
  const familiaAtual = await dadosFamiliaresAtuaisDaProposta({ prop, propostaId, supabase });
  await sincronizarSnapshotFamiliarLocal({ prop, ctx, familiaAtual, supabase });

  // Nota: se `sim` for null (simulação órfã / não existe mais na oportunidade),
  // NÃO reutilizamos o idAtual — isso causa HTTP 500 no /incluir-proposta-integracao.
  // Em vez disso, tratamos como "consumida" e criamos uma nova simulação abaixo.

  const tipo = String(sim?.tipoSituacao ?? "")
    .toUpperCase()
    .charAt(0);
  const erroSimulacaoAtual = erroRetornoIntegracaoResposta(sim);
  // Além de A/R (simulação já consumida), P/E ou retornoIntegracao com validação
  // indicam uma simulação bancária contaminada por tentativa anterior. Reusar esse
  // id mantém o erro preso (ex.: Itaú com spouse=false mesmo após atualizar o
  // participante para solteiro). Nesses casos criamos uma simulação nova.
  const simConsumida =
    !sim ||
    tipo === "R" ||
    tipo === "A" ||
    tipo === "P" ||
    tipo === "E" ||
    Boolean(erroSimulacaoAtual);
  const idBanco = sim?.banco?.idBanco ?? sim?.idBanco ?? pb.homefin_id_banco;
  const valorImovel = num(prop.valor_imovel ?? simLocal?.valor_imovel ?? sim?.valorImovel);
  const valorFinanciamento = num(
    prop.valor_financiamento ??
      simLocal?.valor_financiamento ??
      sim?.valorFinanciamentoSimulacao ??
      sim?.valorFinanciamentoBanco ??
      sim?.valorFinanciamentoBancoMax ??
      sim?.valorTotalFinanciamento,
  );
  const prazo = num(
    prop.prazo ??
      simLocal?.prazo ??
      sim?.prazo ??
      sim?.prazoPagamentoSimulacao ??
      sim?.prazoPagamentoBanco,
  );
  if (!(valorImovel > 0) || !(valorFinanciamento > 0) || !(prazo > 0)) {
    throw new Error(
      `O valor do imóvel, o financiamento e o prazo não podem ser zero. Por favor, revise os dados financeiros antes de reenviar ao ${pb.nome_banco ?? "banco"}.`,
    );
  }
  const financiarDespesas = Boolean(
    prop.financia_despesas_cartorarias ?? simLocal?.fg_financiar_despesas,
  );
  const valorDespesasFinanciadas = financiarDespesas
    ? num(simLocal?.valor_despesas_financiadas ?? sim?.valorDespesasFinanciadas)
    : 0;
  const payloadCompleto: Record<string, unknown> = {
    valorImovel,
    valorFinanciamento,
    prazo,
    codigoSistemaAmortizacaoBanco: {
      id: sistemaAmortizacaoBanco(
        prop.sistema_amortizacao ??
          simLocal?.sistema_amortizacao ??
          sim?.codigoSistemaAmortizacaoBanco ??
          sim?.idAmortizacao,
      ),
    },

    fgFinanciarDespesas: financiarDespesas ? "S" : "N",
    valorDespesasFinanciadas,
    valorTotalFinanciamento: valorFinanciamento + valorDespesasFinanciadas,
    fgAutorizacaoDados: true,
  };
  // O PUT /oportunidade aceita EXCLUSIVAMENTE valorImovel, valorFinanciamento
  // e prazo. Qualquer outro campo (estado civil, regime de casamento, cônjuge,
  // dados do imóvel) provoca HTTP 500 no provedor e mascara a mensagem real do
  // banco. Estado civil/cônjuge vão no PUT /participante.
  const payloadOportunidadeAtual: Record<string, unknown> = {
    valorImovel,
    valorFinanciamento,
    prazo,
  };
  // A oportunidade pode ter sido criada quando o cliente ainda estava casado e
  // depois o cadastro foi corrigido para solteiro. Se não sincronizarmos esse
  // estado antes do PUT/POST da simulação, alguns bancos (Itaú) continuam
  // validando `spouse=false` em uma simulação antiga.
  try {
    await chamarIntegracao<any>(
      `/oportunidade/${idOportunidade}`,
      "PUT",
      payloadOportunidadeAtual,
      ctx,
    );
  } catch (e) {
    console.warn(
      "Falha ao sincronizar estado civil da oportunidade antes do reenvio; prosseguindo com participante/simulação atualizados.",
      e instanceof Error ? e.message : String(e),
    );
  }

  const criarNovaSimulacao = async (motivo: string): Promise<number> => {
    const novoPayload: Record<string, unknown> = {
      ...payloadCompleto,
      banco: idBanco ? { idBanco } : sim?.banco,
    };
    const novaResp = await chamarIntegracao<any>(
      `/oportunidade/${idOportunidade}/simulacao`,
      "POST",
      novoPayload,
      ctx,
    );
    const erroCriacao = erroRetornoIntegracaoResposta(novaResp);
    if (erroCriacao) {
      throw new IntegracaoBancariaError(sanitizarMensagemErro(erroCriacao));
    }
    const novoId = Number(novaResp?.idSimulacao ?? novaResp?.data?.idSimulacao ?? 0);
    if (!novoId) {
      throw new Error(
        `Não foi possível criar uma nova simulação para reenviar ao ${pb.nome_banco ?? "banco"}. Refaça a simulação e tente novamente.`,
      );
    }
    const putResp = await chamarIntegracao<any>(
      `/oportunidade/${idOportunidade}/simulacao/${novoId}`,
      "PUT",
      payloadCompleto,
      ctx,
    );
    const erroPut = erroRetornoIntegracaoResposta(putResp);
    if (erroPut) {
      throw new IntegracaoBancariaError(sanitizarMensagemErro(erroPut));
    }
    await supabase
      .from("proposta_bancos")
      .update({ homefin_id_simulacao_banco: String(novoId) } as any)
      .eq("id", pb.id);
    // Reflete a nova simulação em memória para o restante do envio.
    pb.homefin_id_simulacao_banco = String(novoId);
    await supabase.from("proposta_historico").insert({
      proposta_id: propostaId,
      tipo_evento: "sincronizacao",
      descricao: motivo,
    });
    return novoId;
  };

  if (!simConsumida) {
    const putResp = await chamarIntegracao<any>(
      `/oportunidade/${idOportunidade}/simulacao/${idAtual}`,
      "PUT",
      payloadCompleto,
      ctx,
    );
    const erroPut = erroRetornoIntegracaoResposta(putResp);
    if (erroPut) {
      return criarNovaSimulacao(
        `Nova simulação gerada para reenviar ao ${pb.nome_banco ?? "banco"} após a simulação anterior retornar validação pendente.`,
      );
    }
    return Number(idAtual);
  }

  return criarNovaSimulacao(
    `Nova simulação gerada para reenviar ao ${pb.nome_banco ?? "banco"} (a anterior já estava encerrada ou com erro de validação).`,
  );
}

function erroRetornoIntegracaoResposta(resp: any): string | null {
  return (
    extrairErroRetorno(resp?.retornoIntegracao, { codigoApenasComoErro: false }) ??
    extrairErroRetorno(resp?.descricaoRespostaBanco?.retornoIntegracao, {
      codigoApenasComoErro: false,
    }) ??
    null
  );
}

async function dadosFamiliaresAtuaisDaProposta({
  prop,
  propostaId,
  supabase,
}: {
  prop: any;
  propostaId: string;
  supabase: SupabaseClient<any, any, any>;
}): Promise<{ estadoCivil: string | undefined; compoeRenda: boolean }> {
  const { data: principal } = await supabase
    .from("proposta_envolvidos")
    .select("estado_civil")
    .eq("proposta_id", propostaId)
    .in("tipo_qualificacao", ["CO", "TI"])
    .is("conjuge_de", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let cliente: any = null;
  if (prop.cliente_id) {
    const { data } = await supabase
      .from("clientes")
      .select("estado_civil")
      .eq("id", prop.cliente_id)
      .maybeSingle();
    cliente = data;
  }

  return {
    estadoCivil:
      estadoCivilBanco(cliente?.estado_civil) ||
      estadoCivilBanco(principal?.estado_civil) ||
      estadoCivilBanco(prop.estado_civil) ||
      undefined,
    compoeRenda: Boolean(prop.compoe_renda) && prop.compoe_renda_conjuge !== false,
  };
}

async function sincronizarSnapshotFamiliarLocal({
  prop,
  ctx,
  familiaAtual,
  supabase,
}: {
  prop: any;
  ctx: { simulacao_id: any; proposta_id: string; correspondente_id: any };
  familiaAtual: { estadoCivil: string | undefined; compoeRenda: boolean };
  supabase: SupabaseClient<any, any, any>;
}): Promise<void> {
  if (!familiaAtual.estadoCivil) return;
  const possuiConjugeAtual = exigeConjugePorEstadoCivil(familiaAtual.estadoCivil);
  const estadoPropAtual = estadoCivilBanco(prop.estado_civil);
  if (
    estadoPropAtual !== familiaAtual.estadoCivil ||
    Boolean(prop.possui_conjuge) !== possuiConjugeAtual
  ) {
    await supabase
      .from("propostas")
      .update({
        estado_civil: familiaAtual.estadoCivil,
        possui_conjuge: possuiConjugeAtual,
        compoe_renda: familiaAtual.compoeRenda,
      } as any)
      .eq("id", prop.id);
    prop.estado_civil = familiaAtual.estadoCivil;
    prop.possui_conjuge = possuiConjugeAtual;
    prop.compoe_renda = familiaAtual.compoeRenda;
  }
  if (ctx.simulacao_id) {
    const patchSim: Record<string, unknown> = {
      estado_civil: familiaAtual.estadoCivil,
      possui_conjuge: possuiConjugeAtual,
      compoe_renda: familiaAtual.compoeRenda,
    };
    if (!possuiConjugeAtual) {
      Object.assign(patchSim, {
        nome_conjuge: null,
        cpf_conjuge: null,
        data_nascimento_conjuge: null,
        email_conjuge: null,
        celular_conjuge: null,
        renda_conjuge: null,
        estado_civil_conjuge: null,
      });
    }
    await supabase
      .from("simulacoes")
      .update(patchSim as any)
      .eq("id", ctx.simulacao_id);
  }
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
  pb,
  idOportunidade,
  ctx,
  supabase,
}: {
  prop: any;
  pb: any;
  idOportunidade: string;
  ctx: { simulacao_id: any; proposta_id: string; correspondente_id: any };
  supabase: SupabaseClient<any, any, any>;
}): Promise<void> {
  // Ressincroniza endereços de cliente_enderecos para proposta_envolvidos antes do envio
  const { ressincronizarDadosParticipantes } = await import("./propostas.functions");
  await ressincronizarDadosParticipantes({
    data: { proposta_id: prop.id },
    context: { supabase } as any,
  } as any);

  let participantes: any[] = [];
  try {
    const resp = await chamarIntegracao<any>(
      `/oportunidade/${idOportunidade}`,
      "GET",
      undefined,
      ctx,
    );
    const op = resp?.oportunidade ?? resp ?? {};
    const situacao = String(op?.tipoSituacao ?? "")
      .toUpperCase()
      .charAt(0);

    // Requisito 3: Interromper se a oportunidade estiver cancelada na HomeFin
    if (situacao === "C") {
      throw new Error(
        "A oportunidade desta proposta foi cancelada na integração (provavelmente por um cancelamento anterior). Será criada uma nova oportunidade para reenviar.",
      );
    }

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
    const regimeCasamento = prop.regime_casamento || part?.tipoRegimeCasamento || null;

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
    if (casado) {
      const cpfTit = soDigitos(env?.cpf_cnpj ?? src?.documento ?? prop.cpf_cnpj);
      const cpfConj = soDigitos(conjuge?.cpf_cnpj ?? src?.conjuge_cpf ?? sim?.cpf_conjuge);
      if (cpfTit && cpfConj && cpfTit === cpfConj) {
        throw new Error(
          `O CPF do titular e do cônjuge não podem ser iguais (${cpfTit}). Por favor, corrija o cadastro.`,
        );
      }
    }
    const dadosConjuge = casado
      ? {
          nomeConjuge:
            conjuge?.nome ??
            src?.conjuge_nome ??
            sim?.nome_conjuge ??
            part?.nomeConjuge ??
            undefined,
          cpfConjuge: soDigitos(
            conjuge?.cpf_cnpj ?? src?.conjuge_cpf ?? sim?.cpf_conjuge ?? part?.cpfConjuge,
          ),
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
            conjuge?.numero_documento ??
              src?.conjuge_numero_documento ??
              part?.numeroDocumentoConjuge,
          ),
          dataExpedicaoConjuge:
            conjuge?.data_expedicao ??
            src?.conjuge_data_expedicao ??
            part?.dataExpedicaoConjuge ??
            undefined,
          orgaoExpedidorConjuge:
            conjuge?.orgao_expedidor ??
            src?.conjuge_orgao_expedidor ??
            part?.orgaoExpedidorConjuge ??
            undefined,
          ufExpedicaoConjuge:
            conjuge?.uf_expedicao ??
            src?.conjuge_uf_expedicao ??
            part?.ufExpedicaoConjuge ??
            undefined,
          nomeProfissaoConjuge:
            textoLivreParaBanco(conjuge?.profissao) ||
            textoLivreParaBanco(src?.conjuge_profissao) ||
            textoLivreParaBanco(part?.nomeProfissaoConjuge) ||
            undefined,
          rendaConjuge:
            prop.compoe_renda_conjuge !== false
              ? (conjuge?.renda ??
                src?.conjuge_renda ??
                sim?.renda_conjuge ??
                part?.rendaConjuge ??
                undefined)
              : 0,
          nomeEmpresaProfissaoConjuge:
            textoLivreParaBanco(conjuge?.empresa) ||
            textoLivreParaBanco(src?.conjuge_empresa) ||
            textoLivreParaBanco(part?.nomeEmpresaProfissaoConjuge) ||
            undefined,
          tipoSexoConjuge:
            enumBancoId(conjuge?.tipo_sexo) ??
            (src?.conjuge_sexo
              ? String(src.conjuge_sexo).trim().charAt(0).toUpperCase()
              : undefined) ??
            enumBancoId(part?.tipoSexoConjuge) ??
            undefined,
        }
      : {};

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
    if (
      !temEnvolvido &&
      !faltaEstadoCivil &&
      !faltaUf &&
      !faltaProfissao &&
      !faltaEmpresa &&
      !faltaConjuge
    )
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
        part?.dataNascimento ??
        env?.data_nascimento ??
        src?.data_nascimento ??
        prop.data_nascimento ??
        undefined,
      tipoEstadoCivil: estadoCivil ?? undefined,
      tipoRegimeCasamento:
        exigeConjugePorEstadoCivil(estadoCivil) ||
        (part?.idBanco === TIPO_BANCO_SANTANDER && (estadoCivil === "CA" || estadoCivil === "UE"))
          ? (enumBancoId(env?.regime_casamento) ??
            enumBancoId(src?.regime_casamento) ??
            enumBancoId(part?.tipoRegimeCasamento))
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
      renda:
        part?.renda ?? env?.renda ?? src?.renda_total_declarada ?? prop.renda_total ?? undefined,
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

    // Validação OFICIAL baseada nos campos "S" do CreateParticipantRequest.
    //
    // Só vale para quem temos cadastrado localmente E que é proponente (CO/TI).
    // Sem `env` não há o que validar nem o que completar — antes passávamos
    // `{}` aqui, o que acusava os 25 campos como faltando e derrubava o envio
    // de qualquer participante criado direto na oportunidade. O vendedor (VD)
    // não é enviado por este fluxo e também não deve bloquear.
    if (env && ehProponenteEnviadoAoBanco(env)) {
      const faltantes = faltantesEnvolvido(env);
      if (faltantes.length > 0) {
        const msg = msgCadastroIncompleto(pb?.nome_banco ?? "banco", env, faltantes);
        throw new IntegracaoBancariaError(msg.texto);
      }
    }

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

export async function enviarPropostaImpl(args: EnviarArgs): Promise<EnviarResultado> {
  try {
    return await enviarPropostaImplInner(args);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[proposta.enviar] falhou", { propostaId: args.propostaId, msg });
    // Persiste o motivo no próprio registro para que o usuário veja na lista
    // (o toast pode ser perdido; o campo `ultimo_erro` fica visível).
    try {
      await args.supabase.from("propostas").update({ ultimo_erro: msg }).eq("id", args.propostaId);
      await recalcularStatusGlobalProposta(args.supabase, args.propostaId);
    } catch {}
    throw e;
  }
}

async function enviarPropostaImplInner({
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

  // Verificação de oportunidade cancelada (tipoSituacao "C")
  {
    const ctxCheck = {
      simulacao_id: prop.simulacao_id,
      proposta_id: propostaId,
      correspondente_id: prop.correspondente_id,
    };
    try {
      const resp = await chamarIntegracao<any>(
        `/oportunidade/${prop.homefin_id_oportunidade}`,
        "GET",
        undefined,
        ctxCheck,
      );
      const op = resp?.oportunidade ?? resp?.data ?? resp ?? {};
      // Comparávamos a string inteira com "C": um retorno como "Cancelada"
      // escapava daqui e só era pego mais adiante, em
      // `garantirEnderecoParticipantes`, que apenas LANÇA — com uma mensagem
      // prometendo "será criada uma nova oportunidade" que nunca acontecia.
      // Normalizando pela inicial, a recuperação abaixo volta a rodar.
      const situacao = String(op?.tipoSituacao?.id ?? op?.tipoSituacao ?? op?.situacao ?? "")
        .trim()
        .toUpperCase()
        .charAt(0);

      if (situacao === "C") {
        // CORREÇÃO: Em vez de apenas travar, tentamos criar uma oportunidade NOVA
        // para reaproveitar os dados e não bloquear o usuário.
        try {
          const { enviarSimulacaoImpl } = await import("../simulacao/enviar.server");
          const { oportunidade_id: novoIdOp } = await enviarSimulacaoImpl({
            simulacaoId: prop.simulacao_id,
            userId,
            ip: "127.0.0.1",
            supabase,
            bancoIds: [prop.banco_id],
          });

          if (novoIdOp) {
            await supabase
              .from("propostas")
              .update({ homefin_id_oportunidade: novoIdOp } as any)
              .eq("id", propostaId);

            await supabase.from("proposta_historico").insert({
              proposta_id: propostaId,
              tipo_evento: "sincronizacao",
              descricao: `A oportunidade bancária anterior (${prop.homefin_id_oportunidade}) estava cancelada no banco. Uma nova oportunidade (${novoIdOp}) foi criada automaticamente para este envio.`,
            });

            // Atualiza a variável local para o restante do fluxo
            prop.homefin_id_oportunidade = novoIdOp;
          }
        } catch (errNova) {
          throw new IntegracaoBancariaError(
            "A oportunidade no banco foi cancelada e não foi possível criar uma nova automaticamente. Gere uma nova simulação manual para enviar esta proposta.",
          );
        }
      }
    } catch (e) {
      if (e instanceof IntegracaoBancariaError) throw e;
    }
  }

  let statusAtual = prop.status as PropostaStatus;

  // Limpa mensagens de erro e protocolos de tentativas anteriores para garantir
  // que a mensagem exibida reflita a causa real desta tentativa.
  await supabase
    .from("propostas")
    .update({
      ultimo_erro: null,
      detalhe_status_atual: null,
    } as any)
    .eq("id", propostaId);

  // Primeiro envio = ainda em rascunho ou após um erro de envio.
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

  // Bancos a enviar: por linha (bancoId) ou todos os selecionados ainda não enviados.
  let query = supabase.from("proposta_bancos").select("*").eq("proposta_id", propostaId);

  if (bancoId && bancoId !== "todos") {
    // 1. CRÍTICO — O BOTÃO AINDA NÃO ENVIA (CORREÇÃO)
    // Os chamadores passam banco_id (ex: 'itau', 'santander') ou o ID da linha (uuid).
    // Filtramos corretamente para evitar o falso positivo "bancos.length === 0".
    query = query.or(`banco_id.eq.${bancoId},id.eq.${bancoId}`);
  } else {
    query = query.eq("selecionado", true);
  }

  const { data: bancosSel } = await query;

  if (bancoId && (!bancosSel || bancosSel.length === 0)) {
    throw new Error("Banco não encontrado nesta proposta.");
  }

  // Separação de mensagens conforme solicitado:
  if (bancoId && bancosSel && bancosSel.length > 0) {
    if (bancoJaEnviado(bancosSel[0] as any)) {
      throw new Error("Este banco já foi enviado.");
    }
  }

  const bancos = (bancosSel ?? []).filter((b: any) => !bancoJaEnviado(b));
  if (bancos.length === 0) {
    throw new Error(
      primeiroEnvio
        ? "Selecione ao menos um banco antes de enviar."
        : "Nenhum banco novo selecionado. Selecione outro banco para enviar.",
    );
  }

  // Reenvio (ou primeiro envio) limpa o resíduo da tentativa anterior — tanto
  // na proposta quanto nas LINHAS DE BANCO que estão sendo reenviadas. Sem
  // isso, `propostas.status` fica preso em `credito_recusado`/`erro_envio` de
  // uma tentativa antiga e o protocolo velho continua gravado.
  await supabase
    .from("proposta_bancos")
    .update({
      status_banco: "aguardando",
      situacao_banco: "nao_enviado",
      mensagem_banco: null,
      numero_proposta_banco: null,
    } as any)
    .in(
      "id",
      (bancos as any[]).map((b) => b.id),
    );

  const patchProposta: Record<string, any> = {
    enviada_em: new Date().toISOString(),
    ip_consentimento: ip,
    ultimo_erro: null,
    detalhe_status_atual: null,
  };

  // O status também é resíduo: uma proposta em reenvio não pode continuar
  // marcada como recusada/erro da tentativa anterior.
  if (
    primeiroEnvio ||
    prop.status === "erro_envio" ||
    prop.status === "credito_recusado" ||
    prop.status === "rascunho" ||
    prop.status === "aguardando_envio"
  ) {
    patchProposta.status = "enviada_banco";
  }

  await supabase.from("propostas").update(patchProposta).eq("id", propostaId);

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
    // Garantia de que prazo, valor do imóvel e financiamento não são zero
    const valImovel = num(prop.valor_imovel);
    const valFinan = num(prop.valor_financiamento);
    const pr = num(prop.prazo);
    if (!(valImovel > 0) || !(valFinan > 0) || !(pr > 0)) {
      throw new Error(
        `A proposta não pode ser enviada com valor do imóvel, financiamento ou prazo zerados (${b.nome_banco}).`,
      );
    }

    try {
      await garantirEnderecoParticipantes({
        prop,
        pb: b,
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

      // No POST de inclusão a API pode devolver `retornoIntegracao` com uma
      // mensagem informativa (validação, aviso do banco) MESMO quando a
      // proposta foi aceita e ganhou um `tipoSituacao` real (A/C/R/N). OU
      // quando o banco já devolveu um protocolo/oportunidade.
      //
      // Regra oficial (swagger Homefin): só `tipoSituacao` ∈ {P,E} sem
      // qualquer protocolo devolvido representa "erro ao enviar proposta".
      // Se o banco devolveu numeroPropostaBanco/codigoPropostaBanco/
      // codigoOportunidadeBanco, a proposta CHEGOU ao banco — não é erro
      // de envio, mesmo com mensagem em `retornoIntegracao`. A mensagem
      // é preservada em `mensagem_banco` apenas como observação.
      const situacaoTipoResp = String(resp?.tipoSituacao ?? "")
        .toUpperCase()
        .charAt(0);
      const erroBanco =
        extrairErroRetorno(resp?.retornoIntegracao, { codigoApenasComoErro: false }) ??
        extrairErroRetorno(resp?.descricaoRespostaBanco?.retornoIntegracao, {
          codigoApenasComoErro: false,
        });
      const temProtocoloBanco = Boolean(
        numeroPropostaBancoReal(resp) ?? referenciaIntegracaoBanco(resp),
      );
      const falhaEnvioReal =
        !temProtocoloBanco &&
        (situacaoTipoResp === "P" || situacaoTipoResp === "E" || ehFalhaIntegracaoBanco(resp));
      if (erroBanco && falhaEnvioReal) {
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
        mensagem_banco: erroBanco ? sanitizarMensagemErro(erroBanco) : null,
        raw_response: resp,
      };
      // situacao_banco é um enum interno (nao_enviado/em_analise/condicionado/
      // aprovado/recusado/cancelado). O tipoSituacao do banco vem como código
      // cru (S/P/N/A/R) — precisa ser mapeado, senão o valor não bate com o
      // <Select> da tela e a linha continua exibindo "Não enviado".
      patchOk.situacao_banco =
        mapa.banco === "erro"
          ? "em_analise"
          : situacaoBancoDeTipo(situacaoTipo, resp?.codigoSituacaoBanco, false, resp);
      const numeroExtraido = numeroPropostaBancoReal(resp);
      const referenciaBanco = referenciaIntegracaoBanco(resp);
      // Um mesmo protocolo não pode existir em duas propostas / bancos
      // diferentes. Se acontecer, é vazamento de dado — loga e descarta.
      let numeroBanco: string | null = numeroExtraido;
      if (numeroExtraido) {
        const { data: colisao } = await supabase
          .from("proposta_bancos")
          .select("id, proposta_id, banco_id")
          .eq("numero_proposta_banco", numeroExtraido)
          .neq("id", b.id)
          .limit(1);
        if (colisao && colisao.length > 0) {
          console.error("[proposta] protocolo duplicado entre bancos/propostas — descartado", {
            numero: numeroExtraido,
            atual: b.id,
            existente: colisao[0],
          });
          numeroBanco = null;
        }
      }
      // Sem protocolo devolvido pela API DESTA proposta/banco → campo NULO.
      patchOk.numero_proposta_banco = numeroBanco;
      if (!numeroBanco && referenciaBanco && numeroAtualEhReferenciaTecnica(b, resp)) {
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
      const originalMsg = e instanceof Error ? e.message : "Falha ao enviar ao banco.";
      const msg = sanitizarMensagemErro(originalMsg);

      // Detecção de erro de limite do Santander (INT-SANTANDER-RANGE)
      const ehErroLimiteSantander =
        b.banco_id === TIPO_BANCO_SANTANDER &&
        (originalMsg.includes("INT-SANTANDER-RANGE") || originalMsg.includes("financingAmount"));

      // 1. "erro_envio" EM PROPOSTA QUE O BANCO RECEBEU
      // Se houve um erro de timeout (fetch/timeout) APÓS o POST ter sido enviado,
      // ou se o erro indica que a leitura falhou mas o envio pode ter ocorrido.
      // Aqui, se falhou no catch do chamarIntegracao de inclusão, geralmente é erro de envio real.
      // Mas se o erro for timeout, usamos "aguardando_retorno" (mapeado como 'enviada' localmente).
      const ehTimeout =
        originalMsg.includes("timeout") ||
        originalMsg.includes("deadline") ||
        originalMsg.includes("fetch");

      const statusFinalBanco = ehErroLimiteSantander ? "recusada" : ehTimeout ? "enviada" : "erro";
      const situacaoFinalBanco = ehErroLimiteSantander
        ? "recusado"
        : ehTimeout
          ? "em_analise"
          : "nao_enviado";
      const msgBanco = ehTimeout
        ? "Envio iniciado, aguardando confirmação do banco (timeout na leitura)."
        : msg;

      await supabase
        .from("proposta_bancos")
        .update({
          status_banco: statusFinalBanco,
          mensagem_banco: msgBanco,
          situacao_banco: situacaoFinalBanco,
        } as any)
        .eq("id", b.id);

      return {
        banco_id: b.banco_id,
        nome_banco: b.nome_banco,
        status: statusFinalBanco,
        mensagem: msgBanco,
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
    else if (r.erro_estruturado?.codigo === "CADASTRO_INCOMPLETO") {
      // Se parou por cadastro incompleto, garante que o status global não vire "erro_envio"
      // Se já estava em erro_envio, volta para aguardando_envio
      if (statusAtual === "erro_envio") statusAtual = "aguardando_envio";
    }
  }

  // ---- 3) Recálculo do status global (propostas.status) a partir dos bancos ----
  // FONTE ÚNICA DE VERDADE: propostas.status é DERIVADO do estado atual de
  // proposta_bancos através da função centralizada.
  const novoStatusGlobal =
    (await recalcularStatusGlobalProposta(supabase, propostaId)) || statusAtual;

  // Verificação de integridade (Log de divergência)
  if (sucesso > 0 && novoStatusGlobal === "credito_recusado") {
    console.warn(
      `[proposta] Divergência detectada no envio: PRO-${propostaId} marcada como recusada mesmo com ${sucesso} bancos em processamento.`,
    );
  }

  // `propostas.ultimo_erro` é apenas o espelho das linhas de banco desta
  // tentativa — nunca resíduo de tentativas anteriores. Isso elimina as
  // mensagens contraditórias (cabeçalho com erro antigo x banco OK).
  const errosDestaTentativa = resultados
    .filter((r) => r.status === "erro")
    .map((r) => `${r.nome_banco ?? "Banco"}: ${r.mensagem ?? "falha ao enviar"}`);

  const patchFinal: Record<string, any> = {
    ultimo_erro: errosDestaTentativa.length > 0 ? errosDestaTentativa.join(" | ") : null,
    status: novoStatusGlobal,
  };

  await supabase
    .from("propostas")
    .update(patchFinal as any)
    .eq("id", propostaId);

  await supabase.from("proposta_historico").insert({
    proposta_id: propostaId,
    tipo_evento:
      sucesso > 0
        ? "enviada_ao_banco"
        : patchFinal.status === "enviada_banco"
          ? "sincronizacao"
          : "erro_envio",
    descricao:
      sucesso > 0
        ? "Proposta enviada ao banco"
        : patchFinal.status === "enviada_banco"
          ? "Envio iniciado (timeout na leitura)"
          : "Falha ao enviar proposta ao banco",
    status_novo: novoStatusGlobal,
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
    payloadNovo: { status: novoStatusGlobal, bancos: resultados.length },
  });

  const inicioPolling = Date.now();
  const timeoutsBackoff = [2000, 4000, 8000, 16000, 32000];
  let tentativas = 0;

  while (Date.now() - inicioPolling < 240000) {
    const waitTime = timeoutsBackoff[Math.min(tentativas, timeoutsBackoff.length - 1)];
    await new Promise((r) => setTimeout(r, waitTime));
    tentativas++;

    const res = await sincronizarPropostaIndividualImpl({ propostaId, userId, supabase });

    // Desfecho definitivo: aprovado, recusado ou cancelado encerra o polling
    if (["credito_aprovado", "credito_recusado", "cancelada"].includes(res.status)) {
      break;
    }
  }

  const finalStatus = await recalcularStatusGlobalProposta(supabase, propostaId);
  return { status: finalStatus ?? novoStatusGlobal, bancos: resultados };
}

/**
 * Sincroniza uma proposta específica consultando a API do provedor.
 * Chamada pelo polling de envio e pelo botão de "Sincronizar" na UI.
 */
export async function sincronizarPropostaIndividualImpl({
  propostaId,
  userId,
  supabase,
}: {
  propostaId: string;
  userId: string;
  supabase: SupabaseClient<any, any, any>;
}): Promise<{ status: PropostaStatus; etapa: string | null; atualizado: boolean }> {
  return sincronizarPropostaImpl({ propostaId, userId, supabase }) as any;
}

export async function sincronizarPropostasAtivas({
  data,
}: {
  data: { limite?: number };
}): Promise<void> {
  // Chamado via cron/lote — implementado em propostas.functions.ts
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
  let algumFalhaIntegracao = false;
  const errosBanco: string[] = [];
  const bancosComFalhaIntegracao: string[] = [];
  let simEscolhida: any = null;
  let numeroPropostaBanco: string | null = null;

  const patchesBanco: Array<Record<string, unknown>> = [];
  for (const pb of (bancosProp ?? []) as any[]) {
    const sim = escolherSimulacaoBanco(pb, simulacoes);
    if (!sim) continue;

    let erroMsg = extrairErroRetorno(
      sim.retornoIntegracao ?? sim.descricaoRespostaBanco?.retornoIntegracao,
    );

    // Falha/erro de integração: P (Pendente) sem evidência de envio real ou
    // E (Erro) técnico/validação. Não converter esses retornos em sucesso.
    // IMPORTANTE: se localmente o banco já foi confirmado como enviado
    // (status_banco em enviada/em_analise/aprovada/condicionada/recusada, ou
    // já há protocolo do banco gravado), P/E no polling é apenas leitura
    // transitória do Homefin (a inclusão acabou de acontecer e o snapshot da
    // simulação ainda não propagou). No caso do Itaú, ignoramos P/E para evitar
    // "recusa fantasma" ou status de erro enquanto o banco ainda processa.
    // Isso garante que o status permaneça em "Enviada" até que um retorno real chegue.
    const STATUS_BANCO_CONFIRMADO = new Set([
      "enviada",
      "em_analise",
      "aprovada",
      "condicionada",
      "recusada",
      "recusado",
    ]);
    const jaConfirmadoLocal =
      STATUS_BANCO_CONFIRMADO.has(String(pb.status_banco ?? "")) ||
      Boolean(pb.numero_proposta_banco);
    const falhaIntegracao = ehFalhaIntegracaoBanco(sim) && !jaConfirmadoLocal;
    if (falhaIntegracao) {
      erroMsg = MSG_FALHA_INTEGRACAO;
      algumFalhaIntegracao = true;
      bancosComFalhaIntegracao.push(pb.nome_banco ?? "Banco");
    }
    const mapa = statusInternoBanco(
      sim.tipoSituacao,
      Boolean(erroMsg),
      sim.codigoSituacaoBanco,
      sim,
    );

    if (mapa.proposta === "credito_aprovado") algumAprovado = true;
    else if (mapa.proposta === "em_analise_credito") algumEmAnalise = true;
    else if (mapa.proposta === "credito_recusado") algumRecusado = true;
    if (mapa.banco === "erro") {
      algumErro = true;
      if (erroMsg)
        errosBanco.push(`${pb.nome_banco ?? "Banco"}: ${sanitizarMensagemErro(erroMsg)}`);
    }
    if (sim.bancoEscolhido === "S" || mapa.proposta === "credito_aprovado") simEscolhida = sim;

    // Nunca regride um banco já confirmado localmente para "erro" por leitura
    // transitória do Homefin: preserva o status anterior se o polling voltou
    // vazio/P sem novo desfecho.
    const statusBancoFinal =
      jaConfirmadoLocal && (mapa.banco === "erro" || !mapa.banco)
        ? String(pb.status_banco)
        : mapa.banco;
    const patchBanco: Record<string, unknown> = {
      id: pb.id,
      status_banco: statusBancoFinal,
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
    // Em falha de integração, NUNCA gravar protocolo.
    // Buscamos se existe log de sucesso 2xx para esta proposta
    const { count: countEnvio } = await supabase
      .from("proposta_logs_homefin")
      .select("id", { count: "exact", head: true })
      .eq("proposta_id", propostaId)
      .like("endpoint", "%/incluir-proposta-integracao")
      .gte("status_http", 200)
      .lt("status_http", 300);

    const enviouReal = (countEnvio ?? 0) > 0;
    const numeroReal = falhaIntegracao ? null : numeroPropostaBancoReal(sim, enviouReal);
    const refIntegracao = referenciaIntegracaoBanco(sim);

    if (falhaIntegracao) {
      patchBanco.numero_proposta_banco = null;
    } else {
      patchBanco.referencia_integracao = refIntegracao;
      if (numeroReal) {
        // Um mesmo protocolo em duas linhas de banco/propostas diferentes é bug
        // de vazamento — loga e não propaga.
        const { data: colisao } = await supabase
          .from("proposta_bancos")
          .select("id, proposta_id, banco_id")
          .eq("numero_proposta_banco", numeroReal)
          .neq("id", pb.id)
          .limit(1);
        if (colisao && colisao.length > 0) {
          console.error("[proposta] protocolo duplicado entre bancos/propostas — descartado", {
            numero: numeroReal,
            atual: pb.id,
            existente: colisao[0],
          });
          patchBanco.numero_proposta_banco = null;
        } else {
          patchBanco.numero_proposta_banco = numeroReal;
          if (
            !numeroPropostaBanco ||
            sim.bancoEscolhido === "S" ||
            mapa.proposta === "credito_aprovado"
          ) {
            numeroPropostaBanco = numeroReal;
          }
        }
      } else if (numeroAtualEhReferenciaTecnica(pb, sim)) {
        patchBanco.numero_proposta_banco = null;
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
    patchesBanco.push(patchBanco);
  }
  // Persistência em lote — reduz N updates sequenciais a um único round-trip.
  if (patchesBanco.length > 0) {
    await supabase.from("proposta_bancos").upsert(patchesBanco as any);
  }

  // ---- 1.5) Recálculo do status global (propostas.status) a partir dos bancos ----
  // FONTE ÚNICA DE VERDADE: propostas.status é DERIVADO do estado atual de
  // proposta_bancos através da função centralizada.
  const statusBancos = await recalcularStatusGlobalProposta(supabase, propostaId);

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
    // FONTE ÚNICA DE VERDADE: `propostas.status` é DERIVADO do estado atual de
    // `proposta_bancos` (statusBancos) através da função centralizada.
    let derivado: PropostaStatus | null = statusBancos;

    // Verificação de integridade (Log de divergência pós-polling)
    if (derivado === "credito_recusado" && (algumAprovado || algumEmAnalise)) {
      console.warn(
        `[proposta] Divergência detectada no polling: PRO-${propostaId} derivou 'recusado' mas possui bancos aprovados/em análise.`,
      );
    }

    // Funil/atividades só podem AVANÇAR além do desfecho de crédito
    // (documentos → engenharia → jurídica → contrato). Nunca contradizem os
    // bancos em relação ao desfecho de crédito.
    const base = derivado ?? (prop.status as PropostaStatus);
    let melhorIdx = ORDEM_STATUS.indexOf(base);
    for (const c of [statusAtividade.status, statusEtapa]) {
      if (!c) continue;
      const idx = ORDEM_STATUS.indexOf(c);
      if (idx > melhorIdx) {
        melhorIdx = idx;
        derivado = c;
      }
    }

    // Recusa sinalizada pelo funil/atividade quando os bancos ainda não têm
    // desfecho próprio (credito_recusado não pertence à ORDEM_STATUS).
    if (
      !statusBancos &&
      (statusEtapa === "credito_recusado" || statusAtividade.status === "credito_recusado")
    ) {
      derivado = "credito_recusado";
    }

    // Falha de integração sem nenhum desfecho real de crédito: erro_envio para
    // habilitar o reenvio (não é recusa de crédito).
    if (
      algumFalhaIntegracao &&
      !algumAprovado &&
      !algumEmAnalise &&
      !algumRecusado &&
      (derivado == null || ORDEM_STATUS.indexOf(derivado) <= ORDEM_STATUS.indexOf("enviada_banco"))
    ) {
      derivado = "erro_envio";
    }

    novoStatus = derivado;
  }

  // ---- 2.5) Recálculo Final e Sincronização de Status Global ----
  const statusDefinitivoBancos = await recalcularStatusGlobalProposta(supabase, propostaId);
  const statusEfetivo = (statusDefinitivoBancos ?? novoStatus ?? prop.status) as PropostaStatus;

  // ---- Propaga o desfecho da proposta para as linhas de banco ----
  // A lista de propostas exibe proposta_bancos.status_banco. Quando o desfecho
  // (recusa/aprovação/cancelamento) vem da etapa/atividade da oportunidade e não
  // do snapshot da simulação, as linhas de banco ficavam presas em "em_analise"
  // e a lista mostrava um status diferente do detalhe. Aqui alinhamos os dois.
  const DESFECHO_BANCO: Partial<Record<PropostaStatus, { status: string; situacao: string }>> = {
    credito_recusado: { status: "recusada", situacao: "recusado" },
    credito_aprovado: { status: "aprovada", situacao: "aprovado" },
    cancelada: { status: "cancelada", situacao: "cancelado" },
  };
  const desfechoBanco = DESFECHO_BANCO[statusEfetivo];
  const statusBancoDesfecho = desfechoBanco?.status;

  if (statusBancoDesfecho) {
    const patchesById = new Map(patchesBanco.map((p) => [String(p.id), p]));
    const idsDesatualizados = ((bancosProp ?? []) as any[])
      .filter((pb) => {
        const atual = String(
          (patchesById.get(String(pb.id))?.status_banco as string) ?? pb.status_banco ?? "",
        );
        return atual !== statusBancoDesfecho && atual !== "erro";
      })
      .map((pb) => pb.id);
    if (idsDesatualizados.length > 0) {
      await supabase
        .from("proposta_bancos")
        .update({ status_banco: statusBancoDesfecho, situacao_banco: desfechoBanco!.situacao })
        .in("id", idsDesatualizados);
    }
  }

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
    status: statusEfetivo,
    detalhe_status_atual: statusAtividade.detalhe ?? ROTULO_DETALHE[statusEfetivo] ?? nomeEtapa,
    ultima_sincronizacao_em: new Date().toISOString(),
  };

  const atualizado =
    statusEfetivo !== prop.status || patch.detalhe_status_atual !== prop.detalhe_status_atual;
  if (atualizado) {
    patch.status_atualizado_em = new Date().toISOString();
    await supabase
      .from("propostas")
      .update(patch as any)
      .eq("id", propostaId);

    // Verificação de integridade pós-gravação
    const { data: conferir } = await supabase
      .from("propostas")
      .select("status")
      .eq("id", propostaId)
      .single();
    if (conferir?.status !== statusEfetivo) {
      console.error(
        `[proposta] FALHA CRÍTICA: Status da PRO-${propostaId} deveria ser ${statusEfetivo} mas está ${conferir?.status} após sync.`,
      );
    }
  }

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
  } else if (
    numeroAtualEhReferenciaTecnica({ numero_proposta_banco: prop.numero_proposta_banco }, escolhida)
  ) {
    patch.numero_proposta_banco = null;
  }
  const referenciaEscolhida = referenciaIntegracaoBanco(escolhida);
  if (op?.codigoOportunidadeBanco || referenciaEscolhida)
    patch.codigo_oportunidade_homefin = op?.codigoOportunidadeBanco ?? referenciaEscolhida;
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
        const sit = String(a?.tipoSituacao ?? "")
          .toUpperCase()
          .charAt(0);
        const rotuloSit = sit === "C" ? "Concluída" : sit === "E" ? "Em andamento" : "Não iniciada";
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
      // Antes: apagava TODOS os follow-ups do banco e reinseria a lista inteira
      // a cada sincronização — que roda de 2 em 2 minutos por proposta ativa.
      // Resultado: 1.068.690 inserts para 3.906 linhas vivas, tabela inchada de
      // tuplas mortas e os ids trocando a cada ciclo.
      //
      // O retorno do banco é quase sempre idêntico ao da rodada anterior.
      // Comparamos antes de escrever e, se nada mudou, não tocamos na tabela.
      const { data: atuais } = await supabase
        .from("proposta_followups")
        .select("titulo, comentario, created_at")
        .eq("proposta_id", propostaId)
        .eq("tipo", "banco");

      const assinatura = (l: { titulo: any; comentario: any; created_at: any }) =>
        `${l.titulo ?? ""}|${l.comentario ?? ""}|${new Date(l.created_at).getTime()}`;
      const antes = new Set((atuais ?? []).map(assinatura));
      const depois = new Set(atvBanco.map(assinatura));
      const mudou =
        antes.size !== depois.size || [...depois].some((chave) => !antes.has(chave));

      if (mudou) {
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

// Ciclo de vida da proposta
export {
  cancelarPropostaHomefinImpl,
  cancelarOportunidadeHomefinGenerico,
  enviarFollowupHomefinImpl,
} from "./enviar/lifecycle.server";
