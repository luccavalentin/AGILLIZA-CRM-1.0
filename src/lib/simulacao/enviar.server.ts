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
import {
  validarCamposSimulacao,
  validarCamposParticipante,
  mensagemCamposFaltantes,
} from "./campos-obrigatorios";

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

function soDigitos(v: unknown): string | undefined {
  const s = String(v ?? "").replace(/\D/g, "");
  return s.length ? s : undefined;
}

function textoLivreParaBanco(v: unknown): string | undefined {
  const s = String(v ?? "")
    .replace(/\((?:a|o)\)/gi, "")
    .replace(/[(){}[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s || undefined;
}

function primeiroTexto(...valores: unknown[]): string | undefined {
  for (const v of valores) {
    const s = String(v ?? "").trim();
    if (s) return s;
  }
  return undefined;
}

function normalizarSexo(v: unknown): string | undefined {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "M" || s.startsWith("MASC")) return "M";
  if (s === "F" || s.startsWith("FEM")) return "F";
  return undefined;
}

const ROTA_SANTANDER_HOME_EQUITY = {
  idOperacao: 6,
  idBanco: 96,
  codigoBanco: 9004,
  nomeBanco: "Somahome",
};

function codigoBancoNormalizado(banco: any): string {
  return String(banco?.codigo_banco ?? banco?.codigoBanco ?? "").replace(/^0+/, "");
}

function usarRotaSantanderHomeEquity(sim: any, banco: any): boolean {
  const codigo = codigoBancoNormalizado(banco);
  const nome = String(banco?.nome_banco ?? banco?.nomeBanco ?? "").toLowerCase();
  return sim?.produto === "home_equity" && (codigo === "33" || nome.includes("santander"));
}

function bancoPayloadOportunidade(sim: any, banco: any) {
  if (usarRotaSantanderHomeEquity(sim, banco)) {
    return {
      idBanco: ROTA_SANTANDER_HOME_EQUITY.idBanco,
      codigoBanco: ROTA_SANTANDER_HOME_EQUITY.codigoBanco,
      nomeBanco: ROTA_SANTANDER_HOME_EQUITY.nomeBanco,
      flagSimulacao: "S",
    };
  }
  return {
    idBanco: banco.homefin_id_banco,
    codigoBanco: banco.codigo_banco,
    nomeBanco: banco.nome_banco,
    flagSimulacao: "S",
  };
}

function idBancoParaSimulacao(sim: any, banco: any): number | null {
  if (usarRotaSantanderHomeEquity(sim, banco)) return ROTA_SANTANDER_HOME_EQUITY.idBanco;
  return banco.homefin_id_banco ?? null;
}

async function consultarCepSeguro(cep: string | undefined): Promise<{
  logradouro?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
}> {
  if (!cep || cep.length !== 8) return {};
  try {
    const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const dados = await resp.json();
    if (!resp.ok || dados?.erro) return {};
    return {
      logradouro: primeiroTexto(dados.logradouro),
      bairro: primeiroTexto(dados.bairro),
      municipio: primeiroTexto(dados.localidade),
      uf: primeiroTexto(dados.uf),
    };
  } catch {
    return {};
  }
}

async function montarEnderecoParticipante(sim: any, cliente: any) {
  const cep = soDigitos(
    sim.cep_imovel ??
      cliente?.imovel_cep ??
      cliente?.cep ??
      cliente?.endereco_cep,
  );
  const viaCep = await consultarCepSeguro(cep);
  return {
    cep,
    logradouro: primeiroTexto(
      cliente?.logradouro,
      cliente?.endereco,
      cliente?.imovel_logradouro,
      viaCep.logradouro,
    ),
    numeroLogradouro: primeiroTexto(
      cliente?.numero,
      cliente?.numero_logradouro,
      cliente?.imovel_numero,
      "S/N",
    ),
    complementoLogradouro: primeiroTexto(cliente?.complemento, cliente?.imovel_complemento),
    bairro: primeiroTexto(cliente?.bairro, cliente?.imovel_bairro, viaCep.bairro),
    municipio: primeiroTexto(cliente?.cidade, cliente?.municipio, cliente?.imovel_cidade, viaCep.municipio),
    uf: primeiroTexto(cliente?.uf, cliente?.imovel_uf, sim.uf, viaCep.uf),
  };
}

async function montarEnderecoImovelGarantia(sim: any, cliente: any) {
  const cep = soDigitos(sim.cep_imovel ?? cliente?.imovel_cep);
  const viaCep = await consultarCepSeguro(cep);
  return {
    cep,
    logradouro: primeiroTexto(cliente?.imovel_logradouro, viaCep.logradouro),
    numeroLogradouro: primeiroTexto(cliente?.imovel_numero, "S/N"),
    complementoLogradouro: primeiroTexto(cliente?.imovel_complemento),
    bairro: primeiroTexto(cliente?.imovel_bairro, viaCep.bairro),
    municipio: primeiroTexto(cliente?.imovel_cidade, viaCep.municipio),
    uf: primeiroTexto(cliente?.imovel_uf, sim.uf, viaCep.uf),
  };
}

async function garantirDadosParticipantesSimulacao({
  sim,
  cliente,
  idOportunidade,
  ctx,
}: {
  sim: any;
  cliente: any;
  idOportunidade: string;
  ctx: { simulacao_id: string; correspondente_id: any };
}) {
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
    return;
  }
  if (participantes.length === 0) return;

  const endereco = await montarEnderecoParticipante(sim, cliente);
  const cpfTitular = soDigitos(sim.cpf_cnpj);
  const cpfConjuge = soDigitos(sim.cpf_conjuge);

  for (const part of participantes) {
    if (!part?.idParticipante) continue;
    const cpf = soDigitos(part?.cpfCnpj);
    const ehConjuge = Boolean(cpf && cpfConjuge && cpf === cpfConjuge);
    const ehTitular = !ehConjuge && (!cpf || !cpfTitular || cpf === cpfTitular);
    if (!ehTitular && !ehConjuge) continue;

    const payload: Record<string, unknown> = {
      tipoSituacao: part?.tipoSituacao ?? "A",
      nomeParticipante: part?.nomeParticipante ?? (ehConjuge ? sim.nome_conjuge : sim.nome_cliente),
      tipoQualificacao: part?.tipoQualificacao ?? (ehConjuge ? "CJ" : "CO"),
      tipoPessoa: part?.tipoPessoa ?? ((cpf?.length ?? cpfTitular?.length ?? 0) > 11 ? "J" : "F"),
      cpfCnpj: cpf ?? (ehConjuge ? cpfConjuge : cpfTitular),
      dataNascimento:
        part?.dataNascimento ??
        (ehConjuge ? sim.data_nascimento_conjuge : sim.data_nascimento) ??
        cliente?.data_nascimento,
      tipoEstadoCivil:
        part?.tipoEstadoCivil ??
        (ehConjuge ? sim.estado_civil_conjuge : sim.estado_civil) ??
        cliente?.estado_civil ?? 
        undefined,
      tipoRegimeCasamento: part?.tipoRegimeCasamento ?? sim.regime_casamento ?? undefined,
      tipoSexo: part?.tipoSexo ?? normalizarSexo(cliente?.sexo),
      tipoDocumentoIdentidade:
        part?.tipoDocumentoIdentidade ?? cliente?.tipo_documento_identidade ?? undefined,
      numeroDocumento: part?.numeroDocumento ?? cliente?.numero_documento ?? undefined,
      orgaoExpedidor: part?.orgaoExpedidor ?? cliente?.orgao_expedidor ?? undefined,
      ufExpedicao: part?.ufExpedicao ?? cliente?.uf_expedicao ?? undefined,
      dataExpedicao: part?.dataExpedicao ?? cliente?.data_expedicao ?? undefined,
      nomeProfissao:
        textoLivreParaBanco(cliente?.profissao) ||
        textoLivreParaBanco(part?.nomeProfissao) ||
        "Não informado",
      nomeEmpresaProfissao:
        textoLivreParaBanco(cliente?.empresa) ||
        textoLivreParaBanco(part?.nomeEmpresaProfissao) ||
        "Não informado",
      nomeMae: part?.nomeMae ?? cliente?.mae ?? undefined,
      renda: part?.renda ?? (ehConjuge ? sim.renda_conjuge : sim.renda_total) ?? cliente?.renda_total_declarada,
      email: part?.email ?? (ehConjuge ? sim.email_conjuge : sim.email) ?? cliente?.email,
      celular: part?.celular ?? soDigitos(ehConjuge ? sim.celular_conjuge : sim.celular),
      utilizaFgts: part?.utilizaFgts ?? sim.utiliza_fgts ?? "N",
      fgAutorizacaoDados: true,
      ...(ehTitular && (sim.possui_conjuge || ["CA", "UE"].includes(String(sim.estado_civil ?? "")))
        ? {
            nomeConjuge: part?.nomeConjuge ?? sim.nome_conjuge ?? undefined,
            cpfConjuge: part?.cpfConjuge ?? soDigitos(sim.cpf_conjuge),
            dataNascimentoConjuge:
              part?.dataNascimentoConjuge ?? sim.data_nascimento_conjuge ?? undefined,
            tipoEstadoCivilConjuge:
              part?.tipoEstadoCivilConjuge ?? sim.estado_civil_conjuge ?? sim.estado_civil ?? undefined,
            rendaConjuge: part?.rendaConjuge ?? sim.renda_conjuge ?? undefined,
          }
        : {}),
      ...endereco,
    };

    // Remove campos undefined para evitar que a API receba "undefined" como string
    const cleanedPayload = Object.fromEntries(
      Object.entries(payload).filter(([_, v]) => v !== undefined)
    );


    try {
      await chamarIntegracao<any>(
        `/oportunidade/${idOportunidade}/participante/${part.idParticipante}`,
        "PUT",
        cleanedPayload,
        ctx,
      );
    } catch {
      // A falha na complementação não deve impedir os demais bancos; o retorno
      // vazio será tratado por banco e permitirá reenvio após corrigir cadastro.
    }
  }
}

export async function enviarSimulacaoImpl({
  simulacaoId,
  userId,
  ip,
  supabase,
  bancoIds,
}: EnviarArgs): Promise<EnviarResultado> {
  const envioPorBanco = Boolean(bancoIds && bancoIds.length > 0);
  const { data: sim, error } = await supabase
    .from("simulacoes")
    .select("*")
    .eq("id", simulacaoId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!sim) throw new Error("Simulação não encontrada.");

  // Trava anti-duplicidade: mantém bloqueio para o envio geral, mas libera
  // chamadas por banco. O fluxo em lote chama um banco por vez; bloquear aqui
  // deixava o segundo banco preso em "aguardando" até o usuário reenviar.
  if (!envioPorBanco && sim.status === "enviando" && sim.ultimo_envio_em) {
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

  // Validação prévia dos campos obrigatórios do contrato da integração:
  // é melhor dizer exatamente o que falta do que receber "erro interno" do banco.
  const faltantesSimulacao = validarCamposSimulacao(sim);
  if (faltantesSimulacao.length > 0) {
    throw new Error(mensagemCamposFaltantes(faltantesSimulacao));
  }

  const estadoCivil = String(sim.estado_civil ?? "").toUpperCase();
  const possuiConjuge = estadoCivil
    ? estadoCivil === "CA" || estadoCivil === "UE"
    : Boolean(sim.possui_conjuge);
  const compoeRenda = Boolean(sim.compoe_renda) && possuiConjuge;
  if (compoeRenda) {
    const faltantesConjuge = [
      !String(sim.nome_conjuge ?? "").trim() && "Nome do cônjuge",
      String(sim.cpf_conjuge ?? "").replace(/\D/g, "").length !== 11 && "CPF do cônjuge",
      !String(sim.data_nascimento_conjuge ?? "").trim() && "Data de nascimento do cônjuge",
      !(Number(sim.renda_conjuge) > 0) && "Renda do cônjuge",
    ].filter(Boolean);
    if (faltantesConjuge.length > 0) {
      throw new Error(
        `Não foi possível enviar: a composição de renda está ativa, mas faltam ${faltantesConjuge.join(", ")}. Complete os dados ou desative a composição de renda.`,
      );
    }
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
  
  // Garantia de sanitização de CPFs para evitar erros silenciosos na API (500)
  sim.cpf_cnpj = (sim.cpf_cnpj ?? "").replace(/\D/g, "");
  if (sim.cpf_conjuge) sim.cpf_conjuge = (sim.cpf_conjuge ?? "").replace(/\D/g, "");


  // ===== Financiar despesas =====
  // A API da integração espera a flag como string "S"/"N" (nunca booleano) e, quando
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

    let cliente: any = null;
    if (sim.cliente_id) {
      const { data } = await supabase
        .from("clientes")
        .select("*")
        .eq("id", sim.cliente_id)
        .maybeSingle();
      cliente = data;
    }
    // Campos do dossiê do proponente: não bloqueiam o envio (alguns bancos
    // aceitam sem), mas explicam o "erro interno" quando o banco recusa.
    const faltantesCadastro = validarCamposParticipante(sim, cliente);
    const avisoCadastro =
      faltantesCadastro.length > 0
        ? ` Dados do proponente pendentes no cadastro do cliente: ${faltantesCadastro
            .map((f) => f.campo)
            .join(", ")}.`
        : "";

    const enderecoImovelGarantia =
      sim.produto === "home_equity" ? await montarEnderecoImovelGarantia(sim, cliente) : null;
    if (sim.produto === "home_equity") {
      if (!enderecoImovelGarantia?.cep) {
        throw new Error(
          "Informe o CEP do imóvel antes de reenviar Home Equity ao banco. Sem esse dado o banco não calcula a garantia e retorna a simulação vazia.",
        );
      }
      if (
        !enderecoImovelGarantia.logradouro ||
        !enderecoImovelGarantia.bairro ||
        !enderecoImovelGarantia.municipio ||
        !enderecoImovelGarantia.uf
      ) {
        throw new Error(
          "Complete ou corrija o CEP do imóvel para Home Equity. O banco exige endereço completo da garantia para retornar a simulação.",
        );
      }
    }

    const usaRotaSantanderHomeEquity =
      bancos.length === 1 && usarRotaSantanderHomeEquity(sim, bancos[0]);

    // 1) Oportunidade (idempotência: reutiliza se já existe)
    // Santander em Home Equity usa a rota operacional Somahome; oportunidades
    // antigas criadas como Home Equity comum ficam sem retorno. Para reenvio,
    // criamos uma nova oportunidade na operação correta.
    let idOportunidade = usaRotaSantanderHomeEquity
      ? null
      : (sim.homefin_id_oportunidade as string | null);

    // Campos que dependem da simulação atual e podem ter mudado desde a
    // primeira criação da oportunidade (ex.: usuário marcou "financiar despesas"
    // e reenviou). Precisam ser sincronizados também no reenvio, senão o banco
    // continua recebendo os valores antigos.
    const idOperacaoIntegracao = usaRotaSantanderHomeEquity
      ? ROTA_SANTANDER_HOME_EQUITY.idOperacao
      : sim.id_operacao_homefin;

    const dadosOportunidade: Record<string, unknown> = {
      tipoImovel: { id: sim.tipo_imovel },
      usoImovel: { id: sim.uso_imovel },
      uf: { codigo: sim.uf },
      ...(enderecoImovelGarantia
        ? {
            cep: enderecoImovelGarantia.cep,
            logradouro: enderecoImovelGarantia.logradouro,
            numeroLogradouro: enderecoImovelGarantia.numeroLogradouro,
            complementoLogradouro: enderecoImovelGarantia.complementoLogradouro,
            bairro: enderecoImovelGarantia.bairro,
            municipio: enderecoImovelGarantia.municipio,
            uf: { codigo: enderecoImovelGarantia.uf ?? sim.uf },
          }
        : {}),
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
        operacao: { idOperacao: String(idOperacaoIntegracao) },
        ...(auth.idRegional ? { regional: { idRegional: auth.idRegional } } : {}),
        ...(auth.idParceiro ? { parceiro: { idParceiro: auth.idParceiro } } : {}),
        ...(auth.idUsuarioParceiro
          ? { usuarioParceiro: { idUsuarioParceiro: auth.idUsuarioParceiro } }
          : {}),
        ...dadosOportunidade,
        bancos: bancos.map((b: any) => bancoPayloadOportunidade(sim, b)),
        cpfCnpj: (sim.cpf_cnpj ?? "").replace(/\D/g, ""),
        nome: sim.nome_cliente,
        rendaTotal: num(sim.renda_total),
        dataNascimento: sim.data_nascimento,
        email: sim.email,
        celular: (sim.celular ?? "").replace(/\D/g, ""),
        tipoEstadoCivil: sim.estado_civil ? { id: sim.estado_civil } : undefined,
        regimeCasamento: sim.regime_casamento ? { id: sim.regime_casamento } : undefined,

        fgCompoeRenda: compoeRenda,
        ...(possuiConjuge
          ? {
              nomeConjuge: sim.nome_conjuge,
              cpfConjuge: (sim.cpf_conjuge ?? "").replace(/\D/g, ""),
              emailConjuge: sim.email_conjuge,
              celularConjuge: (sim.celular_conjuge ?? "").replace(/\D/g, ""),
              rendaConjuge: num(sim.renda_conjuge),
              dataNascimentoConjuge: sim.data_nascimento_conjuge,
              tipoEstadoCivilConjuge: sim.estado_civil_conjuge ? { id: sim.estado_civil_conjuge } : undefined,
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
        const conjugeBloco =
          possuiConjuge
            ? {
                nomeConjuge: sim.nome_conjuge ?? undefined,
                cpfConjuge: (sim.cpf_conjuge ?? "").replace(/\D/g, "") || undefined,
                emailConjuge: sim.email_conjuge ?? undefined,
                celularConjuge: (sim.celular_conjuge ?? "").replace(/\D/g, "") || undefined,
                rendaConjuge: num(sim.renda_conjuge),
                dataNascimentoConjuge: sim.data_nascimento_conjuge ?? undefined,
                tipoEstadoCivilConjuge: sim.estado_civil_conjuge
                  ? { id: sim.estado_civil_conjuge }
                  : sim.estado_civil
                    ? { id: sim.estado_civil }
                    : undefined,
              }
            : {};

        const updatePayload = {
          ...dadosOportunidade,
          tipoEstadoCivil: sim.estado_civil ? { id: sim.estado_civil } : undefined,
          regimeCasamento: sim.regime_casamento ? { id: sim.regime_casamento } : undefined,
          fgCompoeRenda: compoeRenda,
          ...conjugeBloco,
        };

        // Remove campos undefined para evitar que a API receba "undefined" como string ou falhe no parsing
        const cleanedPayload = Object.fromEntries(
          Object.entries(updatePayload).filter(([_, v]) => v !== undefined)
        );

        await chamarIntegracao<any>(
          `/oportunidade/${idOportunidade}`,
          "PUT",
          cleanedPayload,
          ctx,
        );
      } catch (e) {
        console.warn(
          "Falha ao sincronizar oportunidade (PUT). Prosseguindo com o envio por banco.",
          e instanceof Error ? e.message : String(e),
        );
      }


    }

    if (idOportunidade) {
      await garantirDadosParticipantesSimulacao({ sim, cliente, idOportunidade, ctx });
    }


    // A integração HomeFin devolve HTTP 500 ("Erro interno do servidor") de forma
    // intermitente ao criar/integrar a simulação (visto no Itaú). Nesses casos o
    // reenvio manual funciona segundos depois, então repetimos automaticamente.
    const chamarComRetry = async <T,>(
      rota: string,
      metodo: "POST" | "PUT",
      corpo: unknown,
      tentativas = 3,
    ): Promise<T> => {
      let ultimoErro: unknown;
      for (let i = 0; i < tentativas; i++) {
        try {
          return await chamarIntegracao<T>(rota, metodo, corpo as any, ctx);
        } catch (e: any) {
          ultimoErro = e;
          const msg = String(e?.message ?? e);
          const transitorio = /HTTP 50\d|INTERNAL_ERROR|timeout|ECONNRESET|fetch failed/i.test(msg);
          if (!transitorio || i === tentativas - 1) throw e;
          await new Promise((r) => setTimeout(r, 2500 * (i + 1)));
        }
      }
      throw ultimoErro;
    };


    // 2 + 3) Simulação + integração por banco.
    // Enviamos um banco de cada vez (SEQUENCIAL): disparar as chamadas em
    // paralelo na mesma oportunidade gera condição de corrida e faz alguns
    // bancos falharem ("erro no envio") enquanto outros passam. Cada banco
    // mantém seu próprio try/catch — a falha de um não impede os demais.
    const enviarBanco = async (b: any): Promise<EnviarResultado["bancos"][number]> => {
      // O contrato oficial não define teto fixo de 360 meses para o Itaú.
      // Enviamos o prazo já validado pela idade, limitado a até 420 meses.
      const prazoBanco = num(sim.prazo);
      try {
        const simPayload = {
          valorImovel: num(sim.valor_imovel),
          valorFinanciamento: num(sim.valor_financiamento),
          prazo: prazoBanco,
          codigoSistemaAmortizacaoBanco: { id: sim.sistema_amortizacao ?? "S" },
          banco: { idBanco: idBancoParaSimulacao(sim, b) },
          fgFinanciarDespesas,
          valorDespesasFinanciadas,
          valorTotalFinanciamento,
          fgAutorizacaoDados: true,
        };
        console.log(
          "Payload enviado para criar simulação bancária:",
          JSON.stringify(simPayload),
        );
        const simResp = await chamarComRetry<any>(
          `/oportunidade/${idOportunidade}/simulacao`,
          "POST",
          simPayload,
        );
        const idSimulacao = String(simResp?.idSimulacao ?? "");

        // PUT completo da simulação: garante que a integração persista os campos de
        // despesas financiadas ANTES da integração bancária. Enviamos o payload
        // completo (não parcial) para não apagar/ignorar demais campos.
        const putPayload = {
          valorImovel: num(sim.valor_imovel),
          valorFinanciamento: num(sim.valor_financiamento),
          prazo: prazoBanco,
          codigoSistemaAmortizacaoBanco: { id: sim.sistema_amortizacao ?? "S" },
          valorDespesasFinanciadas,
          valorTotalFinanciamento,
          fgFinanciarDespesas,
          fgAutorizacaoDados: true,
        };
        console.log(
          "Payload enviado para atualizar simulação bancária:",
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
          "Retorno atualização simulação bancária:",
          JSON.stringify(putResp),
        );

        // Confirma que a integração persistiu a flag antes de enviar ao banco.
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
        const integ = await chamarComRetry<any>(
          `/oportunidade/${idOportunidade}/simulacao/${idSimulacao}/integracao`,
          "POST",
          {},
        );

        let dados = integ ?? simResp;
        let dadosApi = dados?.simulacao ?? dados?.data ?? dados;

        // Detecção de retorno vazio: alguns bancos (ex.: Santander em Home
        // Equity) respondem à /integracao sem processar a simulação, deixando
        // valorParcelaBanco / taxaJurosAnoBanco / valorFinanciamentoBanco em
        // null ou zero. Sem esse guard o registro fica marcado como "simulada"
        // mas exibe zeros/vazio na UI. Marcamos como "erro" com mensagem clara
        // e mostramos qualquer descricaoRespostaBanco devolvida pelo banco.
        const vazio = (d: any) => {
          const parcela = d?.valorParcelaBanco ?? d?.valorParcelaBancoMax ?? d?.valorParcelaSimulacao;
          const taxa = d?.taxaJurosAnoBanco ?? d?.taxaCetAnoBanco;
          const financ = d?.valorFinanciamentoBanco ?? d?.valorFinanciamentoBancoMax;
          return (
            (parcela == null || Number(parcela) <= 0) &&
            (taxa == null || Number(taxa) <= 0) &&
            (financ == null || Number(financ) <= 0)
          );
        };

        // Alguns bancos (Itaú, principalmente) processam a integração de forma
        // assíncrona: a resposta do POST /integracao volta ainda "em
        // processamento" (tipoSituacao "P") e sem valores. A integração não
        // possui webhook, então consultamos a oportunidade algumas vezes para
        // capturar o retorno assim que ele chegar. Bancos que já respondem
        // com valores no POST não entram neste laço.
        // Alguns bancos (Itaú, principalmente) processam a integração de forma
        // assíncrona: a resposta do POST /integracao volta ainda "em
        // processamento" (tipoSituacao "P") e sem valores. A integração não
        // possui webhook, então consultamos a oportunidade algumas vezes para
        // capturar o retorno assim que ele chegar. Aumentamos o polling para o
        // Itaú (20 tentativas a cada 10s) para garantir o retorno.
        if (vazio(dadosApi)) {
          const isItau = String(b.nome_banco ?? "").toLowerCase().includes("itaú") ||
                         String(b.nome_banco ?? "").toLowerCase().includes("itau");
          const maxTentativas = isItau ? 20 : 12;
          const delay = isItau ? 10000 : 8000;

          for (let tentativa = 0; tentativa < maxTentativas && vazio(dadosApi); tentativa++) {
            await new Promise((r) => setTimeout(r, delay));
            try {
              const op = await chamarIntegracao<any>(
                `/oportunidade/${idOportunidade}`,
                "GET",
                undefined,
                ctx,
              );
              const lista: any[] =
                op?.oportunidade?.simulacoes ?? op?.simulacoes ?? [];
              const achado = lista.find(
                (s: any) => String(s?.idSimulacao ?? "") === String(idSimulacao),
              );
              if (achado && !vazio(achado)) {
                dados = achado;
                dadosApi = achado;
              }
            } catch (e) {
              console.warn(
                "Falha ao consultar retorno da simulação (polling).",
                e instanceof Error ? e.message : String(e),
              );
              break;
            }
          }
        }

        const semParcela = vazio(dadosApi);
        const semTaxa = semParcela;
        const semFinanc = semParcela;

        if (semParcela && semTaxa && semFinanc) {
          const desc = dadosApi?.descricaoRespostaBanco;
          const motivoBanco =
            typeof desc === "string" && desc.trim()
              ? desc.trim()
              : typeof desc === "object" && desc && "mensagem" in (desc as any)
                ? String((desc as any).mensagem ?? "")
                : "";
          const msg = motivoBanco
            ? `O banco não retornou valores para esta simulação: ${motivoBanco}`
            : `O banco não retornou valores para esta operação. Verifique se ${String(b.nome_banco ?? "o banco")} opera este produto ou tente reenviar.`;
          await supabase
            .from("simulacao_bancos")
            .update({
              homefin_id_simulacao_banco: idSimulacao,
              status_banco: "erro",
              mensagem_banco: msg,
              raw_response: dados,
              simulado_em: new Date().toISOString(),
            })
            .eq("id", b.id);
          return { banco_id: b.banco_id, status: "erro" as const, mensagem: msg };
        }


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
        const base =
          e instanceof IntegracaoBancariaError ? e.message : humanizarErroBanco(null, String(e));
        const statusHttp = e instanceof IntegracaoBancariaError ? e.statusHttp ?? 0 : 0;
        const msg =
          statusHttp >= 500 && avisoCadastro ? `${base}${avisoCadastro}` : base;
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

    // Lógica para comparar CPFs do titular e cônjuge se casado
    if (sim.possui_conjuge && sim.cpf_conjuge && !envioPorBanco) {
      try {
        // Registra o início do comparativo
        await supabase.from("simulacao_historico").insert({
          simulacao_id: simulacaoId,
          tipo: "info",
          descricao: "Sistema iniciando teste comparativo de CPFs (titular e cônjuge)...",
          ator_id: userId,
        });

        // Inverte titular e cônjuge para testar o outro CPF
        const { inverterTitularSimulacao } = await import("./simulacoes.functions");
        await (inverterTitularSimulacao as any)({ id: simulacaoId }, { context: { supabase, userId } });

        // Envia novamente com o titular invertido
        for (const b of bancos as any[]) {
          await enviarBanco(b);
        }

        // Registra no histórico para o watcher disparar o popup (com marcador específico)
        await supabase.from("simulacao_historico").insert({
          simulacao_id: simulacaoId,
          tipo: "info",
          descricao: "Comparativo de taxas concluído: o sistema testou ambos os proponentes.",
          ator_id: userId,
        });

        // Inverte de volta para manter o titular original como primário (opcional, mas evita confusão)
        await (inverterTitularSimulacao as any)({ id: simulacaoId }, { context: { supabase, userId } });
      } catch (e) {
        console.warn("Falha ao realizar teste comparativo de CPFs:", e);
      }
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
