/**
 * Cores oficiais das marcas dos bancos.
 * Usadas para colorir chips/badges onde há referência a um banco,
 * de modo que cada banco apareça na sua própria cor de marca.
 *
 * Observação: são cores de marca externas (não fazem parte do design system
 * semântico do produto), por isso ficam centralizadas aqui como valores hex.
 */

export interface CorBanco {
  /** Cor principal da marca (usada em texto/borda). */
  cor: string;
}

/** Normaliza o nome do banco para casar com o mapa (sem acento, minúsculo). */
function normalizar(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Mapa de "chave contida no nome" -> cor de marca. */
const MAPA: Array<{ match: string[]; cor: string }> = [
  { match: ["santander"], cor: "#EC0000" },
  { match: ["itau", "itaú"], cor: "#EC7000" },
  { match: ["bradesco"], cor: "#CC092F" },
  { match: ["caixa", "cef"], cor: "#0070B8" },
  { match: ["banco do brasil", "bb"], cor: "#F8C300" },
  { match: ["inter"], cor: "#FF7A00" },
  { match: ["sicredi"], cor: "#3FA110" },
  { match: ["sicoob"], cor: "#003641" },
  { match: ["safra"], cor: "#00337F" },
  { match: ["banrisul"], cor: "#003399" },
  { match: ["pan"], cor: "#00A0DF" },
  { match: ["c6"], cor: "#242424" },
  { match: ["nubank", "nu "], cor: "#820AD1" },
];

/** Cor de fallback (usa o token de marca quando o banco é desconhecido). */
const COR_PADRAO = "#64748b";

/** Retorna a cor de marca para um nome de banco (ou fallback). */
export function corDoBanco(nome: string | null | undefined): string {
  if (!nome) return COR_PADRAO;
  const n = normalizar(nome);
  for (const item of MAPA) {
    if (item.match.some((m) => n.includes(m))) return item.cor;
  }
  return COR_PADRAO;
}
