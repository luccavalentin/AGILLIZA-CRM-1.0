import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Prioridade = "p1" | "p2" | "p3";

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
  if (!data) throw new Error("Usuário sem correspondente vinculado.");
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
        prioridade: z.enum(["p1", "p2", "p3"]),
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
