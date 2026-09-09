/**
 * Helpers puros que traduzem o retorno da integração bancária em status/campos
 * usados pelo sistema. Extraídos de `enviar.server.ts` sem alteração de
 * comportamento. Nenhuma dependência de Supabase/rede — 100 % determinísticos.
 */
import type { PropostaStatus } from "../state-machine";
import { normalizarTexto } from "./shared-utils";

/** Deriva o status interno a partir do nome da etapa ativa retornada pelo banco. */
export function statusDaEtapa(nomeEtapa: string | null): PropostaStatus | null {
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
  if (n.includes("juríd") || n.includes("jurid") || n.includes("emiss")) return "analise_juridica";
  if (n.includes("vistoria") || n.includes("engenharia") || n.includes("avaliaç"))
    return "engenharia_vistoria";
  if (n.includes("document")) return "aguardando_documentos";
  // Antes de "aprov": "aprovado com condições" contém as duas palavras.
  if (n.includes("condicion") || n.includes("ressalva")) return "credito_condicionado";
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

/**
 * Detecta o cenário em que a integração devolveu "erro" mas a proposta
 * NUNCA foi de fato efetivada na esteira do banco (falha de integração).
 *
 * DOMÍNIO OFICIAL de `tipoSituacao` (swagger 29/01/2026, schemas
 * CreateProposalOk e SimulationIntegrationResponse — texto literal
 * "S/P/N/A/R (Sem Integração/Erro ao Enviar Proposta/Análise Crédito/Crédito
 * Aprovado/Crédito Recusado)"):
 *
 *   S = Sem Integração          (não foi enviado ao banco)
 *   P = Erro ao Enviar Proposta (falha de integração)
 *   N = Análise de Crédito      (chegou ao banco, em análise)
 *   A = Crédito Aprovado
 *   R = Crédito Recusado
 *
 * O comentário anterior aqui dizia outra coisa — "N = Negada", "P =
 * Pendente/Simulada", "C = Condicionada" — e foi a origem do bug que exibia
 * como recusada toda proposta que o banco havia colocado em análise.
 *
 * FORA DO CONTRATO, mas observados em produção:
 *   E = falha definitiva. 1.490 ocorrências desde 14/07. Vem com
 *       `dataHoraEnvioIntegracao: null` e nunca evolui (a simulação 93588
 *       seguia "E" meia hora depois). Tratado como P.
 *   C = observado 22 mil vezes em simulações e uma vez em proposta, esta com
 *       protocolo e parcela do banco — comportamento de desfecho favorável,
 *       que é como o tratamos. Não está documentado; se algum dia aparecer
 *       um "C" sem protocolo, a hipótese precisa ser revista.
 *
 * Regras (a proposta CHEGOU ao banco quando existe protocolo):
 *  - "R" (Recusa) e "N" (Negada) são decisões REAIS de crédito — nunca falha técnica.
 *  - "A" (Aprovada) e "C" (Condicionada) são desfechos FAVORÁVEIS.
 *  - **Só persiste numero_proposta_banco quando existir evidência de envio real**
 *    no log HTTP (status 2xx para incluir-proposta-integracao). Sem isso,
 *    qualquer código no retorno é apenas referência da simulação.
 *  - O discriminator `tipoSituacao` é apenas indicativo; a persistência do
 *    protocolo é regida pela presença do log de confirmação de envio.
 */
export function ehFalhaIntegracaoBanco(sim: any): boolean {
  const tipo = String(sim?.tipoSituacao ?? "")
    .toUpperCase()
    .charAt(0);
  // P (Pendente) ou E (Erro) sem protocolo real é falha de integração.
  if (tipo !== "P" && tipo !== "E") return false;
  if (numeroPropostaBancoReal(sim) || referenciaIntegracaoBanco(sim)) return false;
  return true;
}

export const MSG_FALHA_INTEGRACAO =
  "A proposta ainda não foi recebida pelo banco devido a uma falha na comunicação. Por favor, revise os dados do cliente e tente reenviar.";

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
  documenttype: "Tipo de documento",
  tipodocumentoidentidade: "Tipo de documento",
  numerodocumento: "Número do documento",
  orgaoexpedidor: "Órgão expedidor",
  ufexpedicao: "UF de expedição",
  dataexpedicao: "Data de expedição",
  nomeconjuge: "Nome do cônjuge",
  cpfconjuge: "CPF do cônjuge",
  tipodocumentoidentidadeconjuge: "Tipo de documento do cônjuge",
  numerodocumentoconjuge: "Número do documento do cônjuge",
  orgaoexpedidorconjuge: "Órgão expedidor do cônjuge",
  ufexpedicaoconjuge: "UF de expedição do cônjuge",
  dataexpedicaoconjuge: "Data de expedição do cônjuge",
  tipoestadocivilconjuge: "Estado civil do cônjuge",
  rendaconjuge: "Renda do cônjuge",
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
export function extrairErroRetorno(
  retorno: unknown,
  opts: { codigoApenasComoErro?: boolean } = {},
): string | null {
  const codigoApenasComoErro = opts.codigoApenasComoErro ?? true;
  if (!retorno) return null;
  let obj: any = retorno;
  if (typeof retorno === "string") {
    try {
      obj = JSON.parse(retorno);
    } catch {
      const texto = retorno.trim();
      if (!texto) return null;
      if (!codigoApenasComoErro && /^[A-Z0-9_.-]{1,16}$/i.test(texto)) return null;
      return texto;
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
      return (
        error.fields
          .map((f: any) => formatarErroCampo(f))
          .filter(Boolean)
          .join("; ") || null
      );
    }
    if (error.message) return String(error.message);
  }
  // Alguns bancos devolvem apenas `{codigo:"121-L", mensagem:""}` — código sem
  // texto ainda indica falha na integração (a proposta não chegou ao banco).
  const codigo = obj?.codigo ?? obj?.code ?? null;
  if (codigo && codigoApenasComoErro) {
    const c = String(codigo).trim();
    // Só códigos exatamente positivos indicam sucesso; prefixos como "01.03"
    // podem ser códigos de fase/erro do banco e não devem ser mascarados.
    if (
      c &&
      !(c === "0" || c === "00" || c === "000" || c === "200" || /^(ok|success|sucesso)$/i.test(c))
    ) {
      // Quando retornoIntegracao vier vazio ({"error":{}}) ou apenas com código,
      // orientar o acionamento do suporte.
      const erroVazio =
        typeof obj?.error === "object" &&
        obj?.error !== null &&
        Object.keys(obj.error).length === 0;

      if (erroVazio) {
        return `O banco não informou o motivo da recusa (código ${c}). Por favor, acione o suporte técnico com o número desta proposta.`;
      }
      return `A proposta não foi efetivada no banco (falha na integração - código ${c}).`;
    }
  }
  return null;
}

/** Traduz o tipoSituacao da proposta (por banco) para status interno do banco. */
export function statusInternoBanco(
  tipo: string,
  temErro: boolean,
  codigoSituacaoBanco?: string | null,
  sim?: any,
): {
  banco: string;
  proposta: PropostaStatus | "credito_recusado" | null;
} {
  // Falha de integração (Bradesco: "R"/"E" sem token do banco e código de fase
  // de simulação): a proposta NÃO chegou ao banco. Trata como erro recuperável,
  // NÃO como recusa de crédito.
  if (sim && ehFalhaIntegracaoBanco(sim)) return { banco: "erro", proposta: null };

  const t = String(tipo ?? "")
    .toUpperCase()
    .charAt(0);

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
    codigoNumerico === "514" ||
    // `N` NÃO é recusa: no contrato da integração o tipoSituacao segue
    // S/P/N/A/R = Sem Integração / Erro ao Enviar Proposta / Análise de
    // Crédito / Crédito Aprovado / Crédito Recusado. Recusa é `R`.
    //
    // Com `N` aqui dentro, toda proposta que o banco colocou EM ANÁLISE
    // aparecia como "Crédito recusado" — e o `case "N"` logo abaixo, que
    // mapeia para `em_analise`, era código morto que nunca executava.
    t === "R"
  ) {
    return { banco: "recusada", proposta: "credito_recusado" };
  }
  // CONDICIONADO é aprovação COM EXIGÊNCIAS a cumprir, e só o texto do banco
  // diz isso. Antes bastava `tipoSituacao === "C"` para cair aqui, e estava
  // errado: o Santander devolve `C` com "513 ANÁLISE AUTOMÁTICA FAVORÁVEL",
  // que é aprovação plena. Toda análise favorável do Santander aparecia como
  // "Aprovado com condições" sem que houvesse condição nenhuma.
  //
  // A checagem por texto vem ANTES da de aprovação porque um retorno pode
  // dizer as duas coisas ("aprovado condicionado") — e aí a condição manda.
  if (codigo.includes("cond") || codigo.includes("ressalva") || codigo.includes("exigencia")) {
    return { banco: "condicionado", proposta: "credito_condicionado" };
  }
  if (codigo.includes("aprov") || codigo.includes("favoravel")) {
    return { banco: "aprovada", proposta: "credito_aprovado" };
  }
  switch (t) {
    case "A":
      return { banco: "aprovada", proposta: "credito_aprovado" };
    // `C` fora do contrato S/P/N/A/R. O único uso observado em produção é o
    // do Santander com o código 513 (favorável), então é desfecho aprovado —
    // um "C" que trouxesse condição já teria sido capturado pelo texto acima.
    case "C":
      return { banco: "aprovada", proposta: "credito_aprovado" };
    case "R":
      return { banco: "recusada", proposta: "credito_recusado" };
    case "N":
      return { banco: "em_analise", proposta: "em_analise_credito" };
  }

  // Só considera "erro" quando o próprio provedor sinalizou falha de envio
  // (tipoSituacao P/E). Mensagens em `retornoIntegracao` sem esse sinal são
  // apenas observações/validações do banco e NÃO devem virar "Erro no envio"
  // — se a API devolveu tipoSituacao (N/A/R/S), a proposta chegou ao banco.
  switch (t) {
    case "P":
    case "E":
      return { banco: "erro", proposta: null };

    // "Sem Integração" quer dizer que a proposta NÃO foi ao banco. Marcá-la
    // como "enviada" era o oposto do que o código significa, e escondia do
    // operador que ainda faltava enviar. (Nunca observado em produção: zero
    // ocorrências em 175 mil retornos — a correção alinha ao contrato.)
    case "S":
      return { banco: "nao_enviado", proposta: null };
    default:
      // Sem tipoSituacao conhecido: assume "enviada" (aguardando retorno).
      // Preserva a mensagem em `mensagem_banco` sem classificar como erro.
      return { banco: "enviada", proposta: null };
  }
}

