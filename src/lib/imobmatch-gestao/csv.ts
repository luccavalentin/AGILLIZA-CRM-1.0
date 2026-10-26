/**
 * CSV das faturas do ImobMatch (ImobMatch Gestão › Financeiro). Puro (testado em csv.test.ts).
 *
 * Feito para abrir no Excel em português: separador ";", vírgula decimal, BOM UTF-8 e
 * data dd/mm/aaaa. Célula que começa com = + - @ (ou tab/CR) ganha um apóstrofo na frente:
 * o nome de uma conta nunca vira fórmula na planilha de quem exporta (injeção de CSV).
 */

export type ValorCsv = string | number | boolean | null | undefined;

const FORMULA = /^[=+\-@\t\r]/;

export function celulaCsv(v: ValorCsv): string {
  if (v == null) return "";
  let s = typeof v === "number" ? numeroCsv(v) : String(v);
  if (typeof v !== "number" && FORMULA.test(s)) s = `'${s}`;
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** 1234.5 → "1234,50" (sem separador de milhar: a planilha entende como número). */
export function numeroCsv(n: number): string {
  if (!Number.isFinite(n)) return "";
  return n.toFixed(2).replace(".", ",");
}

/** "2026-10-28" ou instante ISO → "28/10/2026" (instante no horário de Brasília). */
export function dataCsv(s: string | null | undefined): string {
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.split("-").reverse().join("/");
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function montarCsv(cabecalho: string[], linhas: ValorCsv[][]): string {
  const corpo = [cabecalho, ...linhas].map((l) => l.map(celulaCsv).join(";")).join("\r\n");
  return "\uFEFF" + corpo + "\r\n";
}

/** Nome do arquivo: imobmatch-faturas-2026-10-01-a-2026-10-28.csv */
export function nomeArquivoFaturas(de: string, ate: string): string {
  const limpo = (s: string) => s.replace(/[^0-9-]/g, "");
  return `imobmatch-faturas-${limpo(de)}-a-${limpo(ate)}.csv`;
}
