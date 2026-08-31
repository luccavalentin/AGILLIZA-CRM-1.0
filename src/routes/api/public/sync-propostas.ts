import { createFileRoute } from "@tanstack/react-router";

/**
 * Sincronização automática de propostas ativas (polling agendado).
 * A integração bancária não possui webhook/callback — este endpoint é
 * chamado periodicamente (pg_cron) para consultar o andamento e atualizar
 * o status das propostas, garantindo que o retorno do banco chegue ao usuário
 * sem depender de clique manual em "Atualizar status".
 *
 * Segurança: exige o cabeçalho `apikey` igual à chave pública do projeto.
 */
export const Route = createFileRoute("/api/public/sync-propostas")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const anon = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
        const provided = request.headers.get("apikey");
        if (!anon || provided !== anon) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sincronizarPropostaImpl } = await import("@/lib/propostas/enviar.server");

        // Propostas que ainda podem receber retorno do banco (não terminais)
        // e que já foram efetivamente enviadas (têm oportunidade vinculada).
        const STATUS_ATIVOS = [
          "enviada_banco",
          "em_analise_credito",
          "credito_aprovado",
          "aguardando_documentos",
          "engenharia_vistoria",
          "analise_juridica",
        ];

        const { data: candidatas, error } = await supabaseAdmin
          .from("propostas")
          .select("id, ultima_sincronizacao_em, status_atualizado_em, enviada_em, created_at")
          .in("status", STATUS_ATIVOS as any)
          .not("homefin_id_oportunidade", "is", null)
          // Proposta na lixeira não tem retorno para receber. Sem este filtro,
          // duas propostas excluídas em 10/08 continuaram sendo consultadas de
          // 2 em 2 minutos por 20 dias (26 mil GETs numa única oportunidade).
          .is("deleted_at", null)
          .order("ultima_sincronizacao_em", { ascending: true, nullsFirst: true } as any)
          .limit(200);

        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        // Backoff: sem webhook na API, o polling é obrigatório — mas uma
        // proposta parada em análise não precisa ser consultada a cada 2 min
        // para sempre. Ver `sync-backoff.ts`.
        const { filtrarParaSincronizar } = await import("@/lib/propostas/sync-backoff");
        const propostas = filtrarParaSincronizar(candidatas ?? []);
        const adiadas = (candidatas ?? []).length - propostas.length;

        let processadas = 0;
        let atualizadas = 0;
        let falhas = 0;

        // Processa em paralelo com concorrência limitada — o loop sequencial
        // fazia cada retorno esperar todos os anteriores, atrasando muito
        // Itaú/Santander que respondem rápido. Concorrência = 8 mantém o
        // throughput alto sem estourar limites da HomeFin.
        const fila = [...propostas];
        const CONCORRENCIA = 8;
        async function worker() {
          while (fila.length > 0) {
            const p = fila.shift();
            if (!p) break;
            try {
              const r = await sincronizarPropostaImpl({
                propostaId: p.id,
                userId: null as unknown as string,
                supabase: supabaseAdmin as any,
              });
              processadas++;
              if (r.atualizado) atualizadas++;
            } catch (e) {
              falhas++;
              console.error("[sync-propostas] falha ao sincronizar", p.id, e);
            }
          }
        }
        await Promise.all(
          Array.from({ length: Math.min(CONCORRENCIA, fila.length) }, () => worker()),
        );

        return Response.json({ ok: true, processadas, atualizadas, falhas, adiadas });
      },
    },
  },
});
