/**
 * Mensagem do banco em texto que o operador entende.
 *
 * Módulo puro (servidor e tela). O retorno da integração às vezes é o JSON
 * inteiro do provedor — o Santander devolve `{"error":{"error@context":{…}}}`
 * com centenas de KB e nenhuma mensagem — e isso ia parar na tela. Aqui:
 *  - se houver uma frase legível dentro do retorno, ela é extraída;
 *  - se o retorno for só técnico, vira uma orientação curta;
 *  - textos longos são encurtados.
 */

const LIMITE = 280;

const CHAVES_MENSAGEM = ["mensagem", "message", "descricaoMotivo", "error_description", "detail"];

/** Parece JSON/stack, não frase: não deve ir para a tela como está. */
function ehTecnico(texto: string): boolean {
  const t = texto.trim();
  return /^[[{]/.test(t) || /"[\w@.]+"\s*:/.test(t) || /\bat\s+\S+\s+\(/.test(t);
}

function limpar(frase: string): string {
  return frase
    .replace(/\\n[\s\S]*$/, "")
    .replace(/\\"/g, '"')
    .replace(/^\s*(AppError\s+)?[A-Z]{2,5}-\d{2,4}:\s*/i, "")
    .replace(/^N[aã]o foi poss[ií]vel recuperar os dados solicitados:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Primeira frase legível dentro de um retorno técnico, se houver. */
function fraseDentro(texto: string): string | null {
  for (const chave of CHAVES_MENSAGEM) {
    const re = new RegExp(`"${chave}"\\s*:\\s*"((?:[^"\\\\]|\\\\.){3,400})"`, "i");
    const m = texto.match(re);
    if (m) {
      const frase = limpar(m[1]);
      if (frase && !ehTecnico(frase)) return frase;
    }
  }
  // "AppError STD-001: Nao foi possivel recuperar os dados solicitados: Favor inserir…"
  const stack = texto.match(/[A-Z]{2,5}-\d{2,4}:\s*((?:[^"\\]|\\[^n"])+)/);
  if (stack) {
    const frase = limpar(stack[1]);
    if (frase) return frase;
  }
  return null;
}

function encurtar(frase: string): string {
  return frase.length > LIMITE ? `${frase.slice(0, LIMITE - 1).trimEnd()}…` : frase;
}

export function semMotivoDoBanco(nomeBanco?: string | null): string {
  const banco = String(nomeBanco ?? "").trim() || "O banco";
  return `${banco} recusou o envio sem informar o motivo. Tente enviar de novo em alguns minutos; se continuar, acione a HomeFin.`;
}

export function mensagemBancoLegivel(msg: unknown, nomeBanco?: string | null): string {
  const texto = String(msg ?? "").trim();
  if (!texto) return "";
  if (/erro desconhecido na integra/i.test(texto) && texto.length < 80) {
    return semMotivoDoBanco(nomeBanco);
  }
  if (!ehTecnico(texto)) return encurtar(texto);
  const frase = fraseDentro(texto);
  return frase ? encurtar(frase) : semMotivoDoBanco(nomeBanco);
}
