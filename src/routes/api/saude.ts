import { createFileRoute } from "@tanstack/react-router";

/**
 * Sonda de saúde do Agilliza para o monitor de disponibilidade e para a Gestão de
 * Tecnologia (que também sonda o `/api/saude` do Corretor).
 * 200 = app respondendo e banco da plataforma alcançável (ou ponte não configurada,
 * como em desenvolvimento); 503 = ponte configurada e sem resposta.
 * Não expõe versão, host nem mensagem de erro.
 */
export const Route = createFileRoute("/api/saude")({
  server: {
    handlers: {
      GET: async () => {
        const { sondarPonte } = await import("@/lib/plataforma/ponte.server");
        const ponte = await sondarPonte();
        const ok = !ponte.configurada || ponte.ok;
        return Response.json(
          {
            ok,
            banco: ponte.configurada ? (ponte.ok ? "ok" : "indisponivel") : "nao_configurado",
            banco_ms: ponte.ms,
          },
          { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
