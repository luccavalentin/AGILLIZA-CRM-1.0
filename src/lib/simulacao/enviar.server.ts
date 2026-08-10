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
import { marcarOrigemDados } from "./origem-dados";

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

/**
 * O Bradesco pode devolver, por operação, o prazo mínimo que aceita. Esse
 * limite não consta como constante no contrato da API e pode variar; por isso
 * extraímos o número do retorno real em vez de impor 180 meses globalmente.
 */
function prazoMinimoSolicitadoPeloBanco(mensagem: unknown): number | null {
  const texto = String(mensagem ?? "");
  const match =
    texto.match(/prazo\s+de\s+pagamento\s+igual\s+ou\s+superior\s+a[:\s]+(\d+)/i) ??
    texto.match(/prazo\s+abaixo\s+do\s+m[ií]nimo[^:]*:\s*(\d+)\s+meses/i);
  if (!match) return null;
  const prazo = Number(match[1]);
  return Number.isInteger(prazo) && prazo > 0 ? prazo : null;
}

/**
 * Aprendizado sem deploy: guarda o prazo mínimo devolvido pela API para a
 * combinação banco + tipo de imóvel em `configuracoes_modulos`, módulo
 * `simulacao_prazos_minimos`. Falhas aqui nunca interrompem o envio.
 */
