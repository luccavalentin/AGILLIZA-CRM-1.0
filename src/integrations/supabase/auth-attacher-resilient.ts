import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "./client";

/**
 * Middleware de cliente que anexa o token Bearer do Supabase às chamadas de
 * server functions.
 *
 * Diferente do attacher gerado, este é resiliente: se `getSession()` não trouxer
 * um token válido (sessão expirada em uma aba aberta há muito tempo), tenta
 * renovar a sessão com `refreshSession()` antes de desistir. Isso evita o erro
 * "Unauthorized: No authorization header provided" ao enviar mensagens no chat
 * ou executar qualquer ação após o token expirar.
 */
async function obterToken(): Promise<string | undefined> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const expiraEm = data.session?.expires_at; // epoch em segundos
  const agora = Math.floor(Date.now() / 1000);

  // Token ausente ou prestes a expirar (margem de 60s) -> tenta renovar.
  if (!token || (expiraEm != null && expiraEm - agora < 60)) {
    const { data: renovada } = await supabase.auth.refreshSession();
    return renovada.session?.access_token ?? token;
  }

  return token;
}

export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const token = await obterToken();
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
