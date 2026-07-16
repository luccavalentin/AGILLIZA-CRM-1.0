import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CHAVE_IA = "ia";

export type ProvedorIA = "gemini" | "openai";

export interface ConfigIA {
  id: string | null;
  provedor: ProvedorIA;
  nome: string;
  base_url: string | null;
  modelo: string;
  temperatura: number;
  prompt_scan: string;
  secret_names: string[];
  ativo: boolean;
  status: string | null;
  ultimo_ping_em: string | null;
  has_api_key: boolean;
}

/** Presets por provedor de IA (modelo, endpoint e nome do secret sugeridos). */
export const PRESETS_IA: Record<
  ProvedorIA,
  {
    nome: string;
    modelo: string;
    base_url: string;
    secret_name: string;
    modelos: { value: string; label: string }[];
  }
> = {
  gemini: {
    nome: "Google Gemini",
    modelo: "gemini-2.5-flash",
    base_url: "https://generativelanguage.googleapis.com",
    secret_name: "GEMINI_API_KEY",
    modelos: [
      { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
      { value: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite" },
      { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
      { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
    ],
  },
  openai: {
    nome: "OpenAI (ChatGPT)",
    modelo: "gpt-4o-mini",
    base_url: "https://api.openai.com/v1",
    secret_name: "OPENAI_API_KEY",
    modelos: [
      { value: "gpt-4o-mini", label: "GPT-4o mini" },
      { value: "gpt-4o", label: "GPT-4o" },
      { value: "gpt-4.1-mini", label: "GPT-4.1 mini" },
      { value: "gpt-4.1", label: "GPT-4.1" },
      { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
      { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
    ],
  },
};

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
      provedor: "gemini",
      nome: PRESETS_IA.gemini.nome,
      base_url: PRESETS_IA.gemini.base_url,
      modelo: PRESETS_IA.gemini.modelo,
      temperatura: 0.2,
      prompt_scan: PROMPT_PADRAO,
      secret_names: [PRESETS_IA.gemini.secret_name],
      ativo: true,
      status: null,
      ultimo_ping_em: null,
      has_api_key: false,
    };

    if (!corr) return vazio;

    const { data, error } = await supabase
      .from("admin_api_integrations")
      .select("id, nome, base_url, secret_names, ativo, status, ultimo_ping_em, config, api_key")
      .eq("correspondente_id", corr)
      .eq("chave", CHAVE_IA)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return vazio;

    const cfg = (data.config ?? {}) as Record<string, unknown>;
    const provedor: ProvedorIA = cfg.provedor === "openai" ? "openai" : "gemini";
    return {
      id: data.id,
      provedor,
      nome: data.nome ?? PRESETS_IA[provedor].nome,
      base_url: data.base_url,
      modelo: typeof cfg.modelo === "string" ? cfg.modelo : PRESETS_IA[provedor].modelo,
      temperatura: typeof cfg.temperatura === "number" ? cfg.temperatura : 0.2,
      prompt_scan: typeof cfg.prompt_scan === "string" ? cfg.prompt_scan : PROMPT_PADRAO,
      secret_names: Array.isArray(data.secret_names)
        ? (data.secret_names as string[])
        : [PRESETS_IA[provedor].secret_name],
      ativo: data.ativo,
      status: data.status,
      ultimo_ping_em: data.ultimo_ping_em,
      has_api_key: Boolean(data.api_key && String(data.api_key).length > 0),
    };
  });

const configSchema = z.object({
  provedor: z.enum(["gemini", "openai"]).default("gemini"),
  nome: z.string().trim().min(1).default("Provedor de IA"),
  base_url: z.string().trim().url().optional().nullable().or(z.literal("")),
  modelo: z.string().trim().min(1),
  temperatura: z.number().min(0).max(2),
  prompt_scan: z.string().trim().min(1),
  secret_names: z.array(z.string().trim().min(1)).default(["GEMINI_API_KEY"]),
  ativo: z.boolean().default(true),
  /** Chave da API. Se vazio/omisso, mantém a chave já salva. */
  api_key: z.string().trim().optional().nullable(),
});

/** Salva a configuração do provedor de IA (metadados, prompt, temperatura e chave da API). */
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
        provedor: data.provedor,
        modelo: data.modelo,
        temperatura: data.temperatura,
        prompt_scan: data.prompt_scan,
      },
      updated_at: new Date().toISOString(),
      ...(typeof data.api_key === "string" && data.api_key.trim().length > 0
        ? { api_key: data.api_key.trim() }
        : {}),
    };

    const q = existente
      ? supabase.from("admin_api_integrations").update(payload).eq("id", existente.id)
      : supabase.from("admin_api_integrations").insert(payload);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Testa a conexão com o provedor de IA usando a chave e URL salvas (ou informadas). */
export const testarConexaoIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        provedor: z.enum(["gemini", "openai"]),
        modelo: z.string().trim().min(1),
        base_url: z.string().trim().url().optional().nullable().or(z.literal("")),
        api_key: z.string().trim().optional().nullable(),
      })
      .parse(d),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ ok: boolean; status?: number; message: string; modelo?: string }> => {
      const { supabase, userId } = context;
      const corr = await correspondenteDoUsuario(supabase, userId);

      // Recupera a chave salva se o usuário não passou uma nova
      let apiKey = (data.api_key ?? "").trim();
      if (!apiKey && corr) {
        const { data: row } = await supabase
          .from("admin_api_integrations")
          .select("api_key")
          .eq("correspondente_id", corr)
          .eq("chave", CHAVE_IA)
          .maybeSingle();
        apiKey = (row?.api_key ?? "").trim();
      }
      if (!apiKey) {
        return { ok: false, message: "Nenhuma chave de API cadastrada. Informe a chave e tente novamente." };
      }

      const baseUrl = (data.base_url || PRESETS_IA[data.provedor].base_url).replace(/\/+$/, "");
      const modelo = data.modelo || PRESETS_IA[data.provedor].modelo;

      try {
        if (data.provedor === "openai") {
          const res = await fetch(`${baseUrl}/models/${encodeURIComponent(modelo)}`, {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          if (!res.ok) {
            const body = await res.text().catch(() => "");
            const msg = extrairMensagem(body) || `Falha HTTP ${res.status}`;
            await marcarStatus(supabase, corr, "erro");
            return { ok: false, status: res.status, message: msg };
          }
          await marcarStatus(supabase, corr, "ok");
          return { ok: true, status: res.status, message: "Conexão OK com a OpenAI.", modelo };
        }

        // Gemini
        const url = `${baseUrl}/v1beta/models/${encodeURIComponent(modelo)}?key=${encodeURIComponent(apiKey)}`;
        const res = await fetch(url);
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          const msg = extrairMensagem(body) || `Falha HTTP ${res.status}`;
          await marcarStatus(supabase, corr, "erro");
          return { ok: false, status: res.status, message: msg };
        }
        await marcarStatus(supabase, corr, "ok");
        return { ok: true, status: res.status, message: "Conexão OK com o Google Gemini.", modelo };
      } catch (err) {
        await marcarStatus(supabase, corr, "erro");
        const msg = err instanceof Error ? err.message : "Erro de rede desconhecido.";
        return { ok: false, message: `Falha ao conectar: ${msg}` };
      }
    },
  );

function extrairMensagem(body: string): string | null {
  if (!body) return null;
  try {
    const j = JSON.parse(body);
    return j?.error?.message ?? j?.message ?? null;
  } catch {
    return body.slice(0, 240);
  }
}

async function marcarStatus(
  supabase: { from: (t: string) => any },
  corr: string | null,
  status: "ok" | "erro",
) {
  if (!corr) return;
  await supabase
    .from("admin_api_integrations")
    .update({ status, ultimo_ping_em: new Date().toISOString() })
    .eq("correspondente_id", corr)
    .eq("chave", CHAVE_IA);
}
