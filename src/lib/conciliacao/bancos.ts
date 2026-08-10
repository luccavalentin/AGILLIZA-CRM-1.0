/**
 * Mapeamento extensível dos relatórios oficiais dos bancos.
 *
 * Cada banco declara apenas: o formato do arquivo, a aba (quando XLSX) e os
 * apelidos de cabeçalho de cada campo canônico. Para adicionar um banco novo
 * (ex.: Santander) basta acrescentar uma entrada em `BANCOS_CONCILIACAO` —
 * nenhuma lógica de parsing precisa ser alterada.
 */

/** Linha canônica extraída do relatório do banco. */
export interface LinhaBanco {
  numeroProposta: string | null;
  nomeCliente: string | null;
  /** Dígitos completos — usado só em memória/matching; nunca persistido cru. */
  cpf: string | null;
  status: string | null;
  valorFinanciamento: number | null;
  dataEnvio: string | null;
  dataEmissao: string | null;
  dataAssinatura: string | null;
  produto: string | null;
}

export type CampoCanonico = keyof LinhaBanco;

export interface BancoMapping {
  /** Identificador estável usado no upload. */
  id: string;
  /** Nome exibido e gravado em `conciliacao_lotes.banco_nome`. */
  label: string;
  /** `tab` = texto delimitado por tabulação (o .xls do Bradesco). */
  formato: "tab" | "xlsx";
  /** Nome da aba preferida (XLSX). Cai para a primeira aba se não existir. */
  aba?: string;
  /** Apelidos de cabeçalho por campo canônico (comparados normalizados). */
  colunas: Partial<Record<CampoCanonico, string[]>>;
  /** Indica que o arquivo traz CPF sem máscara (dado sensível). */
  cpfSemMascara?: boolean;
  /** Extensões aceitas no input de arquivo. */
  accept: string;
  /** Se falso, o parser ainda não foi definido (ex.: Santander). */
  disponivel: boolean;
}

export const BANCOS_CONCILIACAO: BancoMapping[] = [
  {
    id: "bradesco",
    label: "Bradesco",
    formato: "tab",
    accept: ".xls,.txt,.tsv,.csv",
    cpfSemMascara: true,
    disponivel: true,
    colunas: {
      numeroProposta: ["NumeroProposta"],
      nomeCliente: ["NomeCliente"],
      cpf: ["CPF"],
      status: ["Status"],
      valorFinanciamento: ["ValorFinanciamento"],
      dataEnvio: ["DataCadastro"],
      dataEmissao: ["DataAtualizacao"],
      produto: ["TipoProposta"],
    },
  },
  {
    id: "itau",
    label: "Itaú",
    formato: "xlsx",
    aba: "Relatório Parceiro",
    accept: ".xlsx,.xls",
    disponivel: true,
    colunas: {
      numeroProposta: ["Numero da Proposta", "Número da Proposta"],
      nomeCliente: ["Nome do Primeiro Comprador"],
      cpf: ["CPF"],
      status: ["Status"],
      valorFinanciamento: ["Valor do Financiamento"],
      dataEnvio: ["Data de Envio"],
      dataEmissao: ["Data de Emissão", "Data de Emissao"],
      dataAssinatura: ["Data de Assinatura"],
      produto: ["Produto"],
    },
  },
  {
    id: "santander",
    label: "Santander",
    formato: "xlsx",
    accept: ".xlsx,.xls",
    disponivel: false,
    colunas: {
      numeroProposta: ["Numero da Proposta", "Número da Proposta", "Proposta"],
      nomeCliente: ["Nome do Cliente", "Cliente"],
      cpf: ["CPF"],
      status: ["Status", "Situação"],
      valorFinanciamento: ["Valor do Financiamento", "ValorFinanciamento"],
    },
  },
];

export function bancoPorId(id: string): BancoMapping | undefined {
  return BANCOS_CONCILIACAO.find((b) => b.id === id);
}

