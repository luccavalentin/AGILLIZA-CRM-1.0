/**
 * Scan IA — regras DETERMINÍSTICAS sobre o que a IA leu (C17).
 *
 * A IA lê; quem decide se o valor é plausível é o código: dígito verificador de CPF/CNPJ,
 * data que existe no calendário (e que faz sentido para o campo), UF da lista oficial,
 * órgão emissor conhecido, CEP com 8 dígitos, e-mail e telefone com formato. Valor que não
 * passa fica marcado com o motivo e a confiança cai para "revisar" — nunca é apagado nem
 * corrigido sozinho: o operador vê e decide na conferência.
 *
 * Client-safe (sem imports de servidor): a tela usa as mesmas regras ao editar um campo.
 */
import { normalizarData, normalizarNumero } from "./scan-ia-tipos";

export const UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

/** Órgãos emissores de identidade mais comuns (siglas). */
const ORGAOS = [
  "SSP",
  "SDS",
  "SESP",
  "SEJUSP",
  "SESDEC",
  "SEPC",
  "SPTC",
  "SSPDC",
  "SESEG",
  "SEDS",
  "PC",
  "PCMG",
  "DETRAN",
  "IFP",
  "IIPC",
  "IGP",
  "IPF",
  "DGPC",
  "DIC",
  "PM",
  "PMERJ",
  "EB",
  "MAER",
  "MB",
  "DPF",
  "PF",
  "CREA",
  "CRM",
  "OAB",
  "CRC",
  "CRO",
  "CRP",
  "CFM",
  "MTE",
  "MT",
  "SJS",
  "SJTC",
  "CNT",
  "POLITEC",
  "SECC",
  "SSPCE",
  "IN",
  "GOV",
  "SENAPPEN",
  "MD",
  "COREN",
  "CRF",
  "CRMV",
  "CRN",
];

export type Validacao = { valido: boolean; motivo: string | null; normalizado: string | null };

const OK = (normalizado: string | null = null): Validacao => ({
  valido: true,
  motivo: null,
  normalizado,
});
const ERRO = (motivo: string): Validacao => ({ valido: false, motivo, normalizado: null });

function digitos(v: string): string {
  return v.replace(/\D+/g, "");
}

