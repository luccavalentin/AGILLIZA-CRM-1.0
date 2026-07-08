import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { signalIncomingChat } from "@/components/shared/chat-alert-store";

/**
 * Observador global (montado no shell interno): escuta novas mensagens de chat
 * de clientes em QUALQUER conversa e dispara o alerta (som + piscar do menu),
 * mesmo que a tela de chat não esteja aberta. A deduplicação por id evita
 * alerta duplicado quando a própria tela de chat também está aberta.
 */
export function ChatAlertWatcher() {
  useEffect(() => {
    const canal = supabase
      .channel("chat:alerta-global")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "cliente_app_mensagens",
        },
        (payload) => {
          const row = payload.new as {
            id?: string;
            remetente_tipo?: string | null;
          };
          // Só mensagens recebidas (do cliente), não as enviadas pelo time.
          if (!row?.id || row.remetente_tipo === "time") return;
          signalIncomingChat(row.id);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  return null;
}
