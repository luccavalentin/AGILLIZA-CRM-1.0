import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ParametrosGlobais {
  id: string | null;
  nome_empresa: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  cnpj: string | null;
  inscricao_estadual: string | null;
  inscricao_municipal: string | null;
  logo_url: string | null;
  cor_primaria: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  endereco: string | null;
  email_empresa: string | null;
  telefone_empresa: string | null;
  telefone_sac: string | null;
  site: string | null;
  responsavel_nome: string | null;
  politica_lgpd: string | null;
  politica_privacidade: string | null;
  email_dpo: string | null;
}

const CAMPOS =
  "id, nome_empresa, razao_social, nome_fantasia, cnpj, inscricao_estadual, inscricao_municipal, logo_url, cor_primaria, cep, logradouro, numero, complemento, bairro, cidade, uf, endereco, email_empresa, telefone_empresa, telefone_sac, site, responsavel_nome, politica_lgpd, politica_privacidade, email_dpo";

const salvarSchema = z.object({
  nome_empresa: z.string().max(160).optional().nullable(),
  razao_social: z.string().max(200).optional().nullable(),
  nome_fantasia: z.string().max(200).optional().nullable(),
  cnpj: z.string().max(20).optional().nullable(),
  inscricao_estadual: z.string().max(40).optional().nullable(),
  inscricao_municipal: z.string().max(40).optional().nullable(),
  cor_primaria: z.string().max(30).optional().nullable(),
  cep: z.string().max(12).optional().nullable(),
  logradouro: z.string().max(200).optional().nullable(),
  numero: z.string().max(20).optional().nullable(),
  complemento: z.string().max(120).optional().nullable(),
  bairro: z.string().max(120).optional().nullable(),
  cidade: z.string().max(120).optional().nullable(),
  uf: z.string().max(2).optional().nullable(),
  endereco: z.string().max(300).optional().nullable(),
  email_empresa: z.string().email().optional().nullable().or(z.literal("")),
  telefone_empresa: z.string().max(40).optional().nullable(),
  telefone_sac: z.string().max(40).optional().nullable(),
  site: z.string().max(200).optional().nullable(),
  responsavel_nome: z.string().max(160).optional().nullable(),
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
      razao_social: null,
      nome_fantasia: null,
      cnpj: null,
      inscricao_estadual: null,
      inscricao_municipal: null,
      logo_url: null,
      cor_primaria: null,
      cep: null,
      logradouro: null,
      numero: null,
      complemento: null,
      bairro: null,
      cidade: null,
      uf: null,
      endereco: null,
      email_empresa: null,
      telefone_empresa: null,
      telefone_sac: null,
      site: null,
      responsavel_nome: null,
      politica_lgpd: null,
      politica_privacidade: null,
      email_dpo: null,
    };
    if (!c) return vazio;
    const { data, error } = await supabase
      .from("parametros_globais")
      .select(CAMPOS)
      .eq("correspondente_id", c)
      .maybeSingle();
    if (error) throw error;
    return (data as ParametrosGlobais | null) ?? vazio;
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
      const { error } = await supabase.from("parametros_globais").insert(payload);
      if (error) throw error;
    }
    return { ok: true };
  });
