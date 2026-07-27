import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ComissaoTipo = "percentual" | "fixo";

export interface RegraComissao {
  id: string;
  banco_codigo: string | null;
  banco_nome: string | null;
  produto: string | null;
  faixa_min: number;
  faixa_max: number | null;
  tipo: ComissaoTipo;
  valor: number;
  percentual_parceiro: number;
  percentual_interno: number;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  ativo: boolean;
}

export const PRODUTOS_COMISSAO = [
  { v: "financiamento", l: "Financiamento imobiliário" },
  { v: "home_equity", l: "Home equity" },
  { v: "todos", l: "Todos os produtos" },
] as const;

async function correspondenteId(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase.rpc("correspondente_do_usuario", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Sua conta ainda não está vinculada a um correspondente. Solicite ao administrador que conclua o vínculo antes de usar este módulo.");
  return data as string;
}

/** Lista as regras de comissão do correspondente. */
export const listarRegrasComissaoAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RegraComissao[]> => {
    const { data, error } = await context.supabase
      .from("comissao_regras")
      .select(
        "id, banco_codigo, banco_nome, produto, faixa_min, faixa_max, tipo, valor, percentual_parceiro, percentual_interno, vigencia_inicio, vigencia_fim, ativo",
      )
      .order("banco_nome", { ascending: true })
      .order("faixa_min", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as RegraComissao[];
  });

/** Bancos ativos para o seletor de regras. */
export const listarBancosParaComissao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ codigo: string; nome: string }[]> => {
    const { data, error } = await context.supabase
      .from("vw_bancos_ativos")
      .select("codigo_banco, nome_banco")
      .order("nome_banco", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((b: any) => ({ codigo: String(b.codigo_banco ?? ""), nome: b.nome_banco ?? "" }));
  });

const regraSchema = z.object({
  id: z.string().uuid().optional(),
  banco_codigo: z.string().trim().optional().nullable(),
  banco_nome: z.string().trim().optional().nullable(),
  produto: z.string().trim().min(1).default("todos"),
  faixa_min: z.number().min(0).default(0),
  faixa_max: z.number().positive().nullable().optional(),
  tipo: z.enum(["percentual", "fixo"]),
  valor: z.number().min(0),
  percentual_parceiro: z.number().min(0).max(100).default(0),
  percentual_interno: z.number().min(0).max(100).default(100),
  vigencia_inicio: z.string().optional().nullable(),
  vigencia_fim: z.string().optional().nullable(),
  ativo: z.boolean().default(true),
});

/** Cria ou atualiza uma regra de comissão. */
export const salvarRegraComissao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => regraSchema.parse(d))
  .handler(async ({ data, context }): Promise<RegraComissao> => {
    const { supabase, userId } = context;
    if (Math.round(data.percentual_parceiro + data.percentual_interno) !== 100) {
      throw new Error("A soma dos percentuais parceiro + interno deve ser 100%.");
    }
    if (data.faixa_max != null && data.faixa_max <= data.faixa_min) {
      throw new Error("A faixa máxima deve ser maior que a faixa mínima.");
    }
    const corr = await correspondenteId(supabase, userId);
    const payload = {
      banco_codigo: data.banco_codigo || null,
      banco_nome: data.banco_nome || null,
      produto: data.produto,
      faixa_min: data.faixa_min,
      faixa_max: data.faixa_max ?? null,
      tipo: data.tipo,
      valor: data.valor,
      percentual_parceiro: data.percentual_parceiro,
      percentual_interno: data.percentual_interno,
      vigencia_inicio: data.vigencia_inicio || null,
      vigencia_fim: data.vigencia_fim || null,
      ativo: data.ativo,
      correspondente_id: corr,
      updated_at: new Date().toISOString(),
    };
    const q = data.id
      ? supabase.from("comissao_regras").update(payload).eq("id", data.id)
      : supabase.from("comissao_regras").insert(payload);
    const { data: row, error } = await q
      .select(
        "id, banco_codigo, banco_nome, produto, faixa_min, faixa_max, tipo, valor, percentual_parceiro, percentual_interno, vigencia_inicio, vigencia_fim, ativo",
      )
      .single();
    if (error) throw new Error(error.message);
    return row as RegraComissao;
  });

/** Remove uma regra de comissão. */
export const excluirRegraComissao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("comissao_regras").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export interface SimulacaoComissaoResultado {
  regraId: string | null;
  bruto: number;
  parceiro: number;
  interno: number;
  descricao: string;
}

/** Simula a comissão de uma operação aplicando a melhor regra vigente. */
export const simularComissao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        banco_codigo: z.string().trim().optional().nullable(),
        produto: z.string().trim().default("todos"),
        valor_operacao: z.number().positive(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<SimulacaoComissaoResultado> => {
    const hoje = new Date().toISOString().slice(0, 10);
    const { data: regras, error } = await context.supabase
      .from("comissao_regras")
      .select("*")
      .eq("ativo", true);
    if (error) throw new Error(error.message);

    const candidatas = (regras ?? []).filter((r: any) => {
      const okBanco = !r.banco_codigo || r.banco_codigo === data.banco_codigo;
      const okProduto = !r.produto || r.produto === "todos" || r.produto === data.produto;
      const okMin = Number(r.faixa_min ?? 0) <= data.valor_operacao;
      const okMax = r.faixa_max == null || data.valor_operacao <= Number(r.faixa_max);
      const okInicio = !r.vigencia_inicio || r.vigencia_inicio <= hoje;
      const okFim = !r.vigencia_fim || r.vigencia_fim >= hoje;
      return okBanco && okProduto && okMin && okMax && okInicio && okFim;
    });

    if (candidatas.length === 0) {
      return {
        regraId: null,
        bruto: 0,
        parceiro: 0,
        interno: 0,
        descricao: "Nenhuma regra de comissão vigente para os parâmetros informados.",
      };
    }

    // Regra mais específica: banco definido > produto específico > maior faixa_min.
    candidatas.sort((a: any, b: any) => {
      const espA = (a.banco_codigo ? 2 : 0) + (a.produto && a.produto !== "todos" ? 1 : 0);
      const espB = (b.banco_codigo ? 2 : 0) + (b.produto && b.produto !== "todos" ? 1 : 0);
      if (espB !== espA) return espB - espA;
      return Number(b.faixa_min ?? 0) - Number(a.faixa_min ?? 0);
    });
    const r = candidatas[0];
    const bruto =
      r.tipo === "percentual" ? (data.valor_operacao * Number(r.valor)) / 100 : Number(r.valor);
    const parceiro = (bruto * Number(r.percentual_parceiro ?? 0)) / 100;
    const interno = (bruto * Number(r.percentual_interno ?? 100)) / 100;
    return {
      regraId: r.id,
      bruto,
      parceiro,
      interno,
      descricao:
        r.tipo === "percentual"
          ? `${r.valor}% sobre a operação (${r.banco_nome ?? "todos os bancos"})`
          : `Valor fixo de R$ ${Number(r.valor).toLocaleString("pt-BR")} (${r.banco_nome ?? "todos os bancos"})`,
    };
  });
