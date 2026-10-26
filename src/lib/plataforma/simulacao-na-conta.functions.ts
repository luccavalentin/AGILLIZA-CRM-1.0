/**
 * Simular na base de um assinante (C29, 26/10/2026): ações da tela.
 *
 *  - `levarSimulacaoParaConta`: cria (ou reaproveita) a cópia de uma simulação do Agilliza na
 *    conta escolhida — usada pelo detalhe ("Levar à conta de novo"); a simulação completa já faz
 *    isso sozinha ao nascer (`criarSimulacao`).
 *  - `salvarSimulacaoRapidaNaConta`: guarda a simulação rápida (calculadora) na conta.
 * Porta de entrada `saas.contas`; o banco do Agilliza Tech confere conta, correspondente e regras.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import { CONTA_DESTINO, DADOS_RAPIDA_NA_CONTA } from "./simulacao-na-conta.server";

export const ENTRADA_LEVAR = z.object({
  simulacaoId: z.string().uuid(),
  licenca: CONTA_DESTINO.optional().nullable(),
});

export const ENTRADA_RAPIDA = z.object({
  licenca: CONTA_DESTINO,
  dados: DADOS_RAPIDA_NA_CONTA,
});

/** Dependências reais (ponte + cliente admin), carregadas só no servidor. */
export async function dependenciasReais() {
  const { comConta, comPlataforma } = await import("./ponte.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return {
    comConta,
    comPlataforma,
    marcar: async (
      simulacaoId: string,
      patch: Record<string, unknown>,
      opcoes?: { soSemConta?: boolean },
    ) => {
      let q = supabaseAdmin
        .from("simulacoes")
        .update(patch as never)
        .eq("id", simulacaoId);
      if (opcoes?.soSemConta) q = q.is("conta_assinante_id", null);
      const { error } = await q;
      if (error) throw new Error(error.message);
    },
  };
}

export const levarSimulacaoParaConta = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.contas", "view"])])
  .inputValidator((d: unknown) => ENTRADA_LEVAR.parse(d))
  .handler(async ({ data, context }) => {
    // A simulação precisa ser visível para quem pede (RLS do Agilliza).
    const { data: sim, error } = await context.supabase
      .from("simulacoes")
      .select("id, conta_assinante_id, deleted_at")
      .eq("id", data.simulacaoId)
      .maybeSingle();
    if (error) throw new Error("Não foi possível ler a simulação.");
    if (!sim || (sim as { deleted_at: string | null }).deleted_at) throw new Error("Simulação não encontrada.");
    const marcada = (sim as { conta_assinante_id: string | null }).conta_assinante_id;
    const licenca = data.licenca?.toLowerCase() ?? marcada;
    if (!licenca) throw new Error("Escolha a conta do assinante.");
    if (marcada && marcada !== licenca) {
      throw new Error("Esta simulação já foi feita para outra conta.");
    }
    const { levarSimulacaoParaContaServidor } = await import("./simulacao-na-conta.server");
    const r = await levarSimulacaoParaContaServidor(await dependenciasReais(), {
      userId: context.userId,
      simulacaoId: data.simulacaoId,
      licenca,
    });
    if (!r?.ok) throw new Error(r?.mensagem ?? "Não foi possível levar a simulação à conta.");
    return r;
  });

export const salvarSimulacaoRapidaNaConta = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.contas", "view"])])
  .inputValidator((d: unknown) => ENTRADA_RAPIDA.parse(d))
  .handler(async ({ data, context }) => {
    const { comConta } = await import("./ponte.server");
    const r = await comConta(context.userId, data.licenca, (tx) =>
      tx.uma<{ r: { simulacao_id: string; codigo: string; cliente_id: string | null } }>(
        "select plataforma.simulacao_rapida_na_conta($1::jsonb, $2) as r",
        [JSON.stringify(data.dados), context.userId],
      ),
    );
    if (!r?.r?.simulacao_id) throw new Error("A conta não devolveu a simulação.");
    return r.r;
  });
