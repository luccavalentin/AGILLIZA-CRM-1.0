import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface BancoCredencialLista {
  id: string;
  banco_id: string | null;
  banco_nome: string | null;
  ambiente: string;
  base_url: string | null;
  client_id_secret_name: string | null;
  client_secret_name: string | null;
  ativo: boolean;
}

export interface ApiIntegracaoLista {
  id: string;
  chave: string;
  nome: string;
  base_url: string | null;
  secret_names: string[];
  ativo: boolean;
  status: string | null;
  ultimo_ping_em: string | null;
}

export interface HealthCheckLista {
  id: string;
  integracao: string;
  sucesso: boolean;
  latencia_ms: number | null;
  detalhe: string | null;
  created_at: string;
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

/** Credenciais bancárias (apenas nomes de secrets, nunca valores). */
export const listarBancosCredenciais = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BancoCredencialLista[]> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) return [];

    const { data, error } = await supabase
      .from("banco_credenciais")
      .select("id, banco_id, ambiente, base_url, client_id_secret_name, client_secret_name, ativo")
      .eq("correspondente_id", corr)
      .order("created_at", { ascending: true });
    if (error) throw error;
    if (!data || data.length === 0) return [];

    const bancoIds = data.map((c) => c.banco_id).filter(Boolean) as string[];
    const nomes = new Map<string, string>();
    if (bancoIds.length > 0) {
      const { data: bancos } = await supabase
        .from("homefin_bancos")
        .select("id, nome_banco")
        .in("id", bancoIds);
      (bancos ?? []).forEach((b) => nomes.set(b.id, b.nome_banco));
    }

    return data.map((c) => ({
      ...c,
      banco_nome: c.banco_id ? (nomes.get(c.banco_id) ?? null) : null,
    }));
  });

/** Integrações de API administradas (apenas metadados e nomes de secrets). */
export const listarApiIntegracoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ApiIntegracaoLista[]> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) return [];

    const { data, error } = await supabase
      .from("admin_api_integrations")
      .select("id, chave, nome, base_url, secret_names, ativo, status, ultimo_ping_em")
      .eq("correspondente_id", corr)
      .order("nome", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((i) => ({
      ...i,
      secret_names: Array.isArray(i.secret_names) ? (i.secret_names as string[]) : [],
    }));
  });

/** Histórico de verificações de conectividade. */
export const listarHealthChecks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HealthCheckLista[]> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) return [];

    const { data, error } = await supabase
      .from("integracao_health_checks")
      .select("id, integracao, sucesso, latencia_ms, detalhe, created_at")
      .eq("correspondente_id", corr)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  });

/** Testa conectividade de uma integração (HEAD/GET na base_url) e registra o resultado. */
export const testarConectividade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ integracao: z.string().min(1), base_url: z.string().url() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<HealthCheckLista> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) throw new Error("Ecossistema não identificado.");

    let sucesso = false;
    let detalhe: string | null = null;
    const inicio = Date.now();
    try {
      const resp = await fetch(data.base_url, {
        method: "GET",
        signal: AbortSignal.timeout(8000),
      });
      sucesso = resp.status < 500;
      detalhe = `HTTP ${resp.status}`;
    } catch (e) {
      sucesso = false;
      detalhe = e instanceof Error ? e.message : "Falha de conexão";
    }
    const latencia = Date.now() - inicio;

    const { data: inserted, error } = await supabase
      .from("integracao_health_checks")
      .insert({
        correspondente_id: corr,
        integracao: data.integracao,
        sucesso,
        latencia_ms: latencia,
        detalhe,
        ator_id: userId,
      })
      .select("id, integracao, sucesso, latencia_ms, detalhe, created_at")
      .single();
    if (error) throw error;
    return inserted;
  });

/**
 * Sincroniza os catálogos de bancos e operações a partir do provedor de
 * integração (domínios oficiais). Restrito a administradores/gestores.
 */
export const sincronizarDominios = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ bancos: number; operacoes: number }> => {
    const { supabase, userId } = context;
    const { data: pode } = await supabase.rpc("usuario_pode_admin", { _user_id: userId });
    if (!pode) throw new Error("Você não tem permissão para sincronizar domínios.");

    const { integracaoConfigurada, sincronizarDominiosIntegracao, sanitizarMensagemErro } =
      await import("@/lib/simulacao/homefin.server");
    if (!integracaoConfigurada()) {
      throw new Error("Integração bancária não configurada. Cadastre as credenciais primeiro.");
    }
    try {
      return await sincronizarDominiosIntegracao();
    } catch (e) {
      throw new Error(sanitizarMensagemErro(e instanceof Error ? e.message : null));
    }
  });
