import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Webhook do provedor de integração bancária — retorno assíncrono das
 * propostas. Valida HMAC antes de processar. Marca branca: rota técnica.
 */
export const Route = createFileRoute("/api/public/webhook/homefin/proposta")({
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

        const idOportunidade = String(payload.idOportunidade ?? payload.id ?? "");
        if (!idOportunidade) return new Response("Missing idOportunidade", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: prop } = await supabaseAdmin
          .from("propostas")
          .select("id, status, cliente_id, usuario_responsavel_id")
          .eq("homefin_id_oportunidade", idOportunidade)
          .maybeSingle();
        if (!prop) return new Response("ok");

        // Mapeia situação do banco -> status interno
        const mapa: Record<string, string> = {
          EM_ANALISE_CREDITO: "em_analise_credito",
          CREDITO_APROVADO: "credito_aprovado",
          CREDITO_RECUSADO: "credito_recusado",
          AGUARDANDO_DOCUMENTOS: "aguardando_documentos",
          ENGENHARIA: "engenharia_vistoria",
          VISTORIA: "engenharia_vistoria",
          JURIDICO: "analise_juridica",
          CONTRATO_EMITIDO: "contrato_emitido",
          REGISTRADO: "registrado",
        };
        const codigo = String(payload.situacao ?? payload.tipoSituacaoDetalhe ?? "").toUpperCase();
        const novoStatus = mapa[codigo];
        const detalhe = payload.detalheStatus ?? payload.descricaoSituacao ?? null;

        const patch: Record<string, unknown> = { detalhe_status_atual: detalhe };
        if (novoStatus) patch.status = novoStatus;
        if (payload.codigoOportunidadeBanco) patch.codigo_oportunidade_homefin = payload.codigoOportunidadeBanco;
        if (payload.valorFinanciamentoBanco != null) patch.valor_financiamento_aprovado = payload.valorFinanciamentoBanco;
        if (payload.valorParcelaBanco != null) patch.valor_parcela_aprovado = payload.valorParcelaBanco;
        if (payload.prazoPagamentoBanco != null) patch.prazo_aprovado = payload.prazoPagamentoBanco;
        if (payload.taxaJurosAnoBanco != null) patch.taxa_juros_ano_aprovado = payload.taxaJurosAnoBanco;
        if (novoStatus === "contrato_emitido") patch.contrato_emitido_em = new Date().toISOString();

        await supabaseAdmin.from("propostas").update(patch as any).eq("id", prop.id);

        await supabaseAdmin.from("proposta_historico").insert({
          proposta_id: prop.id,
          tipo_evento: "callback",
          descricao: detalhe ?? `Situação atualizada pelo banco: ${codigo || "desconhecida"}`,
          status_anterior: prop.status as any,
          status_novo: (novoStatus ?? prop.status) as any,
        });

        // Notificação in-app ao responsável
        if (prop.usuario_responsavel_id && novoStatus) {
          await supabaseAdmin.from("notificacoes").insert({
            user_id: prop.usuario_responsavel_id,
            tipo: "proposta",
            titulo: "Atualização de proposta",
            corpo: detalhe ?? `Status alterado para ${novoStatus}.`,
            link: `/operacional/propostas/${prop.id}`,
          } as any);
        }

        return new Response("ok");
      },
    },
  },
});