async function registrarPrazoMinimoAprendido(
  supabase: SupabaseClient<any>,
  correspondenteId: string | null | undefined,
  chave: string,
  prazoMinimo: number,
  userId?: string | null,
) {
  try {
    if (!correspondenteId) return;
    const { data: atual } = await supabase
      .from("configuracoes_modulos")
      .select("id, config")
      .eq("correspondente_id", correspondenteId)
      .eq("modulo", "simulacao_prazos_minimos")
      .maybeSingle();
    const config = { ...((atual?.config as Record<string, unknown>) ?? {}), [chave]: prazoMinimo };
    if (atual?.id) {
      await supabase.from("configuracoes_modulos").update({ config, updated_by: userId ?? null }).eq("id", atual.id);
    } else {
      await supabase.from("configuracoes_modulos").insert({
        correspondente_id: correspondenteId,
        modulo: "simulacao_prazos_minimos",
        config,
        updated_by: userId ?? null,
      });
    }
  } catch (e) {
    console.error("[enviar.server] Não foi possível registrar prazo mínimo aprendido:", e);
  }
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

async function montarEnderecoParticipante(sim: any, cliente: any, endPrincipal?: any) {
  const cep = soDigitos(
    sim.cep_imovel ??
      cliente?.imovel_cep ??
      endPrincipal?.cep ??
      cliente?.cep ??
      cliente?.endereco_cep,
  );
  const viaCep = await consultarCepSeguro(cep);
  return {
    cep,
    logradouro: primeiroTexto(
      endPrincipal?.logradouro,
      cliente?.logradouro,
      cliente?.endereco,
      cliente?.imovel_logradouro,
      viaCep.logradouro,
    ),
    numeroLogradouro: primeiroTexto(
      endPrincipal?.numero,
      cliente?.numero,
      cliente?.numero_logradouro,
      cliente?.imovel_numero,
      "S/N",
    ),
    complementoLogradouro: primeiroTexto(endPrincipal?.complemento, cliente?.complemento, cliente?.imovel_complemento),
    bairro: primeiroTexto(endPrincipal?.bairro, cliente?.bairro, cliente?.imovel_bairro, viaCep.bairro),
    municipio: primeiroTexto(endPrincipal?.cidade, endPrincipal?.municipio, cliente?.cidade, cliente?.municipio, cliente?.imovel_cidade, viaCep.municipio),
    uf: primeiroTexto(endPrincipal?.uf, cliente?.uf, cliente?.imovel_uf, sim.uf, viaCep.uf),
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
  endPrincipal,
  idOportunidade,
  ctx,
}: {
  sim: any;
  cliente: any;
  endPrincipal: any;
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

  const endereco = await montarEnderecoParticipante(sim, cliente, endPrincipal);
  const cpfTitular = soDigitos(sim.cpf_cnpj);
  const cpfConjuge = soDigitos(sim.cpf_conjuge);

  for (const part of participantes) {
    if (!part?.idParticipante) continue;
    const cpf = soDigitos(part?.cpfCnpj);
    const ehConjuge = Boolean(cpf && cpfConjuge && cpf === cpfConjuge);
    const ehTitular = !ehConjuge && (!cpf || !cpfTitular || cpf === cpfTitular);
    if (!ehTitular && !ehConjuge) continue;

    // REGRA 1: A renda enviada ao banco é SEMPRE a renda declarada para o participante.
    // O sistema NUNCA substitui esse valor.
    const rendaDeclarada = ehConjuge 
      ? num(sim.renda_conjuge) 
      : num(sim.renda_total);

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
      tipoRegimeCasamento: part?.tipoRegimeCasamento ?? sim.regime_casamento ?? cliente?.regime_casamento ?? undefined,
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
      renda: rendaDeclarada, // Garantia da Regra 1: Usa o valor extraído da simulação, sem alterações.
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
            rendaConjuge: part?.rendaConjuge ?? num(sim.renda_conjuge) ?? undefined,
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
    } catch (e) {
      // Falha na complementação (PUT /participante) não deve travar o banco.
      // Logamos o erro mas deixamos o fluxo seguir, pois alguns bancos processam
      // a simulação mesmo com dados parciais se o proponente já existe na HomeFin.
      console.warn(`[enviar.server] Falha ao atualizar proponente ${part.idParticipante}:`, e);
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
  // Validação legítima antes de qualquer envio
  const { data: simPreCheck } = await supabase
    .from("simulacoes")
    .select("*, cliente:clientes(*)")
    .eq("id", simulacaoId)
    .maybeSingle();
  
  if (simPreCheck) {
    const faltantesObrigatorios = validarCamposSimulacao(simPreCheck);
    if (faltantesObrigatorios.length > 0) {
      // Registrar log antes de estourar o erro
      await supabase.from("simulacao_historico").insert({
        simulacao_id: simulacaoId,
        tipo: "erro",
        descricao: mensagemCamposFaltantes(faltantesObrigatorios),
        ator_id: userId,
      });
      throw new Error(mensagemCamposFaltantes(faltantesObrigatorios));
    }
  }

  const retryLimit = 2; // Tentativas para erros 5xx
  const TIMEOUT_BANCO_MS = 240_000;

  // Watchdog: Recupera simulações presas em "enviando" há mais de 10 minutos (Timeout fantasma)
  try {
    const dezMinutosAtras = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: presas } = await supabase
      .from("simulacoes")
      .select("id")
      .eq("status", "enviando")
      .lt("ultimo_envio_em", dezMinutosAtras)
      .limit(5);

    for (const p of presas ?? []) {
      await supabase
        .from("simulacoes")
        .update({ 
          status: "erro", 
          mensagem_erro: "Falha silenciosa detectada (Watchdog). Tente reenviar." 
        } as any)
        .eq("id", p.id);
    }
  } catch (e) {
    console.warn("[enviar.server] Watchdog falhou:", e);
  }

  const envioPorBanco = Boolean(bancoIds && bancoIds.length > 0);
  const { data: sim, error } = await supabase
    .from("simulacoes")
    .select("*, cliente:clientes(*)")
    .eq("id", simulacaoId)
    .is("deleted_at", null)
    .maybeSingle();

  const { data: end } = await supabase
    .from("cliente_enderecos")
    .select("*")
    .eq("cliente_id", sim?.cliente_id)
    .order("principal", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!sim) throw new Error("Simulação não encontrada.");

  const cliente = { ...(sim.cliente ?? {}) };
  // REGRA 2: Simulação é registro histórico. Sincronização automática removida para evitar
  // reescrita retroativa de renda e outros dados usados no envio original.
  // Uma simulação enviada tem seu estado CONGELADO.

  // Trava anti-duplicidade e proteção de registro histórico
  if (sim.status !== "rascunho" && sim.status !== "erro") {
     // Se não for rascunho nem erro, a simulação já teve um ciclo de vida iniciado.
     // Se estiver "enviando" há menos de 60s, bloqueia.
     if (sim.status === "enviando" && sim.ultimo_envio_em) {
       const inicio = new Date(sim.ultimo_envio_em).getTime();
       if (Number.isFinite(inicio) && Date.now() - inicio < 60_000) {
         throw new Error("Um envio ao banco já está em andamento. Aguarde a conclusão.");
       }
     }
     
     // Se já foi finalizada (simulada/recusada), não permite re-envio que altere dados.
     if (sim.status === "simulada" || sim.status === "recusada" || sim.status === "aprovada") {
        throw new Error("Esta simulação já foi concluída e não pode ser alterada. Gere uma nova simulação para atualizar os dados.");
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

  // Validação informativa (não bloqueante para simulação) (Princípio #1 - Simulação nunca trava)
  const faltantesSimulacao = validarCamposSimulacao(sim);
  if (faltantesSimulacao.length > 0) {
    console.info(`[enviar.server] Campos básicos ausentes para simulação: ${faltantesSimulacao.join(", ")}`);
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
      console.info(`[enviar.server] Composição ativa mas faltam dados do cônjuge: ${faltantesConjuge.join(", ")}`);
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

  // Se o cliente (titular) tiver um cônjuge cadastrado e a simulação não tiver os dados dele,
  // mas o estado civil for casado/UE, forçamos o preenchimento para garantir que a proposta
  // vá completa para o banco.
  if (cliente && possuiConjuge && !sim.nome_conjuge && (cliente as any).conjuge_nome) {
    sim.nome_conjuge = (cliente as any).conjuge_nome;
    sim.cpf_conjuge = ((cliente as any).conjuge_cpf ?? "").replace(/\D/g, "");
    sim.renda_conjuge = (cliente as any).conjuge_renda ?? 0;
    sim.data_nascimento_conjuge = (cliente as any).conjuge_data_nascimento;
    sim.email_conjuge = (cliente as any).conjuge_email;
    sim.celular_conjuge = (cliente as any).conjuge_celular;
  }


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
  // Verificação informativa (Princípio #1 - Simulação nunca trava)
  if (financiarDespesas) {
    if (!(valorDespesasFinanciadas > 0)) {
      console.warn('[enviar.server] Financiar despesas marcado mas valor zerado.');
    }
    if (!(valorTotalFinanciamento > valorFinanciamentoBase)) {
      console.warn('[enviar.server] Valor total financiamento igual ao base mesmo com despesas marcadas.');
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
      status: "enviando" as any,
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

    // Usamos o 'cliente' já carregado no início da função (com endereço), em vez de recarregar parcial.
    const clienteCompleto = cliente;
    
    // REGISTRO DE AVISO: A ausência de dados do dossiê não bloqueia mais o envio da simulação.
    // Esses campos são obrigatórios apenas na proposta/formalização.
    const faltantesCadastro = validarCamposParticipante(sim, clienteCompleto);
    if (faltantesCadastro.length > 0) {
      console.info(`[enviar.server] Dados de dossiê ausentes para simulação: ${faltantesCadastro.map(f => f.campo).join(", ")}`);
    }

    const enderecoImovelGarantia =
      sim.produto === "home_equity" ? await montarEnderecoImovelGarantia(sim, clienteCompleto) : null;
    if (sim.produto === "home_equity") {
      if (!enderecoImovelGarantia?.cep) {
        console.warn("[enviar.server] CEP do imóvel ausente para Home Equity.");
      }
      if (
        !enderecoImovelGarantia?.logradouro ||
        !enderecoImovelGarantia?.bairro ||
        !enderecoImovelGarantia?.municipio ||
        !enderecoImovelGarantia?.uf
      ) {
        console.warn("[enviar.server] Endereço do imóvel incompleto para Home Equity.");
      }
    }

    const usaRotaSantanderHomeEquity =
      bancos.length === 1 && usarRotaSantanderHomeEquity(sim, bancos[0]);

    // 1) Oportunidade (idempotência: reutiliza se já existe)
    // Santander em Home Equity usa a rota operacional Somahome; oportunidades
    // antigas criadas como Home Equity comum ficam sem retorno. Para reenvio,
    // criamos uma nova oportunidade na operação correta.
    let idOportunidade = usaRotaSantanderHomeEquity
      ? null : (sim.homefin_id_oportunidade as string | null);

    if (idOportunidade) {
      try {
        const checkOp = await chamarIntegracao<any>(
          `/oportunidade/${idOportunidade}`,
          "GET",
          undefined,
          ctx,
        );
        const opData = checkOp?.oportunidade ?? checkOp ?? {};
        const situacao = String(opData?.tipoSituacao ?? "").toUpperCase().charAt(0);
        
        if (situacao === "C" || situacao === "T") {
          console.log(`[HomeFin] Oportunidade ${idOportunidade} está em estado terminal (${situacao}). Criando uma nova.`);
          idOportunidade = null;
          if (situacao === "C") {
            await supabase.from("simulacao_historico").insert({
              simulacao_id: simulacaoId,
              tipo: "info",
              descricao: "A oportunidade desta simulação estava cancelada na integração. Uma nova oportunidade será gerada automaticamente.",
              ator_id: userId,
            });
          }
        }
      } catch (e) {
        console.warn(`[HomeFin] Falha ao validar estado da oportunidade ${idOportunidade}:`, e);
        idOportunidade = null;
      }
    }

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

    if (!idOportunidade && !usaRotaSantanderHomeEquity) {
      // Eleição de líder: tenta obter o lock no Postgres para evitar race condition entre requisições paralelas.
      // O lock expira em 90s se a requisição líder morrer sem completar.
      const noventaSegundosAtras = new Date(Date.now() - 90 * 1000).toISOString();
      const { data: liderEleito } = await supabase
        .from("simulacoes")
        .update({ oportunidade_lock_em: new Date().toISOString() } as any)
        .match({ id: simulacaoId })
        .is("homefin_id_oportunidade", null)
        .or(`oportunidade_lock_em.is.null,oportunidade_lock_em.lt.${noventaSegundosAtras}`)
        .select("id")
        .maybeSingle();

      if (!liderEleito) {
        // Seguidor: aguarda o líder criar a oportunidade (polling curto)
        const maxWait = 60_000;
        const start = Date.now();
        while (Date.now() - start < maxWait) {
          const { data: retrySim } = await supabase
            .from("simulacoes")
            .select("homefin_id_oportunidade")
            .eq("id", simulacaoId)
            .maybeSingle();
          
          if (retrySim?.homefin_id_oportunidade) {
            idOportunidade = retrySim.homefin_id_oportunidade;
            break;
          }
          await new Promise(r => setTimeout(r, 300));
        }

        if (!idOportunidade) {
          // Timeout no polling: falha apenas esta requisição.
          throw new Error("Não foi possível iniciar a simulação neste banco. Nenhum dado foi enviado ao banco. Clique em reenviar.");
        }
      }
    }

    if (!idOportunidade) {
      // Líder ou Santander Home Equity: executa a criação da oportunidade
      // (Embora o loop de bancos agora seja sequencial, o ID da oportunidade deve ser persistido antes).
      const rendaTotalCalculada = num(sim.compoe_renda_conjuge ? (num(sim.renda_total) + num(sim.renda_conjuge)) : sim.renda_total);
      
      console.log(`[HomeFin] Criando oportunidade para ${sim.numero_simulacao}. Renda Total: ${rendaTotalCalculada}`);
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
        rendaTotal: rendaTotalCalculada,
        dataNascimento: sim.data_nascimento,
        email: sim.email,
        celular: (sim.celular ?? "").replace(/\D/g, ""),
        tipoEstadoCivil: sim.estado_civil ? { id: sim.estado_civil } : undefined,

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
          oportunidade_lock_em: null, // Limpa o lock para permitir reenvios futuros
        } as any)
        .eq("id", simulacaoId);
    }


    if (idOportunidade) {
      await garantirDadosParticipantesSimulacao({ sim, cliente: clienteCompleto, endPrincipal: end, idOportunidade, ctx });
    }
    
    // Auditoria de renda enviada ao banco (Princípio #2d - Log de auditoria)
    const rendaEnviada = num(sim.compoe_renda_conjuge ? (num(sim.renda_total) + num(sim.renda_conjuge)) : sim.renda_total);
    await supabase.from("simulacao_historico").insert({
      simulacao_id: simulacaoId,
      tipo: "info",
      descricao: `Renda total enviada para análise bancária: ${rendaEnviada.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
      ator_id: userId,
    });



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
    // REGRA 3: A simulação só sai de "enviando" quando todos os bancos tiverem desfecho.
    // O loop de bancos é SEQUENCIAL para evitar condições de corrida na oportunidade.
    const resultados: EnviarResultado["bancos"] = [];
    const enviarBanco = async (b: any): Promise<EnviarResultado["bancos"][number]> => {
      // Registrar início do envio para este banco
      await supabase.from("simulacao_bancos").update({ 
        status_banco: "enviando", 
        mensagem_banco: null,
        simulado_em: new Date().toISOString()
      }).eq("id", b.id);


      let timeoutId: any;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Timeout: o banco ${b.nome_banco || ''} não respondeu em 240s.`));
        }, TIMEOUT_BANCO_MS);
      });

      const processarBanco = async () => {
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

        // A resposta da integração traz os valores retornados pelo banco.
        // Em terreno, o Bradesco pode calcular e devolver um prazo mínimo para
        // aquela operação (por exemplo, 180), embora esse piso não seja
        // documentado como constante. Quando isso ocorrer, adotamos exatamente
        // o número informado pela API, sincronizamos oportunidade + simulação e
        // repetimos a integração uma única vez. Não alteramos o mínimo global.
        const endpointIntegracao =
          `/oportunidade/${idOportunidade}/simulacao/${idSimulacao}/integracao`;
        let integ: any;
        try {
          integ = await chamarComRetry<any>(endpointIntegracao, "POST", {});
        } catch (erroIntegracao) {
          const mensagem =
            erroIntegracao instanceof Error ? erroIntegracao.message : String(erroIntegracao);
          const prazoSolicitado = prazoMinimoSolicitadoPeloBanco(mensagem);
          const nomeBanco = String(b.nome_banco ?? "").toLowerCase();
          if (prazoSolicitado != null) {
            await registrarPrazoMinimoAprendido(
              supabase,
              sim.correspondente_id,
              `${codigoBancoNormalizado(b) || nomeBanco}:${sim.tipo_imovel ?? "NA"}`,
              prazoSolicitado,
              userId,
            );
          }
          // Não há prazo mínimo documentado: adotamos exatamente o número que a
          // própria API informou, para qualquer banco e tipo de imóvel.
          const prazoAjustavel =
            prazoSolicitado != null && prazoSolicitado >= PRAZO_MIN && prazoSolicitado <= 420;

          if (!prazoAjustavel || prazoSolicitado === prazoBanco) {
            throw erroIntegracao;
          }

          // O teto por idade dos proponentes é intransponível: se o prazo
          // exigido pelo banco o ultrapassar, a operação é inviável e a
          // mensagem original do banco deve prevalecer.
          const tetoIdade = prazoMaxIdade;
          if (tetoIdade != null && prazoSolicitado > tetoIdade) {
            throw erroIntegracao;
          }

          // O PUT /oportunidade aceita SOMENTE estes três campos. Enviar o
          // objeto completo devolve HTTP 500 INTERNAL_ERROR.
          const oportunidadeAjustada = {
            valorImovel: num(sim.valor_imovel),
            valorFinanciamento: num(sim.valor_financiamento),
            prazo: prazoSolicitado,
          };
          const simulacaoAjustada = { ...putPayload, prazo: prazoSolicitado };

          try {
            await chamarIntegracao<any>(
              `/oportunidade/${idOportunidade}`,
              "PUT",
              oportunidadeAjustada,
              ctx,
            );
            await chamarIntegracao<any>(
              `/oportunidade/${idOportunidade}/simulacao/${idSimulacao}`,
              "PUT",
              simulacaoAjustada,
              ctx,
            );
          } catch (erroAjuste) {
            // Nunca deixar o erro do reenvio mascarar o motivo informado pelo
            // banco (ex.: "prazo igual ou superior a 180").
            console.error("[enviar.server] Falha ao ajustar prazo:", erroAjuste);
            throw erroIntegracao;
          }
          await supabase
            .from("simulacoes")
            .update({ prazo: prazoSolicitado })
            .eq("id", simulacaoId);
          await supabase.from("simulacao_historico").insert({
            simulacao_id: simulacaoId,
            tipo: "ajuste",
            descricao: `Prazo ajustado automaticamente de ${prazoBanco} para ${prazoSolicitado} meses conforme o mínimo devolvido pela API do banco.`,
            ator_id: userId,
          });
          sim.prazo = prazoSolicitado;
          integ = await chamarComRetry<any>(endpointIntegracao, "POST", {});
        }

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
          // Backoff progressivo (3s, 6s, 12s, 24s… teto 30s) com orçamento
          // total de tempo. Encerra imediatamente em desfecho definitivo
          // (situação diferente de "em processamento") para não gastar os
          // ~100s que o laço fixo consumia.
          const ORCAMENTO_MS = 60_000;
          const iniciouPolling = Date.now();
          let espera = 3_000;
          let tentativas = 0;
          let motivoFim = "orcamento_esgotado";

          while (vazio(dadosApi) && Date.now() - iniciouPolling < ORCAMENTO_MS) {
            await new Promise((r) => setTimeout(r, espera));
            espera = Math.min(espera * 2, 30_000);
            tentativas++;
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
                motivoFim = "retorno_recebido";
                break;
              }
              // Desfecho definitivo sem valores: o banco já concluiu e não vai
              // devolver nada. Continuar consultando é desperdício.
              const situacao = String(
                achado?.tipoSituacao ?? achado?.situacao ?? "",
              ).toUpperCase();
              if (situacao && situacao !== "P" && situacao !== "A") {
                motivoFim = `situacao_definitiva_${situacao}`;
                break;
              }
            } catch (e) {
              motivoFim = "falha_consulta";
              console.warn(
                "Falha ao consultar retorno da simulação (polling).",
                e instanceof Error ? e.message : String(e),
              );
              break;
            }
          }

          const duracao = Math.round((Date.now() - iniciouPolling) / 1000);
          try {
            await supabase.from("simulacao_historico").insert({
              simulacao_id: simulacaoId,
              tipo: "info",
              descricao: `Consulta de retorno (${String(b.nome_banco ?? "banco")}): ${tentativas} tentativa(s) em ${duracao}s — ${motivoFim}.`,
            } as any);
          } catch {}
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
            mensagem_banco: null, // Limpa qualquer erro residual de tentativa anterior
            // Marca a ORIGEM dos campos que têm fallback para o valor
            // solicitado: a tela só exibe como resposta do banco o que o banco
            // realmente informou (ver src/lib/simulacao/origem-dados.ts).
            raw_response:
              dados && typeof dados === "object"
                ? { ...(dados as any), _origem_dados: marcarOrigemDados(dadosApi) }
                : dados,

            simulado_em: new Date().toISOString(),
            valor_parcela: dadosApi?.valorParcelaBanco ?? dadosApi?.valorParcelaSimulacao ?? null,
            taxa_juros_ano: dadosApi?.taxa_juros_ano_banco ?? dadosApi?.taxaJurosAnoBanco ?? null,
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
        } finally {
          clearTimeout(timeoutId);
        }
      };

      try {
        return await Promise.race([processarBanco(), timeoutPromise]) as EnviarResultado["bancos"][number];
      } catch (e: any) {
        const base =
          e instanceof IntegracaoBancariaError ? e.message : humanizarErroBanco(null, String(e));
        const msg = base;
        await supabase
          .from("simulacao_bancos")
          .update({ status_banco: "erro", mensagem_banco: msg })
          .eq("id", b.id);
        return { banco_id: b.banco_id, status: "erro" as const, mensagem: msg };
      }
    };


    for (const b of bancos as any[]) {
      resultados.push(await enviarBanco(b));
    }

    // REGRA 3d: Marcar como erro bancos que ficaram sem homefin_id_simulacao_banco
    const { data: bancosFinais } = await supabase
      .from("simulacao_bancos")
      .select("*")
      .eq("simulacao_id", simulacaoId)
      .eq("selecionado", true);

    for (const b of bancosFinais ?? []) {
      if (b.status_banco === "aguardando" && !b.homefin_id_simulacao_banco) {
        const msg = "Não foi possível iniciar a simulação neste banco. Nenhum dado foi enviado ao banco. Clique em reenviar.";
        await supabase.from("simulacao_bancos").update({
          status_banco: "erro",
          mensagem_banco: msg
        }).eq("id", b.id);
      }
    }

    // O comparativo de CPFs (Problema 3) foi removido daqui para evitar conflitos com a lógica de agrupador_id.
    // Agora o comparativo é feito via duas simulações distintas criadas em criarSimulacao.




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
        ? ("enviando" as any)
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

    // REGRA 2: Remoção de sincronização retroativa.
    // O registro da simulação mantém os dados do momento da criação.


    return { oportunidade_id: idOportunidade, status: novoStatus, bancos: resultados };
  } catch (e) {
    const bruto =
      e instanceof IntegracaoBancariaError
        ? e.message
        : e instanceof Error && e.message
          ? e.message
          : "Falha ao enviar ao banco.";
    const msg = sanitizarMensagemErro(bruto);

    // Garante status terminal para TODOS os bancos desta chamada em caso de erro global antes do loop.
    const idsLote = (bancos as any[]).map((b) => b.id);
    if (idsLote.length > 0) {
      await supabase
        .from("simulacao_bancos")
        .update({ status_banco: "erro", mensagem_banco: msg })
        .in("id", idsLote)
        .or('status_banco.eq.aguardando,status_banco.eq.enviando');
    }

    await supabase
      .from("simulacoes")
      .update({ status: "erro_banco", ultimo_erro: msg })
      .eq("id", simulacaoId);
    throw new Error(msg);
  }
}
