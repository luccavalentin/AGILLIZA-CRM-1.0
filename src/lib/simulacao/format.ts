/** Utilitários de formatação e máscara para o módulo de simulações. */

export function formatBRL(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo",  style: "currency", currency: "BRL" });
}

export function formatPercent(v: number | null | undefined, casas = 2): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `${(v * 100).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo",  minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

/** Converte texto com máscara BRL ("1.234,56" ou "R$ 1.234,56") em número. */
export function parseBRL(texto: string): number {
  const limpo = texto
    .replace(/[^\d,-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

/** Formata um número como texto de moeda para input (sem prefixo R$). */
export function maskBRLInput(valor: number): string {
  return valor.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo",  minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Máscara de digitação de moeda tratando os dígitos como centavos.
 * Ex.: "" -> "", "4" -> "0,04", "47" -> "0,47", "4700" -> "47,00".
 * Evita o "0,00" fixo que fazia o valor digitado grudar no zero inicial.
 */
export function maskBRLCents(texto: string): string {
  const digits = texto.replace(/\D/g, "");
  if (!digits) return "";
  const n = Number(digits) / 100;
  return n.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo",  minimumFractionDigits: 2, maximumFractionDigits: 2 });
}


export function maskCpfCnpj(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export function maskCelular(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

export function apenasDigitos(v: string): string {
  return v.replace(/\D/g, "");
}

/** Valida CPF (11) ou CNPJ (14) por dígito verificador. */
export function validarCpfCnpj(valor: string): boolean {
  const d = apenasDigitos(valor);
  if (d.length === 11) return validarCpf(d);
  if (d.length === 14) return validarCnpj(d);
  return false;
}

function validarCpf(cpf: string): boolean {
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += Number(cpf[i]) * (10 - i);
  let d1 = (soma * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== Number(cpf[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += Number(cpf[i]) * (11 - i);
  let d2 = (soma * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === Number(cpf[10]);
}

function validarCnpj(cnpj: string): boolean {
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (base: string, pesos: number[]) => {
    const soma = base.split("").reduce((acc, n, i) => acc + Number(n) * pesos[i], 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const p2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(cnpj.slice(0, 12), p1);
  const d2 = calc(cnpj.slice(0, 12) + d1, p2);
  return d1 === Number(cnpj[12]) && d2 === Number(cnpj[13]);
}

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
