/**
 * Pedido parcial (cabeçalho `Range`) para a rota de arquivo selado: o Safari do iPhone só
 * toca vídeo (e áudio) quando o servidor responde `206 Partial Content` aos pedidos de
 * pedaço (`bytes=0-1`, `bytes=1000-`, `bytes=-500`). Pura, para testar sem rede.
 *
 * Devolve a faixa inclusiva, `"invalida"` (o servidor responde 416) ou `null` (sem Range ou
 * Range que não entendemos — vai o arquivo inteiro com 200, como manda o HTTP). Várias
 * faixas numa mesma pergunta (`bytes=0-1,5-9`) também viram arquivo inteiro.
 */
export type Faixa = { ini: number; fim: number };

export function resolverFaixa(cabecalho: string | null | undefined, total: number): Faixa | "invalida" | null {
  if (!cabecalho || total <= 0) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(cabecalho.trim());
  if (!m) return null;
  const [, a, b] = m;
  if (!a && !b) return null;
  let ini: number;
  let fim: number;
  if (!a) {
    // Sufixo: os últimos N bytes.
    const n = Number(b);
    if (!Number.isSafeInteger(n) || n <= 0) return "invalida";
    ini = Math.max(0, total - n);
    fim = total - 1;
  } else {
    ini = Number(a);
    fim = b ? Number(b) : total - 1;
    if (!Number.isSafeInteger(ini) || !Number.isSafeInteger(fim)) return "invalida";
    if (ini >= total || fim < ini) return "invalida";
    fim = Math.min(fim, total - 1);
  }
  return { ini, fim };
}
