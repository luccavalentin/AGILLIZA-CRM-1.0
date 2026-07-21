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
];

/** Deriva o status interno a partir do nome da etapa ativa retornada pelo banco. */
function statusDaEtapa(nomeEtapa: string | null): PropostaStatus | null {
  if (!nomeEtapa) return null;
  const n = nomeEtapa.toLowerCase();
  // Recusa/negativa de crédito encerra o fluxo — checar ANTES de "aprov"/"análise"
  // para o status não ficar preso em "em_analise_credito" (polling infinito).
  if (
    n.includes("recus") ||
    n.includes("negad") ||
    n.includes("negat") ||
    n.includes("reprov") ||
    n.includes("indefer") ||
    n.includes("nao aprov") ||
    n.includes("não aprov")
  )
    return "credito_recusado";
  if (n.includes("contrato") || n.includes("registr")) return "contrato_emitido";
  if (n.includes("juríd") || n.includes("jurid") || n.includes("emiss"))
    return "analise_juridica";
  if (n.includes("vistoria") || n.includes("engenharia") || n.includes("avaliaç"))
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
    numero_proposta_banco?: string | null;
    mensagem?: string;
  }[];
}

function soDigitos(v: unknown): string | undefined {
  const s = String(v ?? "").replace(/\D/g, "");
  return s.length ? s : undefined;
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

/**
 * Detecta o cenário em que a integração devolveu "erro" mas a proposta
 * NUNCA foi de fato efetivada na esteira do banco (falha de integração).
 *
 * Docs oficiais (swagger Homefin) — tipoSituacao:
 *   S = Sem Integração · P = Erro ao Enviar Proposta · N = Em Análise ·
 *   A = Crédito Aprovado · R = Crédito Recusado.
 *
 * Regras:
 *  - "R" (Recusa) é decisão REAL de crédito — nunca é falha de integração.
 *  - Só considera falha quando tipoSituacao ∈ {"P","E"} (erro ao enviar).
 *  - Se o banco já devolveu `codigoOportunidadeBanco` (ou número real de
 *    proposta), a proposta CHEGOU no banco (mesmo que Bradesco tenha
 *    devolvido "P" no primeiro retorno) — não é falha de integração.
 *  - Sem token do banco (`codigoSimulacaoBanco`), sem `retornoIntegracao`
 *    e com `codigoSituacaoBanco` vazio ou de fase de simulação: falha.
 */
export function ehFalhaIntegracaoBanco(sim: any): boolean {
  const tipo = String(sim?.tipoSituacao ?? "").toUpperCase().charAt(0);
  if (tipo !== "P" && tipo !== "E") return false;
  // Se o banco devolveu um identificador da oportunidade/proposta, a
  // proposta foi efetivamente recebida na esteira do banco. Tratamos como
  // "em análise" (retorno pode demorar — ex.: Bradesco tem SLA de 15 min).
  const opBanco = String(sim?.codigoOportunidadeBanco ?? "").trim();
  if (opBanco) return false;
  const numeroReal = numeroPropostaBancoReal(sim);
  if (numeroReal) return false;
  const codigoSim = String(sim?.codigoSimulacaoBanco ?? "").trim();
  if (codigoSim) return false;
  const retorno = sim?.retornoIntegracao ?? sim?.descricaoRespostaBanco?.retornoIntegracao;
  if (retorno != null && String(retorno).trim() !== "") return false;
  const codigoSit = String(sim?.codigoSituacaoBanco ?? "").trim();
  if (!codigoSit) return true;
  // Códigos de fase de simulação (ex.: "01.03", "1.03") — não são decisão de crédito
  return /^0?1\.\d/.test(codigoSit);
}


const MSG_FALHA_INTEGRACAO =
  "A proposta não foi efetivada no banco (falha na integração). Reenvie para retomar o processo.";

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
  pb,
  propostaId,
  ctx,
  supabase,
}: {
  idOportunidade: string;
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
  } catch {
    // Sem informação da simulação, segue com o id atual — o próprio POST vai falhar caso já esteja consumida.
    return Number(idAtual);
  }
  if (!sim) return Number(idAtual);
  const tipo = String(sim?.tipoSituacao ?? "").toUpperCase().charAt(0);
  if (tipo !== "R" && tipo !== "A") return Number(idAtual);

  // Simulação já consumida: criar nova com os mesmos parâmetros.
  const idBanco = sim?.banco?.idBanco ?? sim?.idBanco;
  const novoPayload: Record<string, unknown> = {
    valorImovel: sim?.valorImovel,
    valorFinanciamento: sim?.valorFinanciamento,
    prazo: sim?.prazo,
    codigoSistemaAmortizacaoBanco: sim?.codigoSistemaAmortizacaoBanco ?? { id: "S" },
    banco: idBanco ? { idBanco } : sim?.banco,
    fgFinanciarDespesas: sim?.fgFinanciarDespesas,
    valorDespesasFinanciadas: sim?.valorDespesasFinanciadas,
    valorTotalFinanciamento: sim?.valorTotalFinanciamento,
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


/**
 * Sincroniza o bloco de cônjuge (nome/CPF/renda/estado civil/data nascimento)
 * na OPORTUNIDADE. Sem isso, oportunidades criadas quando o titular ainda não
 * tinha cônjuge cadastrado continuam sem o bloco, e alguns bancos (Itaú)
 * rejeitam a inclusão com "spouse: O campo deve ser informado".
 */
async function sincronizarConjugeOportunidade({
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
  let sim: any = null;
  if (prop.simulacao_id) {
    const { data } = await supabase
      .from("simulacoes")
      .select("possui_conjuge, nome_conjuge, cpf_conjuge, email_conjuge, celular_conjuge, renda_conjuge, data_nascimento_conjuge, estado_civil, estado_civil_conjuge, compoe_renda")
      .eq("id", prop.simulacao_id)
      .maybeSingle();
    sim = data;
  }
  const estadoCivil = sim?.estado_civil ?? prop.estado_civil ?? null;
  const casado =
    Boolean(sim?.possui_conjuge) || ["CA", "UE"].includes(String(estadoCivil ?? ""));
  if (!casado) return;
  const nome = sim?.nome_conjuge ?? prop.nome_conjuge;
  const cpf = soDigitos(sim?.cpf_conjuge ?? prop.cpf_conjuge);
  if (!nome && !cpf) return;
  const payload: Record<string, unknown> = {
    tipoEstadoCivil: estadoCivil ? { id: estadoCivil } : undefined,
    fgCompoeRenda: Boolean(sim?.compoe_renda),
    nomeConjuge: nome ?? undefined,
    cpfConjuge: cpf ?? undefined,
    emailConjuge: sim?.email_conjuge ?? undefined,
    celularConjuge: soDigitos(sim?.celular_conjuge),
    rendaConjuge: sim?.renda_conjuge ?? undefined,
    dataNascimentoConjuge: sim?.data_nascimento_conjuge ?? undefined,
    tipoEstadoCivilConjuge: sim?.estado_civil_conjuge
      ? { id: sim.estado_civil_conjuge }
      : estadoCivil
        ? { id: estadoCivil }
        : undefined,
  };
  try {
    await chamarIntegracao<any>(`/oportunidade/${idOportunidade}`, "PUT", payload, ctx);
  } catch (e) {
    console.warn(
      "Falha ao sincronizar cônjuge na oportunidade (PUT).",
      e instanceof Error ? e.message : String(e),
    );
  }
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
  const ESTADOS_COM_CONJUGE = new Set(["CA", "UE"]);

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

    // Dados do cônjuge — obrigatórios em alguns bancos quando o proponente
    // principal está casado ou em união estável. Sempre reenviamos, pois a
    // oportunidade pode ter sido criada sem esses campos.
    const casado =
      ehPrincipal &&
      (Boolean(sim?.possui_conjuge) || ESTADOS_COM_CONJUGE.has(String(estadoCivil ?? "")));
    const dadosConjuge = casado
      ? {
          nomeConjuge:
            part?.nomeConjuge ?? sim?.nome_conjuge ?? env?.nome_conjuge ?? src?.nome_conjuge ?? undefined,
          cpfConjuge:
            soDigitos(part?.cpfConjuge ?? sim?.cpf_conjuge ?? env?.cpf_conjuge ?? src?.cpf_conjuge),
          dataNascimentoConjuge:
            part?.dataNascimentoConjuge ??
            sim?.data_nascimento_conjuge ??
            env?.data_nascimento_conjuge ??
            src?.data_nascimento_conjuge ??
            undefined,
          tipoEstadoCivilConjuge:
            part?.tipoEstadoCivilConjuge ?? sim?.estado_civil_conjuge ?? estadoCivil ?? undefined,
          rendaConjuge:
            part?.rendaConjuge ?? sim?.renda_conjuge ?? env?.renda_conjuge ?? undefined,
        }
      : {};

    // Chamamos a API quando falta estado civil, UF, profissão, empresa ou dados
    // de cônjuge (campos que mais derrubam a validação dos bancos). Se todos já
    // estão presentes no participante, nada a fazer.
    const faltaEstadoCivil = !(part?.tipoEstadoCivil && String(part.tipoEstadoCivil).trim());
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
      utilizaFgts: part?.utilizaFgts ?? Boolean(env?.utiliza_fgts) ?? undefined,
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

  // Alguns bancos (ex.: Itaú) rejeitam a proposta quando o proponente está sem
  // endereço (proponents[0].address.state) OU quando o bloco de cônjuge não
  // acompanha uma oportunidade cujo titular é casado (erro "spouse: O campo
  // deve ser informado"). Sincronizamos ambos ANTES de incluir as propostas.
  await sincronizarConjugeOportunidade({
    prop,
    idOportunidade: prop.homefin_id_oportunidade,
    ctx,
    supabase,
  });
  await garantirEnderecoParticipantes({ prop, idOportunidade: prop.homefin_id_oportunidade, ctx, supabase });

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
      // Antes de reenviar, verifica se a simulação vinculada ao banco já foi
      // "consumida" por uma tentativa anterior (tipoSituacao "R" ou "A"). O
      // provedor não permite reprocessar a mesma simulação: nesse caso criamos
      // uma NOVA simulação com os mesmos parâmetros e passamos a usá-la.
      const idSimulacaoUsar = await renovarSimulacaoSeConsumida({
        idOportunidade: prop.homefin_id_oportunidade,
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

  // Logo após enviar, faz UMA reconciliação rápida (sem esperas longas) para
  // já refletir o número/status quando o banco grava de imediato. Os casos em
  // que o banco demora são reconciliados pelo polling agendado — não vale a
  // pena travar a resposta ao usuário por vários segundos aqui.
  if (sucesso > 0) {
    try {
      const sinc = await sincronizarPropostaImpl({ propostaId, userId, supabase });
      if (sinc?.status) novoStatus = sinc.status as PropostaStatus;
    } catch (e) {
      console.error("[proposta] sincronização pós-envio falhou", e);
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

/** Rótulos amigáveis (pt-BR) para os campos que os bancos costumam recusar. */
const ROTULO_CAMPO: Record<string, string> = {
  maritalstatus: "Estado civil",
  tipoestadocivil: "Estado civil",
  name: "Nome",
  nome: "Nome",
  nomeparticipante: "Nome do participante",
  cpf: "CPF",
  cnpj: "CNPJ",
  cpfcnpj: "CPF/CNPJ",
  document: "Documento",
  numerodocumento: "Número do documento",
  orgaoexpedidor: "Órgão expedidor",
  ufexpedicao: "UF de expedição",
  dataexpedicao: "Data de expedição",
  birthdate: "Data de nascimento",
  datanascimento: "Data de nascimento",
  profession: "Profissão",
  nomeprofissao: "Profissão",
  company: "Empresa",
  nomeempresaprofissao: "Empresa",
  nomemae: "Nome da mãe",
  income: "Renda",
  renda: "Renda",
  email: "E-mail",
  phone: "Celular",
  celular: "Celular",
  cep: "CEP",
  logradouro: "Logradouro",
  numerologradouro: "Número",
  complemento: "Complemento",
  complementologradouro: "Complemento",
  bairro: "Bairro",
  municipio: "Município",
  cidade: "Cidade",
  uf: "UF",
  gender: "Sexo",
  tiposexo: "Sexo",
};

function rotularCampo(nome: unknown): string | null {
  const bruto = String(nome ?? "").trim();
  if (!bruto) return null;
  // Bancos enviam caminhos aninhados (ex.: "proponents[0].occupation.profession").
  // Usamos o último segmento, sem índices de array, para achar o rótulo.
  const folha = bruto.split(".").pop() ?? bruto;
  const chave = folha
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
  return ROTULO_CAMPO[chave] ?? folha;
}

/** Formata "campo: mensagem (valor)" incluindo campo e valor problemático. */
function formatarErroCampo(f: any): string | null {
  const msg = f?.message ?? f?.mensagem ?? f?.descricao ?? null;
  const rotulo = rotularCampo(f?.field ?? f?.fieldName ?? f?.campo ?? f?.name ?? f?.propriedade);
  const valor = f?.value ?? f?.valor ?? null;
  const sufixoValor =
    valor != null && String(valor).trim() ? ` (valor informado: "${String(valor).trim()}")` : "";
  if (msg && rotulo && !normalizarTexto(String(msg)).includes(normalizarTexto(rotulo))) {
    return `${rotulo}: ${msg}${sufixoValor}`;
  }
  if (msg) return `${msg}${sufixoValor}`;
  return rotulo;
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
        .map((f: any) => formatarErroCampo(f))
        .filter(Boolean)
        .join("; ") ||
      obj.message ||
      null
    );
  }
  const direto = obj?.message ?? obj?.erro ?? obj?.error_description ?? obj?.mensagem ?? null;
  if (direto && String(direto).trim()) return String(direto);
  const error = obj?.error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    if (Array.isArray(error.fields) && error.fields.length > 0) {
      return error.fields.map((f: any) => formatarErroCampo(f)).filter(Boolean).join("; ") || null;
    }
    if (error.message) return String(error.message);
  }
  // Alguns bancos devolvem apenas `{codigo:"121-L", mensagem:""}` — código sem
  // texto ainda indica falha na integração (a proposta não chegou ao banco).
  const codigo = obj?.codigo ?? obj?.code ?? null;
  if (codigo) {
    const c = String(codigo).trim();
    // Códigos que começam com "0"/"200"/"OK"/"SUCC" indicam sucesso.
    if (c && !/^(0+|200|ok|succ)/i.test(c)) {
      return `Falha na integração com o banco (código ${c}). A proposta não chegou a ser recebida — reenvie.`;
    }
  }
  return null;
}


/** Traduz o tipoSituacao da proposta (por banco) para status interno do banco. */
function statusInternoBanco(
  tipo: string,
  temErro: boolean,
  codigoSituacaoBanco?: string | null,
  sim?: any,
): {
  banco: string;
  proposta: PropostaStatus | "credito_recusado" | null;
} {
  if (temErro) return { banco: "erro", proposta: null };

  // Falha de integração (Bradesco: "R"/"E" sem token do banco e código de fase
  // de simulação): a proposta NÃO chegou ao banco. Trata como erro recuperável,
  // NÃO como recusa de crédito.
  if (sim && ehFalhaIntegracaoBanco(sim)) return { banco: "erro", proposta: null };

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
    case "E":
      // Docs: "P" = Erro ao Enviar Proposta. Porém, se o banco já devolveu
      // o `codigoOportunidadeBanco`, a proposta CHEGOU no banco (comum no
      // Bradesco no primeiro retorno). Tratamos como em_analise para não
      // sinalizar erro fantasma ao usuário.
      if (sim && String(sim?.codigoOportunidadeBanco ?? "").trim()) {
        return { banco: "em_analise", proposta: "em_analise_credito" };
      }
      if (sim && numeroPropostaBancoReal(sim)) {
        return { banco: "em_analise", proposta: "em_analise_credito" };
      }
      return { banco: "erro", proposta: null };

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
  sim?: any,
): string {
  const mapa = statusInternoBanco(tipo, temErro, codigoSituacaoBanco, sim);
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
  // Um envio com falha deve poder ser retentado — o número técnico eventual
  // (ex.: codigoSimulacaoBanco) não caracteriza proposta ativa no banco.
  if (String(b.status_banco ?? "") === "erro") return false;
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

/**
 * Número real da proposta no banco. Quando o banco não expõe um campo chamado
 * literalmente "número da proposta", a API devolve o identificador externo em
 * `codigoOportunidadeBanco` (código da oportunidade no banco), que é o número a
 * ser exibido para operação já enviada. Códigos de simulação continuam sendo
 * apenas referência técnica e não entram aqui.
 */
function normalizarChaveRetorno(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function buscarCampoRetorno(obj: unknown, chaves: string[], visitados = new WeakSet<object>()): string | null {
  if (obj == null) return null;
  if (typeof obj === "string") {
    const texto = obj.trim();
    if (!texto) return null;
    if (texto.startsWith("{") || texto.startsWith("[")) {
      try {
        const parsed = JSON.parse(texto);
        const achado = buscarCampoRetorno(parsed, chaves, visitados);
        if (achado) return achado;
      } catch {
        // Continua para extração por regex em strings não-JSON ou JSON malformado.
      }
    }
    for (const chave of chaves) {
      const re = new RegExp(`"?${chave}"?\\s*[:=]\\s*"?([A-Za-z0-9._/-]+)`, "i");
      const match = texto.match(re);
      if (match?.[1]) return match[1];
    }
    return null;
  }
  if (typeof obj !== "object") return null;
  if (visitados.has(obj)) return null;
  visitados.add(obj);

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const achado = buscarCampoRetorno(item, chaves, visitados);
      if (achado) return achado;
    }
    return null;
  }

  const mapaChaves = new Set(chaves.map(normalizarChaveRetorno));
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (mapaChaves.has(normalizarChaveRetorno(k)) && v != null && String(v).trim()) {
      return String(v).trim();
    }
  }
  for (const v of Object.values(obj as Record<string, unknown>)) {
    const achado = buscarCampoRetorno(v, chaves, visitados);
    if (achado) return achado;
  }
  return null;
}

/**
 * Número real da proposta no banco. A API devolve, dependendo da instituição:
 *  - `numeroPropostaBanco` / `codigoPropostaBanco` (raro, alguns bancos)
 *  - `codigoOportunidadeBanco` (Bradesco/Itaú — código da oportunidade no banco)
 *  - `codigoSimulacaoBanco` (Santander — referência oficial devolvida pelo banco)
 * Todos vêm DO banco (não são referências internas do sistema), portanto
 * qualquer um deles é um identificador válido para exibição ao usuário.
 */
function numeroPropostaBancoReal(sim: any): string | null {
  const numero = buscarCampoRetorno(sim, [
    "numeroPropostaBanco",
    "numeroProposta",
    "proposalNumber",
    "codigoPropostaBanco",
    "codigoOportunidadeBanco",
    "codigoSimulacaoBanco",
  ]);
  return numero == null || numero === "" ? null : String(numero);
}

function referenciaIntegracaoBanco(sim: any): string | null {
  const referencia = buscarCampoRetorno(sim, [
    "codigoOportunidadeBanco",
    "codigoOportunidadeBancoInterno",
    "codigoSimulacaoBanco",
  ]);
  return referencia == null || referencia === "" ? null : String(referencia);
}

function numeroBancoDaOportunidade(op: any): string | null {
  const numero = buscarCampoRetorno(op, [
    "numeroPropostaBanco",
    "numeroProposta",
    "proposalNumber",
    "codigoPropostaBanco",
    "codigoOportunidadeBanco",
    "codigoSimulacaoBanco",
  ]);
  return numero == null || numero === "" ? null : String(numero);
}

function numeroAtualEhReferenciaTecnica(pb: any, sim: any): boolean {
  const atual = String(pb?.numero_proposta_banco ?? "").trim();
  if (!atual) return false;
  // Só o `codigoOportunidadeBancoInterno` é "interno" (referência do próprio
  // sistema). Os demais campos são valores devolvidos pelo banco e devem
  // permanecer gravados.
  return [sim?.codigoOportunidadeBancoInterno]
    .filter((v) => v != null && v !== "")
    .some((v) => String(v).trim() === atual);
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
  return numeroPropostaBancoReal(sim) ?? referenciaIntegracaoBanco(sim);
}

function prioridadeSimulacao(sim: any, exata: boolean): number {
  const erroMsg = extrairErroRetorno(sim?.retornoIntegracao ?? sim?.descricaoRespostaBanco?.retornoIntegracao);
  const mapa = statusInternoBanco(sim?.tipoSituacao, Boolean(erroMsg), sim?.codigoSituacaoBanco, sim);
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
    // Se o banco já devolveu `codigoOportunidadeBanco`, a proposta CHEGOU
    // no banco. Uma mensagem transiente (ex.: aviso de validação) NÃO deve
    // ser sinalizada como "erro de envio" — o banco recebeu e vai retornar
    // decisão real (Bradesco leva ~15 min). Recusas reais (tipoSituacao "R"
    // ou códigos de recusa em codigoSituacaoBanco) continuam sendo tratadas
    // pelo mapa de status abaixo.
    const tipoSit = String(sim?.tipoSituacao ?? "").toUpperCase().charAt(0);
    if (
      erroMsg &&
      String(sim?.codigoOportunidadeBanco ?? "").trim() &&
      tipoSit !== "R"
    ) {
      erroMsg = null;
    }

    // Falha de integração (Bradesco/etc.): tipoSituacao "R"/"E" sem token real
    // do banco (codigoSimulacaoBanco), retornoIntegracao null e código apenas
    // de fase de simulação. NÃO é recusa de crédito — é falha silenciosa da
    // integração; deve virar erro visível e permitir reenvio.
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

/** ===== Envio de documentos ao banco (upload + inclusão na integração) ===== */

export interface EnviarDocumentosArgs {
  propostaId: string;
  userId: string;
  supabase: SupabaseClient<any, any, any>;
  /** IDs de cliente_documentos selecionados para envio (opcional = todos os PDFs). */
  documentoIds?: string[];
}

export interface EnviarDocumentosResultado {
  enviados: number;
  total: number;
  sucesso: { nome: string; participante?: string | null }[];
  erros: { nome: string; motivo: string }[];
}

/** Normaliza texto para comparação (sem acento, minúsculo). */
function normTexto(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export async function enviarDocumentosBancoImpl({
  propostaId,
  userId,
  supabase,
  documentoIds,
}: EnviarDocumentosArgs): Promise<EnviarDocumentosResultado> {
  const { chamarIntegracao, enviarArquivoIntegracao, sanitizarMensagemErro } = await import(
    "@/lib/simulacao/homefin.server"
  );

  const { data: prop, error } = await supabase
    .from("propostas")
    .select("id, cliente_id, correspondente_id, homefin_id_oportunidade, homefin_id_simulacao")
    .eq("id", propostaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!prop) throw new Error("Proposta não encontrada.");
  if (!prop.homefin_id_oportunidade) {
    throw new Error(
      "Proposta sem oportunidade vinculada. Envie a proposta ao banco antes de enviar os documentos.",
    );
  }

  // idSimulacao = banco escolhido/enviado (homefin_id_simulacao_banco).
  const { data: bancos } = await supabase
    .from("proposta_bancos")
    .select("homefin_id_simulacao_banco, selecionado")
    .eq("proposta_id", propostaId);
  const idSimulacao =
    (bancos ?? []).find((b: any) => b.selecionado && b.homefin_id_simulacao_banco)
      ?.homefin_id_simulacao_banco ??
    (bancos ?? []).find((b: any) => b.homefin_id_simulacao_banco)?.homefin_id_simulacao_banco ??
    prop.homefin_id_simulacao;
  if (!idSimulacao) {
    throw new Error(
      "Nenhuma simulação bancária vinculada. Selecione e envie um banco antes de enviar os documentos.",
    );
  }

  // Documentos locais (do cadastro do cliente) — só PDFs.
  let q = supabase
    .from("cliente_documentos")
    .select("id, nome_arquivo, tipo_documento, categoria, storage_path, mime_type")
    .eq("cliente_id", prop.cliente_id);
  if (documentoIds && documentoIds.length > 0) q = q.in("id", documentoIds);
  const { data: docsRaw, error: docsErr } = await q;
  if (docsErr) throw new Error(docsErr.message);
  const docs = (docsRaw ?? []).filter((d: any) => {
    const isPdf =
      (d.mime_type && String(d.mime_type).includes("pdf")) ||
      String(d.nome_arquivo ?? "").toLowerCase().endsWith(".pdf");
    return isPdf && d.storage_path;
  });
  if (docs.length === 0) {
    throw new Error("Nenhum documento em PDF disponível para enviar ao banco.");
  }

  const ctx = {
    proposta_id: propostaId,
    correspondente_id: prop.correspondente_id,
  };

  // 1) Obtém o checklist de documentos esperados pelo banco.
  //    A chamada de inclusão retorna a lista de slots (sucesso/error) com seus ids.
  const checklist = await chamarIntegracao<any>(
    `/oportunidade/${prop.homefin_id_oportunidade}/incluir-documentos-integracao`,
    "POST",
    { idSimulacao: Number(idSimulacao) },
    ctx,
  );
  const slots: any[] = [
    ...(Array.isArray(checklist?.sucesso) ? checklist.sucesso : []),
    ...(Array.isArray(checklist?.error) ? checklist.error : []),
  ];

  const sucesso: EnviarDocumentosResultado["sucesso"] = [];
  const erros: EnviarDocumentosResultado["erros"] = [];

  // 2) Faz upload de cada documento local, casando com o slot correspondente
  //    por semelhança de nome do documento.
  const usados = new Set<string>();
  const marcarDoc = async (
    id: string,
    situacao: "enviado" | "erro",
    erro: string | null,
  ) => {
    try {
      await supabase
        .from("cliente_documentos")
        .update({
          situacao_integracao: situacao,
          integrado_em: situacao === "enviado" ? new Date().toISOString() : null,
          erro_integracao: erro,
        } as any)
        .eq("id", id);
    } catch {
      /* marcação de status é best-effort */
    }
  };
  for (const doc of docs) {
    const alvo = normTexto(`${doc.tipo_documento} ${doc.nome_arquivo}`);
    const slot = slots.find((s) => {
      if (s?.id == null || usados.has(String(s.id))) return false;
      const nomeSlot = normTexto(s.nomeDocumento);
      if (!nomeSlot) return false;
      return (
        alvo.includes(nomeSlot) ||
        nomeSlot.includes(normTexto(doc.tipo_documento)) ||
        nomeSlot
          .split(" ")
          .some((p) => p.length > 3 && alvo.includes(p))
      );
    });
    if (!slot) {
      const motivo = "Sem correspondência no checklist do banco para este documento.";
      erros.push({ nome: doc.nome_arquivo, motivo });
      await marcarDoc(doc.id, "erro", motivo);
      continue;
    }
    usados.add(String(slot.id));

    // Baixa o arquivo do storage.
    const { data: blob, error: dlErr } = await supabase.storage
      .from("cliente-documentos")
      .download(doc.storage_path);
    if (dlErr || !blob) {
      const motivo = "Falha ao ler o arquivo armazenado.";
      erros.push({ nome: doc.nome_arquivo, motivo });
      await marcarDoc(doc.id, "erro", motivo);
      continue;
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());

    try {
      await enviarArquivoIntegracao(
        `/documento/${slot.id}/upload`,
        { bytes, nome: doc.nome_arquivo, mime: doc.mime_type ?? "application/pdf" },
        false,
        ctx,
      );
      sucesso.push({ nome: doc.nome_arquivo, participante: slot.nomeParticipante ?? null });
      await marcarDoc(doc.id, "enviado", null);
    } catch (e: any) {
      const motivo = sanitizarMensagemErro(e?.message) || "Erro ao enviar o documento.";
      erros.push({ nome: doc.nome_arquivo, motivo });
      await marcarDoc(doc.id, "erro", motivo);
    }
  }


  // 3) Finaliza a inclusão dos documentos enviados na integração do banco.
  if (sucesso.length > 0) {
    try {
      await chamarIntegracao<any>(
        `/oportunidade/${prop.homefin_id_oportunidade}/incluir-documentos-integracao`,
        "POST",
        { idSimulacao: Number(idSimulacao) },
        ctx,
      );
    } catch {
      /* a inclusão final é best-effort; os uploads já foram registrados */
    }
  }

  // Auditoria.
  try {
    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase,
      userId,
      correspondenteId: prop.correspondente_id,
      acao: "proposta.documentos_enviados",
      entidade: "propostas",
      entidadeId: propostaId,
      descricao: `enviou ${sucesso.length} documento(s) ao banco`,
      payloadNovo: { enviados: sucesso.length, erros: erros.length },
    });
  } catch {
    /* auditoria é best-effort */
  }

  return { enviados: sucesso.length, total: docs.length, sucesso, erros };
}

/* =========================================================================
 * Gestão de participantes (proponentes/vendedores) da oportunidade
 * -------------------------------------------------------------------------
 * Endpoints do provedor:
 *   POST   /oportunidade/{id}/participante          — incluir novo
 *   DELETE /oportunidade/{idOportunidade}/participante/{id} — remover
 *   GET    /usuarios-parceiros                       — listar usuários parceiros
 * ========================================================================= */

function soDigitosStr(v?: string | null): string | undefined {
  if (!v) return undefined;
  const s = String(v).replace(/\D+/g, "");
  return s.length ? s : undefined;
}

export interface ParticipantePayload {
  nomeParticipante: string;
  cpfCnpj: string;
  tipoQualificacao?: "CO" | "VD" | "TI" | "CJ" | string; // Comprador / Vendedor / Titular / Cônjuge
  tipoPessoa?: "F" | "J";
  tipoSituacao?: "A" | "I";
  dataNascimento?: string;
  nomeMae?: string;
  tipoSexo?: "M" | "F";
  tipoEstadoCivil?: string;
  tipoRegimeCasamento?: string;
  tipoDocumentoIdentidade?: "RG" | "CNH";
  numeroDocumento?: string;
  dataExpedicao?: string;
  orgaoExpedidor?: string;
  ufExpedicao?: string;
  nomeProfissao?: string;
  nomeEmpresaProfissao?: string;
  renda?: number;
  email?: string;
  celular?: string;
  cep?: string;
  logradouro?: string;
  numeroLogradouro?: string;
  complementoLogradouro?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  utilizaFgts?: "S" | "N";
  fgAutorizacaoDados?: boolean;
  // Empresa (PJ)
  tipoEmpresa?: string;
  dataRegistroEmpresa?: string;
  faturamentoEmpresa?: number;
  patrimonioLiquidoEmpresa?: number;
  capitalSocialEmpresa?: number;
  // Cônjuge
  nomeConjuge?: string;
  cpfConjuge?: string;
  dataNascimentoConjuge?: string;
  tipoEstadoCivilConjuge?: string;
  tipoDocumentoIdentidadeConjuge?: string;
  numeroDocumentoConjuge?: string;
  dataExpedicaoConjuge?: string;
  orgaoExpedidorConjuge?: string;
  ufExpedicaoConjuge?: string;
  nomeProfissaoConjuge?: string;
  rendaConjuge?: number;
  nomeEmpresaProfissaoConjuge?: string;
  tipoSexoConjuge?: string;
}

export async function adicionarParticipanteImpl({
  propostaId,
  participante,
  supabase,
}: {
  propostaId: string;
  participante: ParticipantePayload;
  supabase: SupabaseClient<any, any, any>;
}): Promise<{ idParticipante: number | null }> {
  const { data: prop } = await supabase
    .from("propostas")
    .select("homefin_id_oportunidade, simulacao_id, correspondente_id")
    .eq("id", propostaId)
    .maybeSingle();
  if (!prop?.homefin_id_oportunidade) {
    throw new Error("Proposta sem oportunidade vinculada.");
  }
  const cpfCnpj = soDigitosStr(participante.cpfCnpj);
  if (!cpfCnpj) throw new Error("CPF/CNPJ obrigatório para incluir participante.");
  const payload = {
    tipoSituacao: participante.tipoSituacao ?? "A",
    tipoQualificacao: participante.tipoQualificacao ?? "CO",
    tipoPessoa: participante.tipoPessoa ?? (cpfCnpj.length > 11 ? "J" : "F"),
    ...participante,
    cpfCnpj,
    numeroDocumento: sanitizarNumeroDocumento(participante.numeroDocumento),
    numeroDocumentoConjuge: sanitizarNumeroDocumento(participante.numeroDocumentoConjuge),
    celular: soDigitosStr(participante.celular),
    cep: soDigitosStr(participante.cep),
    fgAutorizacaoDados: participante.fgAutorizacaoDados ?? true,
  };
  try {
    const resp = await chamarIntegracao<any>(
      `/oportunidade/${prop.homefin_id_oportunidade}/participante`,
      "POST",
      payload,
      {
        simulacao_id: prop.simulacao_id,
        proposta_id: propostaId,
        correspondente_id: prop.correspondente_id,
      },
    );
    const idParticipante =
      Number(resp?.idParticipante ?? resp?.data?.idParticipante ?? resp?.id ?? 0) || null;
    return { idParticipante };
  } catch (e) {
    if (e instanceof IntegracaoBancariaError) {
      throw new Error(sanitizarMensagemErro(e.message));
    }
    throw e;
  }
}

export async function removerParticipanteImpl({
  propostaId,
  idParticipante,
  supabase,
}: {
  propostaId: string;
  idParticipante: number;
  supabase: SupabaseClient<any, any, any>;
}): Promise<void> {
  const { data: prop } = await supabase
    .from("propostas")
    .select("homefin_id_oportunidade, simulacao_id, correspondente_id")
    .eq("id", propostaId)
    .maybeSingle();
  if (!prop?.homefin_id_oportunidade) {
    throw new Error("Proposta sem oportunidade vinculada.");
  }
  try {
    await chamarIntegracao<any>(
      `/oportunidade/${prop.homefin_id_oportunidade}/participante/${idParticipante}`,
      "DELETE",
      undefined,
      {
        simulacao_id: prop.simulacao_id,
        proposta_id: propostaId,
        correspondente_id: prop.correspondente_id,
      },
    );
  } catch (e) {
    if (e instanceof IntegracaoBancariaError) {
      throw new Error(sanitizarMensagemErro(e.message));
    }
    throw e;
  }
}

export interface UsuarioParceiroBanco {
  idUsuarioParceiro: number;
  nomeUsuarioParceiro: string;
  cpfCnpj: string | null;
  nomeProprietario: string | null;
  emailProprietario: string | null;
  celularProprietario: string | null;
  nomeFaturamento: string | null;
  emailFaturamento: string | null;
  celularFaturamento: string | null;
  tipoSituacao: "A" | "I" | string;
}

export async function listarUsuariosParceirosImpl(): Promise<UsuarioParceiroBanco[]> {
  try {
    const resp = await chamarIntegracao<any>("/usuarios-parceiros", "GET", undefined, {});
    const arr: any[] = Array.isArray(resp) ? resp : (resp?.data ?? resp?.usuarios ?? []);
    return (arr ?? []).map((u) => ({
      idUsuarioParceiro: Number(u.idUsuarioParceiro),
      nomeUsuarioParceiro: String(u.nomeUsuarioParceiro ?? ""),
      cpfCnpj: u.cpfCnpj ?? null,
      nomeProprietario: u.nomeProprietario ?? null,
      emailProprietario: u.emailProprietario ?? null,
      celularProprietario: u.celularProprietario ?? null,
      nomeFaturamento: u.nomeFaturamento ?? null,
      emailFaturamento: u.emailFaturamento ?? null,
      celularFaturamento: u.celularFaturamento ?? null,
      tipoSituacao: u.tipoSituacao ?? "A",
    }));
  } catch (e) {
    if (e instanceof IntegracaoBancariaError) {
      throw new Error(sanitizarMensagemErro(e.message));
    }
    throw e;
  }
}
