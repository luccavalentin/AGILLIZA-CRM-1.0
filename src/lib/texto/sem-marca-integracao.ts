/**
 * Tira o nome do provedor da integração bancária de textos que vêm do banco de
 * dados (histórico, comentários, mensagens de documento e do banco). Os textos
 * novos já são gravados sem ele; os antigos continuam com o nome e passam por
 * aqui na hora de aparecer na tela.
 *
 * Módulo puro (servidor e tela). Mantém a gramática: "à X" → "à integração
 * bancária", "do X" → "da integração bancária", "Recebido X" → "Recebido na
 * integração", "ID X" → "ID", "(X)" some.
 */

const MARCA = String.raw`home\s?fin`;
const ANTES = String.raw`(?<![\p{L}\p{N}_])`;
const DEPOIS = String.raw`(?![\p{L}\p{N}_])`;
const TERMO = "integração bancária";

const re = (corpo: string) => new RegExp(`${ANTES}${corpo}${DEPOIS}`, "giu");

/** Mantém a primeira letra maiúscula quando a original era. */
function comoOriginal(original: string, troca: string): string {
  const inicial = original.charAt(0);
  return inicial !== inicial.toLowerCase() ? troca.charAt(0).toUpperCase() + troca.slice(1) : troca;
}

/** O termo neutro, com maiúscula se estiver no começo de uma frase. */
function noLugar(todo: string, offset: number): string {
  const antes = todo.slice(0, offset);
  return antes.trim() === "" || /[.!?:\n]\s*$/.test(antes) ? comoOriginal("I", TERMO) : TERMO;
}

const MASCULINO_PARA_FEMININO: Record<string, string> = {
  o: "a",
  do: "da",
  no: "na",
  ao: "à",
  pelo: "pela",
};

export function semMarcaIntegracao(texto: string): string;
export function semMarcaIntegracao(texto: string | null | undefined): string | null | undefined;
export function semMarcaIntegracao(texto: string | null | undefined): string | null | undefined {
  if (!texto || !/home\s?fin/i.test(texto)) return texto;
  return (
    texto
      // "[HomeFin] ..." e "banco parceiro (HomeFin)": o nome só identificava a origem.
      .replace(new RegExp(String.raw`\[\s*${MARCA}\s*\]\s*`, "giu"), "")
      .replace(new RegExp(String.raw`\s*\(\s*${MARCA}\s*\)`, "giu"), "")
      // "integração HomeFin" / "API HomeFin" → "integração bancária"
      .replace(re(String.raw`(?:integra[çc][ãa]o|api)\s+${MARCA}`), (m, offset: number, todo: string) =>
        /^api/i.test(m) ? noLugar(todo, offset) : comoOriginal(m, TERMO),
      )
      // "ID HomeFin" → "ID"
      .replace(re(String.raw`(id)\s+${MARCA}`), "$1")
      // "Recebido HomeFin" → "Recebido na integração"
      .replace(re(String.raw`(recebid[oa]s?)\s+${MARCA}`), "$1 na integração")
      // "do/no/ao/pelo/o HomeFin" → "da/na/à/pela/a integração bancária"
      .replace(re(String.raw`(o|do|no|ao|pelo)(\s+)${MARCA}`), (_m, prep: string, esp: string) => {
        const fem = MASCULINO_PARA_FEMININO[prep.toLowerCase()] ?? prep;
        return `${comoOriginal(prep, fem)}${esp}${TERMO}`;
      })
      // Resto ("à/na/da/pela/a HomeFin", "HomeFin" solto): só o nome muda; no
      // começo de frase, com maiúscula.
      .replace(re(MARCA), (_m, offset: number, todo: string) => noLugar(todo, offset))
  );
}
