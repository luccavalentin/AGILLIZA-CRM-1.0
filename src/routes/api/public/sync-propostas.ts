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

        // Uma rodada por vez, como já valia para a reconciliação de simulações.
        // O agendador chama de minuto em minuto e uma rodada com 200 propostas
        // pode passar disso: sem trava, duas rodadas consultavam as mesmas
        // propostas na HomeFin ao mesmo tempo (a marcação da consulta só é
        // gravada depois da resposta). Falhando a trava, segue como antes.
        {
          const { data: reservou, error: erroTrava } = await (supabaseAdmin as any).rpc(
            "rotina_reservar",
            { _nome: "sync-propostas", _intervalo_segundos: 45 },
          );
          if (!erroTrava && reservou !== true) {
            return Response.json({ ok: true, pulada: true });
          }
        }

        const { sincronizarPropostaImpl } = await import("@/lib/propostas/enviar.server");

        // Propostas que ainda podem receber retorno do banco (não terminais)
        // e que já foram efetivamente enviadas (têm oportunidade vinculada).
        const STATUS_ATIVOS = [
          // Rascunho com oportunidade já criada na HomeFin (ex.: envio que
          // ficou "aguardando envio"): antes só a lista de propostas aberta a
          // acompanhava, a cada 20 s por aba. Agora o agendador cobre sozinho.
          "rascunho",
          "enviada_banco",
          "em_analise_credito",
          "credito_aprovado",
          // Condicionado ainda evolui: as condições podem ser cumpridas
          // (vira aprovado) ou não (vira recusa). Fora desta lista, a
          // proposta pararia de receber retorno do banco no meio do caminho.
          "credito_condicionado",
          "aguardando_documentos",
          "engenharia_vistoria",
          "analise_juridica",
        ];

        // Só as vencidas pelo ritmo de `sync-backoff.ts` (banco, fase e horário
        // comercial), contando consultas feitas por qualquer origem. Proposta
        // na lixeira fica de fora (26 mil GETs numa única oportunidade em 08/26).
        const { selecionarParaSincronizar } = await import("@/lib/propostas/sync-estado.server");
        let propostas: { id: string }[];
        try {
          propostas = await selecionarParaSincronizar(supabaseAdmin as any, STATUS_ATIVOS, 200);
        } catch (e) {
          return Response.json({ ok: false, error: String(e) }, { status: 500 });
        }
        const adiadas = 0;

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
