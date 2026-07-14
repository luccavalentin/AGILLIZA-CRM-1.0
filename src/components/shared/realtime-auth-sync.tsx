import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/**
 * Sincroniza o token de autenticação com o socket de Tempo Real.
 *
 * Sem isto, os canais `postgres_changes` conectam (status SUBSCRIBED), mas
 * como as tabelas (demanda_mensagens, cliente_app_mensagens, etc.) têm RLS,
 * o servidor de Tempo Real filtra TODAS as alterações e nenhum evento chega
 * ao cliente — fazendo com que mensagens de chats/demandas só apareçam após
 * recarregar a página.
 *
 * Deve ser montado uma única vez, na raiz da aplicação.
 */
export function RealtimeAuthSync() {
  const qc = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    let cancelado = false;
    // Guarda a identidade atual para invalidar queries/rotas SOMENTE quando
    // o usuário realmente troca. Sem isso, o Supabase dispara SIGNED_IN em
    // toda hidratação inicial, refresh de token entre abas e sincronização
    // de sessão — causando "apagões" em cada troca de tela porque todos os
    // loaders re-executam simultaneamente.
    let usuarioAtual: string | null = null;

    // Aplica o token atual assim que a sessão é recuperada do storage.
    supabase.auth.getSession().then(({ data }) => {
      if (cancelado) return;
      const token = data.session?.access_token ?? null;
      usuarioAtual = data.session?.user?.id ?? null;
      supabase.realtime.setAuth(token);
    });

    // Mantém o token do socket em dia em cada transição de identidade.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event !== "SIGNED_IN" &&
        event !== "SIGNED_OUT" &&
        event !== "USER_UPDATED" &&
        event !== "TOKEN_REFRESHED"
      ) {
        return;
      }

      supabase.realtime.setAuth(session?.access_token ?? null);

      // Refresh de token é transparente para a UI — nunca invalidar.
      if (event === "TOKEN_REFRESHED") return;

      const novoUsuario = session?.user?.id ?? null;
      const identidadeMudou = novoUsuario !== usuarioAtual;
      usuarioAtual = novoUsuario;

      // SIGNED_IN é emitido também na hidratação inicial e ao trocar de
      // aba: só invalida quando a identidade realmente muda (login/logout
      // real ou troca de conta). Isso elimina os "apagões" em navegação.
      if (!identidadeMudou) return;

      router.invalidate();
      if (event !== "SIGNED_OUT") qc.invalidateQueries();
    });

    return () => {
      cancelado = true;
      sub.subscription.unsubscribe();
    };
  }, [qc, router]);

  return null;
}

