import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ConfigTodos } from "@/lib/admin/configuracoes-modulos";

async function corr(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("correspondente_id")
    .eq("id", userId)
    .maybeSingle();
  return data?.correspondente_id ?? null;
}

export const obterConfiguracoesModulos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConfigTodos> => {
    const { supabase, userId } = context;
    const c = await corr(supabase, userId);
    if (!c) return {};
    const { data, error } = await supabase
      .from("configuracoes_modulos")
      .select("modulo, config")
      .eq("correspondente_id", c);
    if (error) throw error;
    const out: ConfigTodos = {};
    for (const row of data ?? []) {
      out[row.modulo as string] = (row.config ?? {}) as Record<string, boolean | number | string>;
    }
    return out;
  });

const salvarSchema = z.object({
  modulo: z.string().min(1).max(60),
  config: z.record(z.string(), z.union([z.boolean(), z.number(), z.string()])),
});

export const salvarConfiguracaoModulo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => salvarSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const c = await corr(supabase, userId);
    if (!c) throw new Error("Ecossistema não identificado.");

    const { data: pode } = await supabase.rpc("usuario_pode_admin", { _user_id: userId });
    if (!pode) throw new Error("Sem permissão para alterar configurações.");

    const payload = {
      correspondente_id: c,
      modulo: data.modulo,
      config: data.config,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("configuracoes_modulos")
      .upsert(payload, { onConflict: "correspondente_id,modulo" });
    if (error) throw error;
    return { ok: true };
  });
