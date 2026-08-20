/**
 * Streaming do Consultor IA: entrega a resposta token a token (SSE-like),
 * para o usuário ver o texto aparecendo imediatamente.
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  clienteDoToken,
  finalizarResposta,
  gerarTextoStream,
  prepararConsulta,
  MARCADOR_SEM_INFO,
} from "@/lib/consultor-ia/consultor-ia.server";

export const Route = createFileRoute("/api/consultor-ia/stream")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        if (!auth.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = auth.slice(7);
        const supabase = clienteDoToken(token);
        const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
        const userId = claims?.claims?.sub as string | undefined;
        if (claimsErr || !userId) return new Response("Unauthorized", { status: 401 });

        let body: { conversa_id?: string | null; pergunta?: string };
        try {
          body = await request.json();
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        const pergunta = (body.pergunta ?? "").trim();
        if (pergunta.length < 2) return new Response("Pergunta inválida", { status: 400 });

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            const enviar = (evento: Record<string, unknown>) =>
              controller.enqueue(encoder.encode(JSON.stringify(evento) + "\n"));
            try {
              const preparo = await prepararConsulta(supabase, userId, {
                conversa_id: body.conversa_id ?? null,
                pergunta,
              });
              enviar({ tipo: "conversa", conversa_id: preparo.conversaId });

              let bruto = "";
              for await (const pedaco of gerarTextoStream(preparo)) {
                bruto += pedaco;
                // Não exibe os metadados internos enquanto digita.
                const visivel = bruto
                  .replace(new RegExp(MARCADOR_SEM_INFO, "g"), "")
                  .replace(/^FONTES:.*$/gim, "");
                enviar({ tipo: "texto", texto: visivel });
              }

              const fim = await finalizarResposta(
                supabase,
                preparo.conversaId,
                preparo.trechos,
                bruto,
              );
              enviar({ tipo: "fim", ...fim, conversa_id: preparo.conversaId });
            } catch (e) {
              enviar({
                tipo: "erro",
                mensagem: e instanceof Error ? e.message : "Falha ao consultar a IA.",
              });
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "application/x-ndjson; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
          },
        });
      },
    },
  },
});
