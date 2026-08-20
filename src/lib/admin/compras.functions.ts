import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface CompraLinha {
  id: string;
  numero: string | null;
  descricao: string;
  valor: number;
  categoria: string | null;
  status: string;
  observacao: string | null;
  solicitante_id: string | null;
  solicitante_nome: string | null;
  aprovado_em: string | null;
  created_at: string;
}

async function corr(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("correspondente_id")
    .eq("id", userId)
    .maybeSingle();
  return data?.correspondente_id ?? null;
}

export const listarCompras = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CompraLinha[]> => {
    const { supabase, userId } = context;
    const c = await corr(supabase, userId);
    if (!c) return [];
    const { data, error } = await supabase
      .from("purchase_requests")
      .select(
        "id, numero, descricao, valor, categoria, status, observacao, solicitante_id, aprovado_em, created_at",
      )
      .eq("correspondente_id", c)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    if (!data || data.length === 0) return [];

    const ids = [...new Set(data.map((r) => r.solicitante_id).filter(Boolean))] as string[];
    const nomes = new Map<string, string>();
    if (ids.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, nome").in("id", ids);
      (profs ?? []).forEach((p) => nomes.set(p.id, p.nome ?? ""));
    }
    return data.map((r) => ({
      ...r,
      valor: Number(r.valor),
      solicitante_nome: r.solicitante_id ? (nomes.get(r.solicitante_id) ?? null) : null,
    }));
  });

export const criarCompra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        descricao: z.string().min(3, "Descreva a solicitação."),
        valor: z.number().nonnegative(),
        categoria: z.string().optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const c = await corr(supabase, userId);
    if (!c) throw new Error("Ecossistema não identificado.");
    const { error } = await supabase.from("purchase_requests").insert({
      correspondente_id: c,
      solicitante_id: userId,
      descricao: data.descricao,
      valor: data.valor,
      categoria: data.categoria ?? null,
      status: "pendente",
    });
    if (error) throw error;
    return { ok: true };
  });

export const editarCompra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        descricao: z.string().min(3, "Descreva a solicitação."),
        valor: z.number().nonnegative(),
        categoria: z.string().optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase } = context;
    const { error } = await supabase
      .from("purchase_requests")
      .update({
        descricao: data.descricao,
        valor: data.valor,
        categoria: data.categoria ?? null,
      })
      .eq("id", data.id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    return { ok: true };
  });

export const excluirCompra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase } = context;
    const { error } = await supabase.from("purchase_requests").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const decidirCompra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        aprovar: z.boolean(),
        observacao: z.string().optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { data: pode } = await supabase.rpc("usuario_pode_admin", {
      _user_id: userId,
    });
    if (!pode) throw new Error("Sem permissão para aprovar compras.");

    const { error } = await supabase
      .from("purchase_requests")
      .update({
        status: data.aprovar ? "aprovada" : "recusada",
        aprovador_id: userId,
        aprovado_em: new Date().toISOString(),
        observacao: data.observacao ?? null,
      })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
