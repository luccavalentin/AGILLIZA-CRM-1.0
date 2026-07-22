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
 *  - `codigoOportunidadeBanco` sozinho NÃO confirma sucesso quando o próprio
 *    retorno veio como erro de envio; o status oficial da API prevalece.
 *  - `retornoIntegracao` com erro legível mantém a mensagem específica do banco.
 */
export function ehFalhaIntegracaoBanco(sim: any): boolean {
  const tipo = String(sim?.tipoSituacao ?? "").toUpperCase().charAt(0);
  if (tipo !== "P" && tipo !== "E") return false;
  return true;
}

export const MSG_FALHA_INTEGRACAO =
  "A proposta não foi efetivada no banco (falha na integração). Reenvie para retomar o processo.";

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
      return error.fields.map((f: any) => formatarErroCampo(f)).filter(Boolean).join("; ") || null;
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
    if (c && !(c === "0" || c === "00" || c === "000" || c === "200" || /^(ok|success|sucesso)$/i.test(c))) {
      return `Falha na integração com o banco (código ${c}). A proposta não chegou a ser recebida — reenvie.`;
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
      return { banco: "erro", proposta: null };

    case "S":
      return { banco: "enviada", proposta: "em_analise_credito" };
    default:
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
 *  - `codigoOportunidadeBanco` quando o retorno está em análise/aprovado
 * Códigos de simulação são referência técnica da integração e não devem ser
 * exibidos como número de proposta.
 */
export function numeroPropostaBancoReal(sim: any): string | null {
  const numero = buscarCampoRetorno(sim, [
    "numeroPropostaBanco",
    "numeroProposta",
    "proposalNumber",
    "codigoPropostaBanco",
    "codigoOportunidadeBanco",
  ]);
  return numero == null || numero === "" ? null : String(numero);
}

export function referenciaIntegracaoBanco(sim: any): string | null {
  const referencia = buscarCampoRetorno(sim, [
    "codigoOportunidadeBanco",
    "codigoOportunidadeBancoInterno",
  ]);
  return referencia == null || referencia === "" ? null : String(referencia);
}

export function numeroBancoDaOportunidade(op: any): string | null {
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

export function escolherSimulacaoBanco(pb: any, simulacoes: any[]): any | null {
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

export function statusDaAtividade(atividades: any[]): { status: PropostaStatus | null; detalhe: string | null } {
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
