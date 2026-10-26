/**
 * Servidor do kanban de propostas (C34): prazos por etapa (configuráveis) e as
 * propostas dos assinantes do Agilliza Tech no mesmo quadro.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import { montarPrazos, type PrazosKanban } from "./kanban-propostas";
import type { PropostaAssinante } from "@/lib/plataforma/fila.functions";

const ETAPAS_COM_PRAZO = [
  "rascunho",
  "enviada_banco",
  "credito_aprovado",
  "formularios",
  "aguardando_documentos",
  "engenharia_vistoria",
  "analise_juridica",
  "contrato_emitido",
  "erro_envio",
] as const;

export interface PrazosDoKanban {
  prazos: PrazosKanban;
  /** Etapas com ajuste próprio do correspondente (o resto segue o padrão geral). */
  ajustadas: string[];
  podeEditar: boolean;
}

/** Limites de "dias parado" por etapa: padrão geral + ajuste do correspondente (RLS). */
export const listarPrazosKanban = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PrazosDoKanban> => {
    const { supabase, userId } = context;
    // Tabela nova (migração 20261027040060) ainda fora dos tipos gerados.
    const { data, error } = await (supabase as any)
      .from("proposta_etapa_sla")
      .select("correspondente_id, etapa, dias_alerta, dias_critico");
    if (error) throw new Error("Não foi possível ler os prazos do kanban.");
    const linhas = (data ?? []) as {
      correspondente_id: string | null;
      etapa: string;
      dias_alerta: number;
      dias_critico: number;
    }[];
    const { data: pode } = await supabase.rpc("usuario_tem_permissao", {
      _user_id: userId,
      _modulo: "operacional.propostas",
      _acao: "edit",
    });
    return {
      prazos: montarPrazos(linhas),
      ajustadas: linhas.filter((l) => l.correspondente_id).map((l) => l.etapa),
      podeEditar: Boolean(pode),
    };
  });

/** Ajusta (ou volta ao padrão, sem dias) o prazo de uma etapa. O banco confere a permissão. */
export const definirPrazoKanban = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        etapa: z.enum(ETAPAS_COM_PRAZO),
        dias_alerta: z.number().int().min(1).max(364).nullable(),
        dias_critico: z.number().int().min(2).max(365).nullable(),
      })
      .refine(
        (x) =>
          (x.dias_alerta === null && x.dias_critico === null) ||
          (x.dias_alerta !== null && x.dias_critico !== null && x.dias_alerta < x.dias_critico),
        "O alerta vem antes do crítico.",
      )
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await (context.supabase as any).rpc("definir_prazo_etapa_proposta", {
      p_etapa: data.etapa,
      p_alerta: data.dias_alerta,
      p_critico: data.dias_critico,
    });
    if (error) {
      throw new Error(
        error.code === "42501"
          ? "Você não tem permissão para ajustar os prazos do kanban."
          : (error.message ?? "Não foi possível salvar o prazo."),
      );
    }
    return { ok: true as const };
  });

export interface PropostasAssinantesKanban {
  propostas: PropostaAssinante[];
  total: number;
}

/** Quantas propostas dos assinantes o quadro carrega (as mais recentes). */
const LIMITE_ASSINANTES = 300;

/**
 * Propostas dos assinantes para o quadro: a mesma função da fila
 * (`plataforma.consultar_propostas`, permissão conferida no banco), em páginas de 100.
 */
export const listarPropostasAssinantesKanban = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.fila", "view"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        licenca: z.string().uuid().optional().nullable(),
        termo: z.string().trim().max(120).optional().nullable(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<PropostasAssinantesKanban> => {
    const { comPlataforma } = await import("@/lib/plataforma/ponte.server");
    return comPlataforma(context.userId, async (tx) => {
      const propostas: PropostaAssinante[] = [];
      let total = 0;
      for (let pagina = 1; propostas.length < LIMITE_ASSINANTES; pagina++) {
        const r = await tx.uma<{ r: { propostas: PropostaAssinante[]; total: number } }>(
          "select plataforma.consultar_propostas($1::jsonb) as r",
          [
            JSON.stringify({
              aceite: "todas",
              origem: "licenca",
              licenca: data.licenca ?? null,
              termo: data.termo || null,
              pagina,
              por_pagina: 100,
            }),
          ],
        );
        const lote = r?.r?.propostas ?? [];
        total = r?.r?.total ?? total;
        propostas.push(...lote);
        if (lote.length < 100) break;
      }
      const { anotarVinculoAgilliza } = await import("@/lib/plataforma/fila.server");
      await anotarVinculoAgilliza(tx, propostas);
      return { propostas: propostas.slice(0, LIMITE_ASSINANTES), total };
    });
  });
