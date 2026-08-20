import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/sync-propostas-ativas")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        
        // Short-circuit: 0 propostas ativas = 0 trabalho
        const { count, error: countErr } = await supabaseAdmin
          .from("propostas")
          .select("id", { count: "exact", head: true })
          .in("status", ["enviada_banco", "em_analise_credito", "aguardando_documentos", "engenharia_vistoria", "analise_juridica"] as any);

        if (countErr) return new Response(countErr.message, { status: 500 });
        
        if (!count || count === 0) {
          console.info("[CRON] Short-circuit: Nenhuma proposta ativa para sincronizar.");
          return Response.json({ ok: true, processadas: 0, motivo: "short-circuit" });
        }

        // ... lógica de sincronização pesada viria aqui ...
        // Por enquanto apenas logamos que haveria trabalho
        console.info(`[CRON] Identificadas ${count} propostas ativas. Iniciando sync...`);
        
        return Response.json({ ok: true, processadas: count });
      }
    }
  }
});