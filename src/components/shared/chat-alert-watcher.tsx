import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { signalIncomingChat } from "@/components/shared/chat-alert-store";
import {
  abrirChatFlutuante,
  abrirDemandaChatFlutuante,
} from "@/components/shared/floating-chat-store";

interface Props {
  /** ID do usuário logado — usado para não abrir chat quando ele mesmo é o autor. */
  meuId?: string | null;
}

/**
 * Observador global (montado no shell interno): escuta novas mensagens de
 * QUALQUER chat (cliente e demanda) e, além de disparar o alerta (som + pisca
 * do menu), abre AUTOMATICAMENTE a janela flutuante do chat na tela do
 * destinatário — independentemente da rota atual.
 *
 * A entrega via Supabase Realtime respeita RLS, então só recebemos linhas às
 * quais o usuário logado tem acesso; ainda filtramos autor === eu para não
 * reabrir chat por mensagens que o próprio usuário enviou.
 */
export function ChatAlertWatcher({ meuId }: Props) {
  useEffect(() => {
    const canalCliente = supabase
      .channel("chat:alerta-global-cliente")
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
            cliente_id?: string | null;
            atendente_id?: string | null;
            remetente_tipo?: string | null;
          };
          // Só mensagens recebidas (do cliente), não as enviadas pelo time.
          if (!row?.id || row.remetente_tipo === "time") return;
          signalIncomingChat(row.id);
          // Abre a janela flutuante para o atendente destinatário.
          if (
            row.cliente_id &&
            (!row.atendente_id || !meuId || row.atendente_id === meuId)
          ) {
            abrirChatFlutuante(row.cliente_id);
          }
        },
      )
      .subscribe();

    const canalDemanda = supabase
      .channel("chat:alerta-global-demanda")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "demanda_mensagens",
        },
        (payload) => {
          const row = payload.new as {
            id?: string;
            demanda_id?: string | null;
            autor_id?: string | null;
          };
          if (!row?.id || !row.demanda_id) return;
          // Ignora mensagens escritas pelo próprio usuário.
          if (meuId && row.autor_id === meuId) return;
          signalIncomingChat(row.id);
          abrirDemandaChatFlutuante(row.demanda_id);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canalCliente);
      supabase.removeChannel(canalDemanda);
    };
  }, [meuId]);

  return null;
}
