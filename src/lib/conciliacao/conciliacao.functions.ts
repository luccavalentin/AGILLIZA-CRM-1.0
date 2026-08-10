import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  ConciliacaoItem,
  ConciliacaoLote,
  ResumoBanco,
} from "@/lib/conciliacao/tipos";

/** Processa um arquivo já lido no navegador e grava o lote conciliado. */
export const processarConciliacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        bancoLabel: z.string().trim().min(1).max(120),
        periodo: z.string().regex(/^\d{4}-\d{2}$/, "Período inválido (AAAA-MM)"),
        nomeArquivo: z.string().trim().min(1).max(255),
        linhas: z
          .array(
            z.object({
              numeroProposta: z.string().nullable(),
              nomeCliente: z.string().nullable(),
              cpf: z.string().nullable(),
              status: z.string().nullable(),
              valorFinanciamento: z.number().nullable(),
              dataEnvio: z.string().nullable(),
              dataEmissao: z.string().nullable(),
              dataAssinatura: z.string().nullable(),
              produto: z.string().nullable(),
            }),
          )
          .min(1, "O arquivo não contém linhas legíveis.")
          .max(20000, "Arquivo muito grande (máx. 20.000 linhas)."),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{ loteId: string }> => {
    const { executarConciliacao } = await import("@/lib/conciliacao/executar.server");
    return executarConciliacao(context, data);
  });

/** Lista os lotes de conciliação do ecossistema, com filtros opcionais. */
export const listarLotesConciliacao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        banco: z.string().trim().max(120).optional().nullable(),
        periodo: z.string().regex(/^\d{4}-\d{2}$/).optional().nullable(),
      })
      .default({})
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }): Promise<ConciliacaoLote[]> => {
    let q = context.supabase
      .from("conciliacao_lotes")
      .select("*")
      .order("enviado_em", { ascending: false })
      .limit(200);
    if (data.banco) q = q.eq("banco_nome", data.banco);
    if (data.periodo) q = q.eq("periodo_referencia", `${data.periodo}-01`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as ConciliacaoLote[];
  });

/** Resumo agregado por banco (KPIs da tela). */
export const resumoConciliacao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ periodo: z.string().regex(/^\d{4}-\d{2}$/).optional().nullable() })
      .default({})
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }): Promise<ResumoBanco[]> => {
    let q = context.supabase.from("conciliacao_lotes").select("*").limit(500);
    if (data.periodo) q = q.eq("periodo_referencia", `${data.periodo}-01`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const mapa = new Map<string, ResumoBanco>();
    for (const l of rows ?? []) {
      const atual =
        mapa.get(l.banco_nome) ??
        ({
          banco_nome: l.banco_nome,
          total: 0,
          conferidas: 0,
          divergentes: 0,
          ausentes_sistema: 0,
          ausentes_banco: 0,
          percentual_conferido: 0,
        } as ResumoBanco);
      atual.total += l.total_linhas ?? 0;
      atual.conferidas += l.total_conferidas ?? 0;
      atual.divergentes += l.total_divergentes ?? 0;
      atual.ausentes_sistema += l.total_ausentes_sistema ?? 0;
      atual.ausentes_banco += l.total_ausentes_banco ?? 0;
      mapa.set(l.banco_nome, atual);
    }
    return [...mapa.values()].map((r) => ({
      ...r,
      percentual_conferido: r.total ? Math.round((r.conferidas / r.total) * 1000) / 10 : 0,
    }));
  });

/** Itens de um lote, com filtro por resultado e busca textual. */
export const listarItensConciliacao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        loteId: z.string().uuid(),
        resultado: z
          .enum(["conferido", "divergente", "ausente_no_sistema", "ausente_no_banco"])
          .optional()
          .nullable(),
        busca: z.string().trim().max(120).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<ConciliacaoItem[]> => {
    let q = context.supabase
      .from("conciliacao_itens")
      .select("*")
      .eq("lote_id", data.loteId)
      .order("resultado", { ascending: true })
      .limit(5000);
    if (data.resultado) q = q.eq("resultado", data.resultado);
    if (data.busca) {
      const b = data.busca.replace(/[%,]/g, " ");
      q = q.or(
        `numero_proposta_banco.ilike.%${b}%,nome_cliente_banco.ilike.%${b}%,numero_proposta_sistema.ilike.%${b}%`,
      );
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as ConciliacaoItem[];
  });

/** Remove um lote e seus itens. */
export const excluirLoteConciliacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ loteId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("conciliacao_lotes")
      .delete()
      .eq("id", data.loteId);
    if (error) throw new Error(error.message);
    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase: context.supabase,
      userId: context.userId,
      correspondenteId: null,
      acao: "conciliacao.excluir",
      descricao: "excluiu um lote de conciliação bancária",
      entidade: "conciliacao_lotes",
      entidadeId: data.loteId,
    });
    return { ok: true };
  });

/** Cruza as chaves das planilhas comparadas contra as propostas do sistema. */
export const cruzarComSistema = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        chaves: z
          .array(
            z.object({
              chave: z.string().min(1).max(120),
              numero: z.string().max(60).nullable(),
              cpf: z.string().max(20).nullable(),
              nome: z.string().max(200).nullable(),
            }),
          )
          .min(1)
          .max(20000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { cruzarComSistemaImpl } = await import("@/lib/conciliacao/comparador.server");
    return cruzarComSistemaImpl(context.supabase, data.chaves);
  });
