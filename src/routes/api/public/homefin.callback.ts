import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Webhook do provedor de integração bancária — retorno assíncrono da
 * integração com o banco. Valida HMAC antes de processar.
 */
export const Route = createFileRoute("/api/public/homefin/callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.HOMEFIN_WEBHOOK_SECRET;
        const signature = request.headers.get("x-homefin-signature") ?? "";
        const body = await request.text();

        // Fail-closed: sem segredo configurado, o webhook não é confiável.
        if (!secret) {
          return new Response("Webhook secret not configured", { status: 503 });
        }
        const expected = createHmac("sha256", secret).update(body).digest("hex");
        const sig = Buffer.from(signature);
        const exp = Buffer.from(expected);
        if (sig.length !== exp.length || !timingSafeEqual(sig, exp)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: any;
        try {
          payload = JSON.parse(body);
        } catch {
          return new Response("Invalid body", { status: 400 });
        }

        const idSimulacao = String(payload.idSimulacao ?? payload.idSimulacaoBanco ?? "");
        if (!idSimulacao) return new Response("Missing idSimulacao", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { humanizarErroBanco } = await import("@/lib/simulacao/bank-error-humanizer");

        const situacao = String(payload.tipoSituacao ?? "").toUpperCase();
        const erro = ["S", "R"].includes(situacao); // S=erro envio, R=recusado

        const { data: linha } = await supabaseAdmin
          .from("simulacao_bancos")
          .select("id, simulacao_id")
          .eq("homefin_id_simulacao_banco", idSimulacao)
          .maybeSingle();
        if (!linha) return new Response("ok");

        await supabaseAdmin
          .from("simulacao_bancos")
          .update({
            status_banco: erro ? "erro" : "simulada",
            mensagem_banco: erro ? humanizarErroBanco(payload.codigoSituacaoBanco, payload.retornoIntegracao) : null,
            valor_parcela: payload.valorParcelaBanco ?? null,
            taxa_juros_ano: payload.taxaJurosAnoBanco ?? null,
            prazo_pagamento_max: payload.prazoPagamentoBancoMax ?? null,
            valor_financiamento_max: payload.valorFinanciamentoBancoMax ?? null,
            valor_parcela_max: payload.valorParcelaBancoMax ?? null,
            codigo_indexador: payload.codigoIndexadorBanco ?? null,
            valor_iof: payload.valorIofBanco ?? null,
            raw_response: payload,
            simulado_em: new Date().toISOString(),
          })
          .eq("id", linha.id);

        // recalcula status da simulação
        const { data: todos } = await supabaseAdmin
          .from("simulacao_bancos")
          .select("status_banco")
          .eq("simulacao_id", linha.simulacao_id)
          .eq("selecionado", true);
        const total = todos?.length ?? 0;
        const ok = todos?.filter((t) => t.status_banco === "simulada").length ?? 0;
        const status = ok === total && total > 0 ? "simulada" : ok > 0 ? "parcialmente_simulada" : "erro_banco";
        await supabaseAdmin.from("simulacoes").update({ status }).eq("id", linha.simulacao_id);

        return new Response("ok");
      },
    },
  },
});
