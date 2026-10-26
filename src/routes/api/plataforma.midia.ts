import { createFileRoute } from "@tanstack/react-router";

/**
 * Entrega de um arquivo da plataforma (capa da News, anexo do suporte, foto do marketplace).
 *
 * O endereço só existe selado (`?t=…`, ver `lib/plataforma/midias.server.ts`): o selo é
 * emitido pela server function que já conferiu, no banco, que a pessoa pode ver a mídia,
 * e vence em 1 hora. Aqui só se abre o selo e se buscam os bytes no Corretor.
 */
function disposicao(nome: string): string {
  const original = nome.replace(/[\r\n"\\]/g, "").slice(0, 200) || "arquivo";
  const ascii = original.normalize("NFD").replace(/[^\x20-\x7e]/g, "") || "arquivo";
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(original)}`;
}

export const Route = createFileRoute("/api/plataforma/midia")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { abrirSelo, lerDoCorretor } = await import("@/lib/plataforma/midias.server");
        const token = new URL(request.url).searchParams.get("t") ?? "";
        const selo = token.length < 2000 ? abrirSelo(token) : null;
        if (!selo)
          return new Response("Endereço vencido ou inválido. Recarregue a página.", {
            status: 404,
          });
        const r = await lerDoCorretor(selo.k).catch(() => null);
        if (!r?.ok || !r.body) return new Response("Arquivo indisponível.", { status: 404 });
        // Vídeo e áudio respondem a pedido parcial (Range → 206): sem isso o Safari do iPhone
        // não toca o vídeo do chat. O arquivo do chat tem até 16 MB; o pedaço sai da memória.
        const midia = /^(video|audio)\//.test(selo.m);
        const pedido = request.headers.get("range");
        if (midia && pedido) {
          const { resolverFaixa } = await import("@/lib/plataforma/faixa-bytes");
          const tudo = new Uint8Array(await r.arrayBuffer());
          const faixa = resolverFaixa(pedido, tudo.byteLength);
          if (faixa === "invalida") {
            return new Response(null, { status: 416, headers: { "content-range": `bytes */${tudo.byteLength}` } });
          }
          const comum = {
            "content-type": selo.m,
            "accept-ranges": "bytes",
            "cache-control": "private, max-age=3600",
            "content-disposition": disposicao(selo.n),
            "x-content-type-options": "nosniff",
          };
          if (faixa) {
            const pedaco = tudo.subarray(faixa.ini, faixa.fim + 1);
            return new Response(pedaco, {
              status: 206,
              headers: {
                ...comum,
                "content-length": String(pedaco.byteLength),
                "content-range": `bytes ${faixa.ini}-${faixa.fim}/${tudo.byteLength}`,
              },
            });
          }
          return new Response(tudo, { headers: { ...comum, "content-length": String(tudo.byteLength) } });
        }
        return new Response(r.body, {
          headers: {
            // O tipo vem do registro no banco: o disco do Corretor não guarda o tipo do arquivo.
            "content-type": selo.m,
            ...(r.headers.get("content-length")
              ? { "content-length": r.headers.get("content-length")! }
              : {}),
            "cache-control": "private, max-age=3600",
            "content-disposition": disposicao(selo.n),
            "x-content-type-options": "nosniff",
            ...(midia ? { "accept-ranges": "bytes" } : {}),
            // Arquivo de usuário nunca roda script no domínio do Agilliza (ex.: SVG/HTML).
            "content-security-policy":
              "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox",
          },
        });
      },
    },
  },
});