/** Normaliza cabeçalho/texto: minúsculo, sem acento, sem pontuação/espaços. */
export function chaveCabecalho(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Normaliza nome de pessoa para comparação (sem acento, espaços colapsados). */
export function normalizarNome(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Mantém apenas dígitos. */
export function somenteDigitos(v: unknown): string {
  return String(v ?? "").replace(/\D/g, "");
}

/** Mascara o CPF preservando 3 primeiros e 2 últimos dígitos. */
export function mascararCpf(v: unknown): string | null {
  const d = somenteDigitos(v);
  if (!d) {
    const bruto = String(v ?? "").trim();
    return bruto || null;
  }
  if (d.length <= 5) return `${d.slice(0, 3)}**`;
  return `${d.slice(0, 3)}${"*".repeat(Math.max(1, d.length - 5))}${d.slice(-2)}`;
}

/** Converte "R$ 300.000,00" / "300000.00" / número em `number`. */
export function parseValorBR(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).replace(/[R$\s\u00a0]/g, "");
  if (!s) return null;
  const temVirgula = s.includes(",");
  if (temVirgula) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Converte data BR/ISO/serial Excel para `YYYY-MM-DD`. */
export function parseDataBR(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    // Serial Excel (base 1899-12-30).
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (!s) return null;
  const br = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (br) {
    const [, dd, mm, yy] = br;
    const ano = yy!.length === 2 ? `20${yy}` : yy!;
    return `${ano}-${mm!.padStart(2, "0")}-${dd!.padStart(2, "0")}`;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/**
 * Traduz o texto de status do relatório do banco para o enum interno usado em
 * `proposta_bancos.situacao_banco`
 * (nao_enviado | em_analise | condicionado | aprovado | recusado | cancelado).
 * Retorna `null` quando o texto não é reconhecido.
 */
export function situacaoInternaDeTextoBanco(texto: unknown): string | null {
  const t = normalizarNome(texto);
  if (!t) return null;
  if (/(cancel|desist|expirad|encerrad|arquivad)/.test(t)) return "cancelado";
  if (/(recus|reprov|negad|indeferid|nao aprovad|reprovad)/.test(t)) return "recusado";
  if (/(condicion|aprovad[ao] com|pendencia|ressalva|restri)/.test(t)) return "condicionado";
  if (/(assinad|emitid|contratad|formaliz|liberad|registrad|aprovad|deferid)/.test(t))
    return "aprovado";
  if (
    /(analis|andamento|estudo|avaliac|processament|em aberto|aguardand|enviad|cadastrad|digitad)/.test(
      t,
    )
  )
    return "em_analise";
  return null;
}

/** Rótulo legível de uma situação interna. */
export const SITUACAO_LABEL: Record<string, string> = {
  nao_enviado: "Não enviado",
  em_analise: "Em análise de crédito",
  condicionado: "Aprovado com condições",
  aprovado: "Crédito aprovado",
  recusado: "Crédito recusado",
  cancelado: "Cancelado",
};

/** Constrói uma linha canônica a partir de um objeto {cabeçalho: valor}. */
export function montarLinha(mapping: BancoMapping, registro: Record<string, unknown>): LinhaBanco {
  const indice = new Map<string, unknown>();
  for (const [k, v] of Object.entries(registro)) indice.set(chaveCabecalho(k), v);

  const pegar = (campo: CampoCanonico): unknown => {
    for (const alias of mapping.colunas[campo] ?? []) {
      const v = indice.get(chaveCabecalho(alias));
      if (v != null && String(v).trim() !== "") return v;
    }
    return null;
  };

  const txt = (campo: CampoCanonico): string | null => {
    const v = pegar(campo);
    const s = v == null ? "" : String(v).trim();
    return s || null;
  };

  return {
    numeroProposta: txt("numeroProposta"),
    nomeCliente: txt("nomeCliente"),
    cpf: txt("cpf"),
    status: txt("status"),
    valorFinanciamento: parseValorBR(pegar("valorFinanciamento")),
    dataEnvio: parseDataBR(pegar("dataEnvio")),
    dataEmissao: parseDataBR(pegar("dataEmissao")),
    dataAssinatura: parseDataBR(pegar("dataAssinatura")),
    produto: txt("produto"),
  };
}

/** Faz o parse do texto tabulado (relatório .xls do Bradesco, que é texto). */
export function parseTabulado(texto: string, mapping: BancoMapping): LinhaBanco[] {
  const linhas = texto
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((l) => l.trim() !== "");
  if (linhas.length < 2) return [];
  const sep = linhas[0]!.includes("\t") ? "\t" : linhas[0]!.includes(";") ? ";" : ",";
  const cab = linhas[0]!.split(sep).map((c) => c.replace(/^"|"$/g, "").trim());
  const out: LinhaBanco[] = [];
  for (const l of linhas.slice(1)) {
    const cels = l.split(sep).map((c) => c.replace(/^"|"$/g, "").trim());
    const reg: Record<string, unknown> = {};
    cab.forEach((c, i) => {
      reg[c] = cels[i] ?? "";
    });
    const linha = montarLinha(mapping, reg);
    if (linha.numeroProposta || linha.cpf || linha.nomeCliente) out.push(linha);
  }
  return out;
}
