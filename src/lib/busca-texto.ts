/**
 * Busca que ignora acento, maiúscula e ordem das palavras.
 *
 * O `ilike` do Postgres diferencia acento: "Crisleia" não achava
 * "Crisléia" e a cliente parecia ter sumido (26/10/2026). Sem `unaccent` no
 * banco, cada letra que pode levar acento (vogais e c/ç) vira o curinga `_`
 * (exatamente um caractere), que casa com a letra com ou sem acento. Cada
 * palavra do termo é procurada separadamente: "Crisleia Camizao" acha
 * "Crisléia Cássia da Silva Camizão".
 */

const LETRA_COM_ACENTO = /[aeioucáàâãäéèêëíìîïóòôõöúùûüç]/gi;

/** Palavras do termo, sem caracteres que quebram o filtro `or` do PostgREST. */
export function palavrasDaBusca(termo: string): string[] {
  return String(termo ?? "")
    .replace(/["\\%*,()]/g, " ")
    .split(/\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Padrão `ilike` de uma palavra, insensível a acento: "josé" → "j_s_". */
export function padraoSemAcento(palavra: string): string {
  return palavra.replace(LETRA_COM_ACENTO, "_");
}

/**
 * Cláusula para o filtro `or` do PostgREST: a coluna precisa conter todas as
 * palavras do termo, com ou sem acento. Termo só de pontuação não filtra.
 */
export function clausulaTexto(coluna: string, termo: string): string {
  const partes = palavrasDaBusca(termo).map(
    (p) => `${coluna}.ilike."%${padraoSemAcento(p)}%"`,
  );
  if (!partes.length) return `${coluna}.ilike."%"`;
  return partes.length === 1 ? partes[0] : `and(${partes.join(",")})`;
}

/** Texto sem acento e em minúsculas, para comparar na tela. */
export function normalizarBusca(texto: string | null | undefined): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Filtro na tela: true quando algum dos textos contém todas as palavras do
 * termo (ignorando acento e maiúscula). Termo vazio aceita tudo.
 */
export function contemBusca(
  textos: ReadonlyArray<string | number | null | undefined>,
  termo: string,
): boolean {
  const bruto = String(termo ?? "").trim();
  // CPF/CNPJ com pontuação ("309.399.608-26"): o gravado costuma ser só dígito.
  const soDocumento = /^[\d.\-/\s]+$/.test(bruto) && /\d/.test(bruto);
  const palavras = soDocumento
    ? [bruto.replace(/\D/g, "")]
    : normalizarBusca(bruto).split(/\s+/).filter(Boolean);
  if (!palavras.length) return true;
  const alvo = textos
    .map((t) => {
      const s = normalizarBusca(t == null ? "" : String(t));
      return soDocumento ? `${s} ${s.replace(/\D/g, "")}` : s;
    })
    .join(" ");
  return palavras.every((p) => alvo.includes(p));
}
