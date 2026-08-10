import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Presença bidirecional de uma conversa via Supabase Realtime Presence.
 *
 * Ambos os lados (time e cliente) entram no canal `chat-presence:{id}` enquanto
 * a conversa está aberta na tela. `peerOnline` só é verdadeiro quando existe
 * alguém do OUTRO papel efetivamente na conversa — é isso que permite exibir
 * "Atendimento ativo" apenas quando o agente está de fato no chat.
 */
export function useChatPresence(
  conversaId: string | null | undefined,
  papel: string,
  enabled = true,
): { peerOnline: boolean } {
  const [peerOnline, setPeerOnline] = useState(false);

  useEffect(() => {
    if (!conversaId || !enabled) {
      setPeerOnline(false);
      return;
    }
    const chave = `${papel}:${Math.random().toString(36).slice(2)}`;
    const canal = supabase.channel(`chat-presence:${conversaId}`, {
      config: { presence: { key: chave } },
    });

    function recalcular() {
      const estado = canal.presenceState() as Record<
        string,
        { papel?: string }[]
      >;
      const outros = Object.values(estado)
        .flat()
        .some((m) => m?.papel && m.papel !== papel);
      setPeerOnline(outros);
    }

    canal
      .on("presence", { event: "sync" }, recalcular)
      .on("presence", { event: "join" }, recalcular)
      .on("presence", { event: "leave" }, recalcular)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void canal.track({ papel, em: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(canal);
      setPeerOnline(false);
    };
  }, [conversaId, papel, enabled]);

  return { peerOnline };
}