/**
 * Traduz o `tipoSituacao` cru do banco (S/P/N/A/R) para o enum interno usado
 * na coluna `proposta_bancos.situacao_banco` e no <Select> "Situação de crédito"
 * (nao_enviado/em_analise/condicionado/aprovado/recusado/cancelado).
 */
export function situacaoBancoDeTipo(
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
    Boolean(b.numero_proposta_banco) || STATUS_BANCO_JA_ENVIADO.has(String(b.status_banco ?? ""))
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

function normalizarChaveRetorno(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Busca RASA: só as chaves próprias do objeto da simulação e dos seus
 * envelopes diretos de resposta (`descricaoRespostaBanco`, `retornoIntegracao`).
 *
 * Nunca desce recursivamente por arrays/objetos aninhados — era exatamente
 * assim que o protocolo de uma proposta/banco vazava para outra: o payload da
 * oportunidade carrega TODAS as simulações e a busca profunda acabava pegando
 * o número da simulação vizinha (outro banco).
 */
function buscarCampoRaso(obj: unknown, chaves: string[]): string | null {
  if (obj == null || typeof obj !== "object") return null;
  const alvo = new Set(chaves.map(normalizarChaveRetorno));
  const escopos: Array<Record<string, unknown>> = [obj as Record<string, unknown>];
  for (const envelope of ["descricaoRespostaBanco", "retornoIntegracao"]) {
    const v = (obj as Record<string, unknown>)[envelope];
    if (v && typeof v === "object") escopos.push(v as Record<string, unknown>);
    else if (typeof v === "string" && v.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(v);
        if (parsed && typeof parsed === "object") escopos.push(parsed);
      } catch {
        // envelope não-JSON: ignorado de propósito
      }
    }
  }
  for (const escopo of escopos) {
    for (const [k, v] of Object.entries(escopo)) {
      if (v == null || typeof v === "object") continue;
      if (alvo.has(normalizarChaveRetorno(k)) && String(v).trim()) return String(v).trim();
    }
  }
  return null;
}

/** Um protocolo de banco é um código curto alfanumérico — nunca um UUID. */
function protocoloValido(valor: string | null): string | null {
  const v = valor == null ? "" : String(valor).trim();
  if (!v) return null;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return null;
  if (v.length > 30) return null;
  return v;
}

/**
 * Número real da proposta no banco. A API devolve, dependendo da instituição:
 *  - `numeroPropostaBanco` / `numeroProposta` / `proposalNumber` / `codigoPropostaBanco`
 *  - `codigoOportunidadeBanco` quando o retorno está em análise/aprovado
 *
 * PROTOCOLO GRAVADO SEM ENVIO DE PROPOSTA
 * Só gravar numero_proposta_banco quando a proposta tiver sido de fato enviada.
 * A regra é:
 * a) Se existe incluir-proposta-integracao com HTTP 2xx para ESTA proposta,
 *    então o protocolo PODE ser lido do GET /oportunidade — casando pelo idSimulacao,
 *    campo codigoOportunidadeBanco.
 * b) Sem esse log 2xx, continua proibido gravar (evita protocolos fantasmas).
 * c) Ordem de busca: codigoOportunidadeBanco do POST → codigoOportunidadeBanco do GET.
 * d) Referências técnicas (UUIDs) são filtradas.
 */
export function numeroPropostaBancoReal(sim: any, enviouReal: boolean = false): string | null {
  const tipo = String(sim?.tipoSituacao ?? "")
    .toUpperCase()
    .charAt(0);

  // Se não enviou real (log 2xx), só aceita se for status terminal (A/R/N/C)
  // que indica que a esteira já andou.
  const terminal = tipo === "A" || tipo === "R" || tipo === "N" || tipo === "C";
  if (!enviouReal && !terminal) return null;

  return protocoloValido(
    buscarCampoRaso(sim, [
      "numeroPropostaBanco",
      "numeroProposta",
      "proposalNumber",
      "codigoPropostaBanco",
      "codigoOportunidadeBanco",
    ]),
  );
}

export function referenciaIntegracaoBanco(sim: any): string | null {
  return protocoloValido(
    buscarCampoRaso(sim, ["codigoOportunidadeBancoInterno", "codigoSimulacaoBanco"]),
  );
}

export function numeroBancoDaOportunidade(op: any): string | null {
  // Busca RASA: o payload da oportunidade contém as simulações de TODOS os
  // bancos; descer nele copiaria o protocolo de um banco para outro.
  return protocoloValido(
    buscarCampoRaso(op, [
      "numeroPropostaBanco",
      "numeroProposta",
      "proposalNumber",
      "codigoPropostaBanco",
      "codigoOportunidadeBanco",
    ]),
  );
}

export function numeroAtualEhReferenciaTecnica(pb: any, sim: any): boolean {
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
  const erroMsg = extrairErroRetorno(
    sim?.retornoIntegracao ?? sim?.descricaoRespostaBanco?.retornoIntegracao,
  );
  const mapa = statusInternoBanco(
    sim?.tipoSituacao,
    Boolean(erroMsg),
    sim?.codigoSituacaoBanco,
    sim,
  );
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

export function escolherSimulacaoBanco(pb: any, simulacoes: any[]): any | null {
  const idPb = String(pb?.homefin_id_simulacao_banco ?? "");
  const candidatas = simulacoes
    .map((sim) => ({
      sim,
      exata: idPb.length > 0 && String(sim?.idSimulacao) === idPb,
    }))
    .filter(({ sim, exata }) => exata); // 2. Casar pelo idSimulacao da PRÓPRIA proposta

  if (!candidatas.length) {
    // Fallback apenas se não achou pelo ID exato, tenta pelo banco
    const porBanco = simulacoes.filter((sim) => mesmoBanco(pb, sim));
    if (!porBanco.length) return null;
    return porBanco.sort(
      (a, b) => prioridadeSimulacao(b, false) - prioridadeSimulacao(a, false),
    )[0];
  }

  return candidatas.sort(
    (a, b) => prioridadeSimulacao(b.sim, b.exata) - prioridadeSimulacao(a.sim, a.exata),
  )[0].sim;
}

export function statusDaAtividade(atividades: any[]): {
  status: PropostaStatus | null;
  detalhe: string | null;
} {
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
    // Antes da checagem de aprovação: "crédito aprovado condicionado" contém
    // as duas palavras, e com a ordem invertida o condicionado nunca era
    // alcançado — a etapa entrava como aprovação plena.
    if (n.includes("condicionado") || n.includes("condicional")) {
      return { status: "credito_condicionado", detalhe: nome || null };
    }
    if (n.includes("credito aprovado") || n.includes("aprovado")) {
      return { status: "credito_aprovado", detalhe: nome || null };
    }
    if (n.includes("analise de credito") || n.includes("credito")) {
      return { status: "em_analise_credito", detalhe: nome || null };
    }
  }
  return { status: null, detalhe: null };
}
