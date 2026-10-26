/**
 * Relatórios: trilha de exportação e escopo da pessoa.
 *
 * Os relatórios gerenciais foram refeitos (C47, 26/10/2026) sobre funções de agregação no banco
 * (`ecossistema.functions.ts`); o antigo `runReport`, que baixava milhares de linhas pelo PostgREST
 * e somava aqui, saiu com as telas que o usavam. Ficam a trilha de exportações (tela
 * Exportações, conciliação) e o escopo usado pelo Painel operacional.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";

export const registrarExport = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["relatorios.geral", "export"])])
  .inputValidator(
    (d: { codigo: string; formato: string; registros: number; filtros: Record<string, unknown> }) =>
      z
        .object({
          codigo: z.string().min(1).max(80),
          formato: z.enum(["pdf", "xlsx", "csv", "imprimir"]),
          registros: z.number().int().min(0),
          filtros: z.record(z.string(), z.any()).default({}),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: corr } = await supabase.rpc("correspondente_do_usuario", { _user_id: userId });
    await supabase.from("report_exports").insert({
      correspondente_id: corr as string,
      user_id: userId,
      report_codigo: data.codigo,
      formato: data.formato,
      registros: data.registros,
      filtros: data.filtros as any,
      status: "concluido",
    } as any);
    await supabase.from("report_audit_logs").insert({
      correspondente_id: corr as string,
      user_id: userId,
      report_codigo: data.codigo,
      acao: "exportou",
      formato: data.formato,
      registros: data.registros,
      filtros: data.filtros as any,
    } as any);
    return { ok: true };
  });

/** Lista histórico de exportações. */
export const listarExportacoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("report_exports")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as any[];
  });

/** Retorna se o usuário pode ver escopo de equipe/geral em relatórios. */
export const getEscopoRelatorios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ podeEquipe: boolean; podeGeral: boolean }> => {
    const { supabase, userId } = context;
    const [{ data: geral }, { data: equipe }] = await Promise.all([
      supabase.rpc("can_view_global_reports", { _user_id: userId }),
      supabase.rpc("can_view_team_reports", { _user_id: userId }),
    ]);
    return { podeEquipe: Boolean(equipe), podeGeral: Boolean(geral) };
  });
