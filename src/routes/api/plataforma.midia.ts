import { createFileRoute } from "@tanstack/react-router";

/**
 * Entrega de um arquivo da plataforma (capa da News, anexo do suporte, foto do marketplace).
 *
 * O endereço só existe selado (`?t=…`, ver `lib/plataforma/midias.server.ts`): o selo é
 * emitido pela server function que já conferiu, no banco, que a pessoa pode ver a mídia,
 * e vence em 1 hora. A entrega (inclusive `Range` para vídeo/áudio) está em
 * `lib/plataforma/entrega-selada.ts`.
 */
export const Route = createFileRoute("/api/plataforma/midia")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Matrícula pronta baixada pelo portal do assinante (vale de uso único, 2 min,
        // emitido pelo Agilliza Tech só para quem pediu — 0323 / 20261027040022).
        const vale = new URL(request.url).searchParams.get("m");
        if (vale !== null) {
          const { baixarMatriculaPorVale } = await import("@/lib/matriculas/download.server");
          return baixarMatriculaPorVale(vale);
        }
        const { abrirSelo, lerDoCorretor } = await import("@/lib/plataforma/midias.server");
        const { entregarArquivoSelado } = await import("@/lib/plataforma/entrega-selada");
        return entregarArquivoSelado(request, { abrirSelo, lerDoCorretor });
      },
    },
  },
});
