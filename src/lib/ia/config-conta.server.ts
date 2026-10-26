/**
 * Configuração de IA da conta (Configurações gerais › APIs de IA) — SÓ SERVIDOR.
 *
 * A tabela `admin_api_integrations` só é legível por administradores; quem usa o Scan IA e
 * o Consultor é qualquer pessoa da conta. Por isso a linha é lida com o client de serviço,
 * SEMPRE filtrada pelo correspondente de quem chama, e a chave nunca sai do servidor.
 */
import { configDaLinha, type ConfigProvedor } from "./provedor.server";

export async function configIaDaContaLinha(
  correspondenteId: string | null,
): Promise<{ cfg: ConfigProvedor; promptScan: string }> {
  let linha: { api_key: string | null; base_url: string | null; config: unknown; ativo: boolean } | null = null;
  if (correspondenteId) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("admin_api_integrations")
      .select("api_key, base_url, config, ativo")
      .eq("correspondente_id", correspondenteId)
      .eq("chave", "ia")
      .maybeSingle();
    if (error) throw new Error("Não foi possível ler a integração de IA da conta.");
    linha = data ?? null;
  }
  const cfg = configDaLinha(linha);
  const c = (linha?.config ?? {}) as Record<string, unknown>;
  const promptScan = typeof c.prompt_scan === "string" ? c.prompt_scan : "";
  return { cfg, promptScan };
}
