/**
 * RH › Configurações › Tabelas da folha: INSS, IRRF, salário mínimo, salário-família e
 * FGTS por vigência. As padrão do sistema (atualizadas por migração) só aparecem para
 * consulta; a empresa cadastra vigências próprias quando a lei muda antes da atualização.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import type { TabelaFiscal } from "@/lib/rh/clt";
import { carregarTabelasFiscais } from "@/lib/rh/folha.functions";
import { correspondenteId } from "@/lib/rh/acesso";

export const listarTabelasFiscais = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TabelaFiscal[]> => {
    const lista = await carregarTabelasFiscais(context.supabase);
    return lista.sort((a, b) => b.vigencia_desde.localeCompare(a.vigencia_desde));
  });

const num = z.number().finite();
const tabelaSchema = z
  .object({
    id: z.string().uuid().optional(),
    vigencia_desde: z.string().regex(/^\d{4}-\d{2}-01$/, "A vigência começa no dia 1º do mês."),
    salario_minimo: num.positive("Informe o salário mínimo."),
    inss_faixas: z
      .array(z.object({ ate: num.positive(), aliquota: num.min(0).max(1) }))
      .min(1, "Informe as faixas do INSS."),
    irrf_faixas: z
      .array(z.object({ ate: num.positive().nullable(), aliquota: num.min(0).max(1), deducao: num.min(0) }))
      .min(1, "Informe as faixas do IRRF."),
    irrf_dependente: num.min(0),
    irrf_desconto_simplificado: num.min(0),
    irrf_reducao: z
      .object({
        isencao_ate: num.min(0),
        reducao_maxima: num.min(0),
        ate: num.min(0),
        a: num.min(0),
        b: num.min(0),
      })
      .nullable(),
    salario_familia_quota: num.min(0),
    salario_familia_teto: num.min(0),
    fgts_aliquota: num.min(0).max(1),
    fonte: z.string().trim().max(500).optional().nullable(),
  })
  .superRefine((t, ctx) => {
    for (let i = 1; i < t.inss_faixas.length; i++) {
      if (t.inss_faixas[i].ate <= t.inss_faixas[i - 1].ate)
        ctx.addIssue({ code: "custom", message: "As faixas do INSS devem crescer.", path: ["inss_faixas", i] });
    }
    t.irrf_faixas.forEach((f, i) => {
      const ultima = i === t.irrf_faixas.length - 1;
      if (ultima && f.ate != null)
        ctx.addIssue({ code: "custom", message: "A última faixa do IRRF fica sem limite.", path: ["irrf_faixas", i] });
      if (!ultima && f.ate == null)
        ctx.addIssue({ code: "custom", message: "Só a última faixa do IRRF fica sem limite.", path: ["irrf_faixas", i] });
      if (!ultima && i > 0 && (f.ate ?? 0) <= (t.irrf_faixas[i - 1].ate ?? 0))
        ctx.addIssue({ code: "custom", message: "As faixas do IRRF devem crescer.", path: ["irrf_faixas", i] });
    });
  });

export const salvarTabelaFiscal = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["rh.configuracoes", "edit"])])
  .inputValidator((d: unknown) => tabelaSchema.parse(d))
  .handler(async ({ data, context }) => {
    const cid = await correspondenteId(context.supabase, context.userId);
    const { id, ...resto } = data;
    const payload = { ...resto, fonte: resto.fonte || null, correspondente_id: cid };
    if (id) {
      const { data: rows, error } = await context.supabase
        .from("rh_tabelas_fiscais")
        .update(payload)
        .eq("id", id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!rows || rows.length === 0) throw new Error("Só as vigências da sua empresa podem ser alteradas.");
      return { id };
    }
    const { data: row, error } = await context.supabase
      .from("rh_tabelas_fiscais")
      .insert({ ...payload, criado_por: context.userId })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") throw new Error("Já existe uma vigência da empresa com essa data.");
      throw new Error(error.message);
    }
    return { id: row!.id as string };
  });

export const excluirTabelaFiscal = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["rh.configuracoes", "edit"])])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("rh_tabelas_fiscais")
      .delete()
      .eq("id", data.id)
      .select("id");
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) throw new Error("Só as vigências da sua empresa podem ser excluídas.");
    return { ok: true };
  });
