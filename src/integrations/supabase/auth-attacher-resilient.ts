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
// Compartilha uma única renovação de sessão entre chamadas simultâneas.
// No F5, várias server functions disparam em paralelo; sem isso, cada uma
// chamaria refreshSession() ao mesmo tempo, o refresh token rotacionaria e as
// concorrentes falhariam com "refresh token already used" — anexando um token
// inválido e travando a tela no esqueleto de carregamento.
let renovacaoEmAndamento: Promise<string | undefined> | null = null;

function renovarSessao(fallback?: string): Promise<string | undefined> {
  if (!renovacaoEmAndamento) {
    renovacaoEmAndamento = supabase.auth
      .refreshSession()
      .then(({ data }) => data.session?.access_token ?? fallback)
      .catch(() => fallback)
      .finally(() => {
        renovacaoEmAndamento = null;
      });
  }
  return renovacaoEmAndamento;
}

async function obterToken(): Promise<string | undefined> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const expiraEm = data.session?.expires_at; // epoch em segundos
  const agora = Math.floor(Date.now() / 1000);

  // Token ausente ou prestes a expirar (margem de 60s) -> renova (deduplicado).
  if (!token || (expiraEm != null && expiraEm - agora < 60)) {
    return renovarSessao(token);
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