export function cpfValido(v: string): boolean {
  const d = digitos(v);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

export function cnpjValido(v: string): boolean {
  const d = digitos(v);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (n: number) => {
    const pesos =
      n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = pesos.reduce((acc, p, i) => acc + Number(d[i]) * p, 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

/** "dd/mm/aaaa" ou ISO que EXISTE no calendário → yyyy-mm-dd; senão null. */
export function dataReal(v: string): string | null {
  const iso = normalizarData(v);
  if (!iso) return null;
  const [a, m, d] = iso.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(a, m - 1, d));
  if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return iso;
}

function idadeEm(iso: string, hoje: Date): number {
  const [a, m, d] = iso.split("-").map(Number) as [number, number, number];
  let idade = hoje.getUTCFullYear() - a;
  if (hoje.getUTCMonth() + 1 < m || (hoje.getUTCMonth() + 1 === m && hoje.getUTCDate() < d))
    idade--;
  return idade;
}

export function normalizarUf(v: string): string | null {
  const s = v.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase();
  if ((UFS as readonly string[]).includes(s)) return s;
  const porNome: Record<string, string> = {
    ACRE: "AC",
    ALAGOAS: "AL",
    AMAPA: "AP",
    AMAZONAS: "AM",
    BAHIA: "BA",
    CEARA: "CE",
    "DISTRITO FEDERAL": "DF",
    "ESPIRITO SANTO": "ES",
    GOIAS: "GO",
    MARANHAO: "MA",
    "MATO GROSSO": "MT",
    "MATO GROSSO DO SUL": "MS",
    "MINAS GERAIS": "MG",
    PARA: "PA",
    PARAIBA: "PB",
    PARANA: "PR",
    PERNAMBUCO: "PE",
    PIAUI: "PI",
    "RIO DE JANEIRO": "RJ",
    "RIO GRANDE DO NORTE": "RN",
    "RIO GRANDE DO SUL": "RS",
    RONDONIA: "RO",
    RORAIMA: "RR",
    "SANTA CATARINA": "SC",
    "SAO PAULO": "SP",
    SERGIPE: "SE",
    TOCANTINS: "TO",
  };
  return porNome[s] ?? null;
}

/** "SSP/SP", "ssp-sp", "Secretaria de Segurança Pública" → "SSP/SP" | "SSP"; desconhecido → null. */
export function normalizarOrgaoEmissor(v: string): string | null {
  const s = v.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
  if (/SECRETARIA (DE |DA )?SEGURANCA PUBLICA/.test(s)) return "SSP";
  if (/DEPARTAMENTO (ESTADUAL )?DE TRANSITO|^DETRAN/.test(s)) {
    const uf = /\b([A-Z]{2})$/.exec(s)?.[1];
    return uf && normalizarUf(uf) ? `DETRAN/${uf}` : "DETRAN";
  }
  if (/POLICIA CIVIL/.test(s)) return "PC";
  if (/POLICIA FEDERAL/.test(s)) return "DPF";
  const m = /^([A-Z]{2,9})\s*[-/ ]?\s*([A-Z]{2})?$/.exec(s.replace(/\./g, ""));
  if (!m) return null;
  const [, org, uf] = m;
  if (!ORGAOS.includes(org!)) {
    // "SSPSP" (sigla colada com a UF)
    const colada = /^([A-Z]{2,7})([A-Z]{2})$/.exec(org!);
    if (colada && ORGAOS.includes(colada[1]!) && normalizarUf(colada[2]!))
      return `${colada[1]}/${colada[2]}`;
    return null;
  }
  if (uf) return normalizarUf(uf) ? `${org}/${uf}` : null;
  return org!;
}

const CAMPOS_CPF_CNPJ = new Set([
  "cpf_cnpj",
  "cpf_conjuge",
  "cpf_proprietario",
  "vendedor_cpf",
  "comprador_cpf",
]);
const CAMPOS_DATA_PASSADA = new Set([
  "data_expedicao",
  "data_casamento",
  "data_registro",
  "data_abertura_matricula",
  "data_atualizacao_matricula",
  "data_aquisicao",
  "data_transacao",
  "alienacao_data",
]);
const CAMPOS_NASCIMENTO = new Set(["data_nascimento", "data_nascimento_conjuge"]);
const CAMPOS_UF = new Set(["uf_expedicao", "endereco_uf", "uf", "uf_imovel"]);
const CAMPOS_CEP = new Set(["endereco_cep", "cep", "cep_imovel"]);
const CAMPOS_VALOR = new Set([
  "renda_mensal",
  "valor_imovel",
  "valor_venal",
  "valor_transacao",
  "alienacao_valor",
]);

/**
 * Valida UM campo lido. `hoje` é injetável para os testes. Campo sem regra é aceito como
 * veio (a confiança da IA vale).
 */
export function validarCampo(campo: string, valor: string, hoje: Date = new Date()): Validacao {
  const v = (valor ?? "").trim();
  if (!v) return ERRO("Valor vazio.");

  if (CAMPOS_CPF_CNPJ.has(campo)) {
    const d = digitos(v);
    if (d.length === 11) return cpfValido(d) ? OK(d) : ERRO("CPF com dígito verificador inválido.");
    if (d.length === 14)
      return cnpjValido(d) ? OK(d) : ERRO("CNPJ com dígito verificador inválido.");
    return ERRO("CPF/CNPJ precisa de 11 ou 14 dígitos.");
  }
  if (CAMPOS_NASCIMENTO.has(campo)) {
    const iso = dataReal(v);
    if (!iso) return ERRO("Data inexistente ou fora do formato dd/mm/aaaa.");
    const idade = idadeEm(iso, hoje);
    if (idade < 0) return ERRO("Data de nascimento no futuro.");
    if (idade > 110) return ERRO("Data de nascimento implausível (mais de 110 anos).");
    return OK(iso);
  }
  if (CAMPOS_DATA_PASSADA.has(campo)) {
    const iso = dataReal(v);
    if (!iso) return ERRO("Data inexistente ou fora do formato dd/mm/aaaa.");
    if (new Date(`${iso}T00:00:00Z`).getTime() > hoje.getTime() + 86_400_000)
      return ERRO("Data no futuro.");
    if (Number(iso.slice(0, 4)) < 1890) return ERRO("Data implausível.");
    return OK(iso);
  }
  if (CAMPOS_UF.has(campo)) {
    const uf = normalizarUf(v);
    return uf ? OK(uf) : ERRO("UF inexistente.");
  }
  if (campo === "orgao_expedidor") {
    const o = normalizarOrgaoEmissor(v);
    return o ? OK(o) : ERRO("Órgão emissor não reconhecido (ex.: SSP/SP, DETRAN, PC).");
  }
  if (CAMPOS_CEP.has(campo)) {
    const d = digitos(v);
    return d.length === 8 && !/^0{8}$/.test(d) ? OK(d) : ERRO("CEP precisa de 8 dígitos.");
  }
  if (campo === "email") {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
      ? OK(v.toLowerCase())
      : ERRO("E-mail fora do formato.");
  }
  if (campo === "telefone") {
    const d = digitos(v).replace(/^55(?=\d{10,11}$)/, "");
    return d.length === 10 || d.length === 11 ? OK(d) : ERRO("Telefone precisa de DDD + número.");
  }
  if (CAMPOS_VALOR.has(campo)) {
    const n = normalizarNumero(v);
    if (n === null) return ERRO("Valor em dinheiro ilegível.");
    if (n <= 0) return ERRO("Valor precisa ser maior que zero.");
    if (n > 1e9) return ERRO("Valor implausível.");
    return OK(n.toFixed(2));
  }
  if (
    campo === "nome_completo" ||
    campo === "nome_conjuge" ||
    campo === "nome_mae" ||
    campo === "nome_pai"
  ) {
    if (/\d/.test(v)) return ERRO("Nome com números.");
    if (v.split(/\s+/).filter(Boolean).length < 2)
      return ERRO("Nome incompleto (precisa de nome e sobrenome).");
    return OK(v.replace(/\s+/g, " "));
  }
  return OK();
}

/** Confiança final: valor reprovado nas regras nunca passa de 0,3 ("revisar"). */
export function confiancaAjustada(confiancaIa: number, validacao: Validacao): number {
  const c = Math.max(0, Math.min(1, Number.isFinite(confiancaIa) ? confiancaIa : 0));
  return validacao.valido ? c : Math.min(c, 0.3);
}
