import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Prioridade = string;

export type CategoriaCatalogo = "tipo_demanda" | "prioridade" | "canal";

export interface CatalogoItem {
  id: string;
  categoria: CategoriaCatalogo;
  valor: string;
  label: string;
  ordem: number;
  ativo: boolean;
}

/** Itens padrão clonados por correspondente no primeiro acesso a cada catálogo. */
const CATALOGO_PADRAO: Record<CategoriaCatalogo, Array<{ valor: string; label: string }>> = {
  tipo_demanda: [
    { valor: "analise_documento", label: "Análise de documento" },
    { valor: "correcao", label: "Correção" },
    { valor: "reenvio_simulacao", label: "Reenvio de simulação" },
    { valor: "renovacao", label: "Renovação" },
    { valor: "lgpd", label: "LGPD" },
    { valor: "geral", label: "Geral" },
  ],
  prioridade: [
    { valor: "p1", label: "P1 — Alta" },
    { valor: "p2", label: "P2 — Média" },
    { valor: "p3", label: "P3 — Baixa" },
  ],
  canal: [
    { valor: "gestor", label: "Gestor" },
    { valor: "correspondente", label: "Correspondente" },
  ],
};


export interface SlaConfig {
  id: string;
  tipo: string;
  prioridade: Prioridade;
  horas_uteis: number;
  canal_escalonamento: string;
  ativo: boolean;
}

export interface Feriado {
  id: string;
  data: string;
  descricao: string;
  correspondente_id: string | null;
}

/** Tipos de demanda cobertos por SLA (espelha o dialog de nova demanda). */
export const TIPOS_SLA = [
  { v: "analise_documento", l: "Análise de documento" },
  { v: "correcao", l: "Correção" },
  { v: "reenvio_simulacao", l: "Reenvio de simulação" },
  { v: "renovacao", l: "Renovação" },
  { v: "lgpd", l: "LGPD" },
  { v: "geral", l: "Geral" },
] as const;

async function correspondenteId(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase.rpc("correspondente_do_usuario", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Sua conta ainda não está vinculada a um correspondente. Solicite ao administrador que conclua o vínculo antes de usar este módulo.");
  return data as string;
}

/** Lista as configurações de SLA (tipo × prioridade → horas úteis). */
export const listarSlaConfiguracoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SlaConfig[]> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("sla_configuracoes")
      .select("id, tipo, prioridade, horas_uteis, canal_escalonamento, ativo")
      .order("tipo", { ascending: true })
      .order("prioridade", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as SlaConfig[];
  });

/** Cria ou atualiza uma configuração de SLA. */
export const salvarSlaConfiguracao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        tipo: z.string().min(1),
        prioridade: z.string().min(1),
        horas_uteis: z.number().positive().max(2000),
        canal_escalonamento: z.string().min(1).default("gestor"),
        ativo: z.boolean().default(true),
      })
      .parse(d),
  )

  .handler(async ({ data, context }): Promise<SlaConfig> => {
    const { supabase, userId } = context;
    const corr = await correspondenteId(supabase, userId);
    const payload = {
      tipo: data.tipo,
      prioridade: data.prioridade,
      horas_uteis: data.horas_uteis,
      canal_escalonamento: data.canal_escalonamento,
      ativo: data.ativo,
      correspondente_id: corr,
      updated_at: new Date().toISOString(),
    };
    const q = data.id
      ? supabase.from("sla_configuracoes").update(payload).eq("id", data.id)
      : supabase.from("sla_configuracoes").insert(payload);
    const { data: row, error } = await q
      .select("id, tipo, prioridade, horas_uteis, canal_escalonamento, ativo")
      .single();
    if (error) throw new Error(error.message);
    return row as SlaConfig;
  });

/** Remove uma configuração de SLA. */
export const excluirSlaConfiguracao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("sla_configuracoes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Lista os feriados (globais + do correspondente). */
export const listarFeriados = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Feriado[]> => {
    const { data, error } = await context.supabase
      .from("feriados")
      .select("id, data, descricao, correspondente_id")
      .order("data", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as Feriado[];
  });

/** Cadastra um feriado do correspondente. */
export const criarFeriado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ data: z.string().min(1), descricao: z.string().trim().min(2).max(200) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<Feriado> => {
    const { supabase, userId } = context;
    const corr = await correspondenteId(supabase, userId);
    const { data: row, error } = await supabase
      .from("feriados")
      .insert({ data: data.data, descricao: data.descricao, correspondente_id: corr })
      .select("id, data, descricao, correspondente_id")
      .single();
    if (error) throw new Error(error.message);
    return row as Feriado;
  });

/** Remove um feriado (apenas os do próprio correspondente). */
export const excluirFeriado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("feriados").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------- Catálogos editáveis ------------------------- */

const CATEGORIAS: CategoriaCatalogo[] = ["tipo_demanda", "prioridade", "canal"];

/**
 * Lista os itens de um catálogo do correspondente. Na primeira vez que um
 * catálogo é acessado, clona os itens padrão para o correspondente — assim
 * até os itens "de fábrica" podem ser editados ou excluídos.
 */
export const listarCatalogoSla = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ categoria: z.enum(["tipo_demanda", "prioridade", "canal"]) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<CatalogoItem[]> => {
    const { supabase, userId } = context;
    const corr = await correspondenteId(supabase, userId);

    const sel = () =>
      supabase
        .from("sla_catalogo_itens")
        .select("id, categoria, valor, label, ordem, ativo")
        .eq("correspondente_id", corr)
        .eq("categoria", data.categoria)
        .order("ordem", { ascending: true });

    const { data: rows, error } = await sel();
    if (error) throw new Error(error.message);
    if (rows && rows.length > 0) return rows as CatalogoItem[];

    // Clona os padrões (idempotente via UNIQUE correspondente/categoria/valor).
    const padrao = CATALOGO_PADRAO[data.categoria].map((it, i) => ({
      correspondente_id: corr,
      categoria: data.categoria,
      valor: it.valor,
      label: it.label,
      ordem: i,
      ativo: true,
    }));
    await supabase.from("sla_catalogo_itens").upsert(padrao, {
      onConflict: "correspondente_id,categoria,valor",
      ignoreDuplicates: true,
    });
    const { data: novo, error: e2 } = await sel();
    if (e2) throw new Error(e2.message);
    return (novo ?? []) as CatalogoItem[];
  });

/** Cria ou atualiza um item de catálogo. */
export const salvarCatalogoItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        categoria: z.enum(["tipo_demanda", "prioridade", "canal"]),
        valor: z
          .string()
          .trim()
          .min(1)
          .max(60)
          .regex(/^[a-z0-9_]+$/i, "Use apenas letras, números e sublinhado."),
        label: z.string().trim().min(1).max(80),
        ordem: z.number().int().min(0).max(999).default(0),
        ativo: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<CatalogoItem> => {
    const { supabase, userId } = context;
    const corr = await correspondenteId(supabase, userId);
    const payload = {
      correspondente_id: corr,
      categoria: data.categoria,
      valor: data.valor,
      label: data.label,
      ordem: data.ordem,
      ativo: data.ativo,
      updated_at: new Date().toISOString(),
    };
    const q = data.id
      ? supabase.from("sla_catalogo_itens").update(payload).eq("id", data.id)
      : supabase.from("sla_catalogo_itens").insert(payload);
    const { data: row, error } = await q
      .select("id, categoria, valor, label, ordem, ativo")
      .single();
    if (error) throw new Error(error.message);
    return row as CatalogoItem;
  });

/** Remove um item de catálogo. */
export const excluirCatalogoItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("sla_catalogo_itens")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export { CATEGORIAS };
