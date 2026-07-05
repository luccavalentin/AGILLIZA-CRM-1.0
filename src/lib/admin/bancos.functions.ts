import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface BancoAdmin {
  id: string;
  codigo_banco: number;
  nome_banco: string;
  flag_simulacao: string;
  ativo: boolean;
  flag_padrao: boolean;
  ordem: number;
  produtos: string[];
  logo_url: string | null;
  codigo_agencia_padrao: string | null;
  codigo_parceiro: string | null;
  // credencial vinculada (apenas metadados / nomes de secrets)
  credencial: {
    id: string;
    ambiente: string;
    base_url: string | null;
    client_id_secret_name: string | null;
    client_secret_name: string | null;
    ativo: boolean;
  } | null;
}

async function correspondenteDoUsuario(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("correspondente_id")
    .eq("id", userId)
    .maybeSingle();
  return data?.correspondente_id ?? null;
}

/** Lista todos os bancos parceiros com a credencial vinculada (nomes de secrets, nunca valores). */
export const listarBancosAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BancoAdmin[]> => {
    const { supabase, userId } = context;
    const { data: bancos, error } = await supabase
      .from("homefin_bancos")
      .select(
        "id, codigo_banco, nome_banco, flag_simulacao, ativo, flag_padrao, ordem, produtos, logo_url, codigo_agencia_padrao, codigo_parceiro",
      )
      .order("ordem", { ascending: true })
      .order("nome_banco", { ascending: true });
    if (error) throw error;

    const corr = await correspondenteDoUsuario(supabase, userId);
    const creds = new Map<string, BancoAdmin["credencial"]>();
    if (corr) {
      const { data: rows } = await supabase
        .from("banco_credenciais")
        .select(
          "id, banco_id, ambiente, base_url, client_id_secret_name, client_secret_name, ativo",
        )
        .eq("correspondente_id", corr);
      (rows ?? []).forEach((r: any) => {
        if (r.banco_id) {
          creds.set(r.banco_id, {
            id: r.id,
            ambiente: r.ambiente,
            base_url: r.base_url,
            client_id_secret_name: r.client_id_secret_name,
            client_secret_name: r.client_secret_name,
            ativo: r.ativo,
          });
        }
      });
    }

    return (bancos ?? []).map((b: any) => ({
      ...b,
      produtos: Array.isArray(b.produtos) ? b.produtos : [],
      credencial: creds.get(b.id) ?? null,
    }));
  });

const bancoSchema = z.object({
  id: z.string().uuid(),
  ativo: z.boolean().optional(),
  flag_padrao: z.boolean().optional(),
  ordem: z.number().int().min(0).optional(),
  codigo_agencia_padrao: z.string().trim().optional().nullable(),
  codigo_parceiro: z.string().trim().optional().nullable(),
});

/** Atualiza os dados de configuração de um banco parceiro. */
export const salvarBancoAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => bancoSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const payload = {
      updated_at: new Date().toISOString(),
      ...(data.ativo !== undefined ? { ativo: data.ativo } : {}),
      ...(data.flag_padrao !== undefined ? { flag_padrao: data.flag_padrao } : {}),
      ...(data.ordem !== undefined ? { ordem: data.ordem } : {}),
      ...(data.codigo_agencia_padrao !== undefined
        ? { codigo_agencia_padrao: data.codigo_agencia_padrao || null }
        : {}),
      ...(data.codigo_parceiro !== undefined
        ? { codigo_parceiro: data.codigo_parceiro || null }
        : {}),
    };

    const { error } = await context.supabase
      .from("homefin_bancos")
      .update(payload)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const credSchema = z.object({
  banco_id: z.string().uuid(),
  ambiente: z.enum(["homologacao", "producao"]).default("homologacao"),
  base_url: z.string().trim().url().optional().nullable().or(z.literal("")),
  client_id_secret_name: z.string().trim().optional().nullable(),
  client_secret_name: z.string().trim().optional().nullable(),
  ativo: z.boolean().default(true),
});

/** Cria/atualiza a credencial (nomes de secrets) de um banco para o correspondente. */
export const salvarCredencialBanco = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => credSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) throw new Error("Ecossistema não identificado.");

    const { data: existente } = await supabase
      .from("banco_credenciais")
      .select("id")
      .eq("correspondente_id", corr)
      .eq("banco_id", data.banco_id)
      .maybeSingle();

    const payload = {
      correspondente_id: corr,
      banco_id: data.banco_id,
      ambiente: data.ambiente,
      base_url: data.base_url || null,
      client_id_secret_name: data.client_id_secret_name || null,
      client_secret_name: data.client_secret_name || null,
      ativo: data.ativo,
      updated_at: new Date().toISOString(),
    };

    const q = existente
      ? supabase.from("banco_credenciais").update(payload).eq("id", existente.id)
      : supabase.from("banco_credenciais").insert(payload);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });
