import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ParametrosGlobais {
  id: string | null;
  nome_empresa: string | null;
  cnpj: string | null;
  logo_url: string | null;
  cor_primaria: string | null;
  endereco: string | null;
  telefone_sac: string | null;
  politica_lgpd: string | null;
  politica_privacidade: string | null;
  email_dpo: string | null;
}

const salvarSchema = z.object({
  nome_empresa: z.string().max(160).optional().nullable(),
  cnpj: z.string().max(20).optional().nullable(),
  cor_primaria: z.string().max(30).optional().nullable(),
  endereco: z.string().max(300).optional().nullable(),
  telefone_sac: z.string().max(40).optional().nullable(),
  email_dpo: z.string().email().optional().nullable().or(z.literal("")),
  politica_lgpd: z.string().max(20000).optional().nullable(),
  politica_privacidade: z.string().max(20000).optional().nullable(),
});

async function corr(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("correspondente_id")
    .eq("id", userId)
    .maybeSingle();
  return data?.correspondente_id ?? null;
}

export const obterParametros = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ParametrosGlobais> => {
    const { supabase, userId } = context;
    const c = await corr(supabase, userId);
    const vazio: ParametrosGlobais = {
      id: null,
      nome_empresa: null,
      cnpj: null,
      logo_url: null,
      cor_primaria: null,
      endereco: null,
      telefone_sac: null,
      politica_lgpd: null,
      politica_privacidade: null,
      email_dpo: null,
    };
    if (!c) return vazio;
    const { data, error } = await supabase
      .from("parametros_globais")
      .select(
        "id, nome_empresa, cnpj, logo_url, cor_primaria, endereco, telefone_sac, politica_lgpd, politica_privacidade, email_dpo",
      )
      .eq("correspondente_id", c)
      .maybeSingle();
    if (error) throw error;
    return data ?? vazio;
  });

export const salvarParametros = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => salvarSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const c = await corr(supabase, userId);
    if (!c) throw new Error("Ecossistema não identificado.");

    const { data: pode } = await supabase.rpc("usuario_pode_admin", {
      _user_id: userId,
    });
    if (!pode) throw new Error("Sem permissão para alterar parâmetros.");

    const payload = {
      ...data,
      email_dpo: data.email_dpo === "" ? null : data.email_dpo,
      correspondente_id: c,
    };

    const { data: existente } = await supabase
      .from("parametros_globais")
      .select("id")
      .eq("correspondente_id", c)
      .maybeSingle();

    if (existente?.id) {
      const { error } = await supabase
        .from("parametros_globais")
        .update(payload)
        .eq("id", existente.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("parametros_globais")
        .insert(payload);
      if (error) throw error;
    }
    return { ok: true };
  });
