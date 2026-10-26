/**
 * Entrega de um arquivo da plataforma pelo endereço selado (`/api/plataforma/midia?t=…`).
 *
 * O selo é emitido pela server function que já conferiu, no banco, que a pessoa pode ver a
 * mídia, e vence em 1 hora (`midias.server.ts`). Aqui só se abre o selo e se buscam os bytes
 * no Agilliza Tech. As dependências vêm de fora para o teste não precisar de rede.
 */

export type Selo = { k: string; m: string; n: string };

export type DependenciasSelada = {
  abrirSelo(token: string): Selo | null;
  lerDoCorretor(chave: string, range: string | null): Promise<Response>;
};

export function disposicao(nome: string): string {
  const original = nome.replace(/[\r\n"\\]/g, "").slice(0, 200) || "arquivo";
  const ascii = original.normalize("NFD").replace(/[^\x20-\x7e]/g, "") || "arquivo";
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(original)}`;
}

/** Só uma faixa de bytes simples vai adiante (`bytes=N-M`, `bytes=N-`, `bytes=-N`); o resto é ignorado. */
const UMA_FAIXA = /^bytes=(\d{1,20}-\d{0,20}|-\d{1,20})$/;

const CSP =
  "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox";

export async function entregarArquivoSelado(request: Request, dep: DependenciasSelada): Promise<Response> {
  const token = new URL(request.url).searchParams.get("t") ?? "";
  const selo = token.length < 2000 ? dep.abrirSelo(token) : null;
  if (!selo)
    return new Response("Endereço vencido ou inválido. Recarregue a página.", {
      status: 404,
    });
  // Vídeo e áudio respondem a pedido parcial (Range → 206): sem isso o Safari do iPhone não
  // toca o vídeo do chat. Auditoria rodada 2: o pedido vai ADIANTE ao Agilliza Tech, que lê só
  // o pedaço em fluxo — antes o arquivo inteiro era baixado para a memória a cada pedaço.
  const midia = /^(video|audio)\//.test(selo.m);
  const pedido = request.headers.get("range")?.trim() ?? "";
  const range = midia && UMA_FAIXA.test(pedido) ? pedido : null;
  const r = await dep.lerDoCorretor(selo.k, range).catch(() => null);
  const comum: Record<string, string> = {
    // O tipo vem do registro no banco: o disco do Corretor não guarda o tipo do arquivo.
    "content-type": selo.m,
    "cache-control": "private, max-age=3600",
    "content-disposition": disposicao(selo.n),
    "x-content-type-options": "nosniff",
    ...(midia ? { "accept-ranges": "bytes" } : {}),
    // Arquivo de usuário nunca roda script no domínio do Agilliza (ex.: SVG/HTML).
    "content-security-policy": CSP,
  };
  if (r && range && r.status === 416) {
    const cr = r.headers.get("content-range") ?? "";
    return new Response(null, {
      status: 416,
      headers: { ...comum, ...(/^bytes \*\/\d+$/.test(cr) ? { "content-range": cr } : {}) },
    });
  }
  if (!r?.ok || !r.body) return new Response("Arquivo indisponível.", { status: 404 });
  const parcial = !!range && r.status === 206 && /^bytes \d+-\d+\/\d+$/.test(r.headers.get("content-range") ?? "");
  if (r.status !== 200 && !parcial) {
    await r.body.cancel().catch(() => {});
    return new Response("Arquivo indisponível.", { status: 404 });
  }
  const tamanho = r.headers.get("content-length");
  return new Response(r.body, {
    status: parcial ? 206 : 200,
    headers: {
      ...comum,
      ...(tamanho && /^\d+$/.test(tamanho) ? { "content-length": tamanho } : {}),
      ...(parcial ? { "content-range": r.headers.get("content-range")! } : {}),
    },
  });
}
