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
    let usuarioAtual: string | null = null;

    // Reingressa canais que possam ter se conectado ANTES do token chegar
    // ao socket. Sem isso, componentes montados na primeira renderização
    // (ex.: sino de notificações, watchers de chat) recebem "SUBSCRIBED"
    // mas eventos filtrados por RLS são descartados até um refresh manual.
    function aplicarToken(token: string | null) {
      supabase.realtime.setAuth(token);
      for (const ch of supabase.getChannels()) {
        // "joined" = canal já ativo antes do token correto ser aplicado.
        // Fazemos unsubscribe/subscribe para renegociar com o novo JWT.
        const estado = (ch as unknown as { state?: string }).state;
        if (estado === "joined") {
          void ch.unsubscribe().then(() => {
            try { ch.subscribe(); } catch { /* ignora — hook original recria */ }
          });
        }
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      if (cancelado) return;
      const token = data.session?.access_token ?? null;
      usuarioAtual = data.session?.user?.id ?? null;
      aplicarToken(token);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event !== "SIGNED_IN" &&
        event !== "SIGNED_OUT" &&
        event !== "USER_UPDATED" &&
        event !== "TOKEN_REFRESHED"
      ) {
        return;
      }

      aplicarToken(session?.access_token ?? null);

      if (event === "TOKEN_REFRESHED") return;

      const novoUsuario = session?.user?.id ?? null;
      const identidadeMudou = novoUsuario !== usuarioAtual;
      usuarioAtual = novoUsuario;

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

