import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CHAVE_IA = "ia";

export interface ConfigIA {
  id: string | null;
  nome: string;
  base_url: string | null;
  modelo: string;
  temperatura: number;
  prompt_scan: string;
  secret_names: string[];
  ativo: boolean;
  status: string | null;
  ultimo_ping_em: string | null;
}

const PROMPT_PADRAO =
  "Você é um assistente de extração de dados de documentos brasileiros (RG, CPF, CNH, comprovantes de renda e residência). " +
  "Extraia os campos solicitados em JSON, sem inventar valores. Deixe vazio o que não estiver legível.";

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

/** Configuração do provedor de IA (usado pelo Scan IA). Nunca retorna valores de secrets. */
export const getConfigIA = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConfigIA> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    const vazio: ConfigIA = {
      id: null,
      nome: "Provedor de IA",
      base_url: null,
      modelo: "gemini-2.5-flash",
      temperatura: 0.2,
      prompt_scan: PROMPT_PADRAO,
      secret_names: ["GEMINI_API_KEY"],
      ativo: true,
      status: null,
      ultimo_ping_em: null,
    };
    if (!corr) return vazio;

    const { data, error } = await supabase
      .from("admin_api_integrations")
      .select("id, nome, base_url, secret_names, ativo, status, ultimo_ping_em, config")
      .eq("correspondente_id", corr)
      .eq("chave", CHAVE_IA)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return vazio;

    const cfg = (data.config ?? {}) as Record<string, unknown>;
    return {
      id: data.id,
      nome: data.nome ?? "Provedor de IA",
      base_url: data.base_url,
      modelo: typeof cfg.modelo === "string" ? cfg.modelo : "gemini-2.5-flash",
      temperatura: typeof cfg.temperatura === "number" ? cfg.temperatura : 0.2,
      prompt_scan: typeof cfg.prompt_scan === "string" ? cfg.prompt_scan : PROMPT_PADRAO,
      secret_names: Array.isArray(data.secret_names)
        ? (data.secret_names as string[])
        : ["GEMINI_API_KEY"],
      ativo: data.ativo,
      status: data.status,
      ultimo_ping_em: data.ultimo_ping_em,
    };
  });

const configSchema = z.object({
  nome: z.string().trim().min(1).default("Provedor de IA"),
  base_url: z.string().trim().url().optional().nullable().or(z.literal("")),
  modelo: z.string().trim().min(1),
  temperatura: z.number().min(0).max(2),
  prompt_scan: z.string().trim().min(1),
  secret_names: z.array(z.string().trim().min(1)).default(["GEMINI_API_KEY"]),
  ativo: z.boolean().default(true),
});

/** Salva a configuração do provedor de IA (metadados, prompt e temperatura — nunca valores de secrets). */
export const salvarConfigIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => configSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) throw new Error("Ecossistema não identificado.");

    const { data: existente } = await supabase
      .from("admin_api_integrations")
      .select("id")
      .eq("correspondente_id", corr)
      .eq("chave", CHAVE_IA)
      .maybeSingle();

    const payload = {
      correspondente_id: corr,
      chave: CHAVE_IA,
      nome: data.nome,
      base_url: data.base_url || null,
      secret_names: data.secret_names,
      ativo: data.ativo,
      config: {
        modelo: data.modelo,
        temperatura: data.temperatura,
        prompt_scan: data.prompt_scan,
      },
      updated_at: new Date().toISOString(),
    };

    const q = existente
      ? supabase.from("admin_api_integrations").update(payload).eq("id", existente.id)
      : supabase.from("admin_api_integrations").insert(payload);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });
