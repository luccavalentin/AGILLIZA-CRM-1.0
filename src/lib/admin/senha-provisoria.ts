/**
 * Senha provisória sorteada pelo servidor (decisão 15 do backtest de 23/10/2026).
 *
 * Antes a senha provisória era o próprio e-mail: quem cadastrava (e quem soubesse o
 * e-mail) entrava como a pessoa. Agora ela é sorteada com o gerador criptográfico,
 * vai SÓ para o e-mail da pessoa (fila de e-mail da plataforma) e nunca volta para a
 * tela de quem cadastrou. A troca obrigatória no primeiro acesso continua igual.
 *
 * Alfabeto sem caracteres que se confundem (0/O, 1/l/I) e sem os que o HTML do
 * e-mail precisaria escapar (& < > " '). 16 caracteres de 64 símbolos ≈ 96 bits.
 */
const MAIUSCULAS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const MINUSCULAS = "abcdefghijkmnpqrstuvwxyz";
const DIGITOS = "23456789";
const SIMBOLOS = "!#$%*+-=?@";
const TODOS = MAIUSCULAS + MINUSCULAS + DIGITOS + SIMBOLOS;

/** Índice uniforme em [0, n) — descarta o resto da divisão para não viciar o sorteio. */
function sortear(n: number): number {
  const limite = Math.floor(256 / n) * n;
  const b = new Uint8Array(1);
  for (;;) {
    globalThis.crypto.getRandomValues(b);
    if (b[0]! < limite) return b[0]! % n;
  }
}

const um = (s: string) => s[sortear(s.length)]!;

/** Senha forte: ao menos uma maiúscula, uma minúscula, um dígito e um símbolo. */
export function gerarSenhaProvisoria(tamanho = 16): string {
  const n = Math.max(12, Math.min(64, Math.floor(tamanho)));
  const c = [um(MAIUSCULAS), um(MINUSCULAS), um(DIGITOS), um(SIMBOLOS)];
  while (c.length < n) c.push(um(TODOS));
  // Embaralha (Fisher–Yates) para as quatro garantidas não ficarem sempre no começo.
  for (let i = c.length - 1; i > 0; i--) {
    const j = sortear(i + 1);
    [c[i], c[j]] = [c[j]!, c[i]!];
  }
  return c.join("");
}
