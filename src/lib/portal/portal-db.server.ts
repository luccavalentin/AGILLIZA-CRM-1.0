/**
 * Cliente Supabase para o Portal do Cliente.
 *
 * O portal NÃO usa autenticação do Supabase — a sessão é selada em cookie
 * HttpOnly próprio. Por isso as operações são feitas via chave publishable
 * (anon) chamando funções SECURITY DEFINER (portal_*), que validam o acesso
 * internamente. Assim o portal não depende da chave de serviço.
 *
 * Server-only: importar apenas dentro de handlers de server functions.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

let _client: ReturnType<typeof createClient<Database>> | undefined;

export function portalDb() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Configuração do portal indisponível.");
  }
  _client = createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    // Chaves publishable no formato novo (sb_publishable_...) são opacas, não
    // JWTs: o PostgREST rejeita com "Expected 3 parts in JWT; got 1" quando
    // enviadas como Authorization: Bearer. Enviamos apenas via apikey.
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input as RequestInfo, { ...init, headers });
      },
    },
  });
  return _client;
}
