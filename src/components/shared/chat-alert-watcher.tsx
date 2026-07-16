import { useEffect, useRef } from "react";
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
 * Observador global: escuta novas mensagens de qualquer chat (cliente e
 * demanda), dispara alerta sonoro/pisca do menu e abre a janela do próprio
 * chat MINIMIZADA (canto superior direito) exibindo apenas o identificador
 * (nº da demanda / nome do cliente). O usuário decide quando expandir.
 */
export function ChatAlertWatcher({ meuId }: Props) {
  const vistos = useRef<Set<string>>(new Set());

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
        async (payload) => {
          const row = payload.new as {
            id?: string;
            cliente_id?: string | null;
            atendente_id?: string | null;
            remetente_tipo?: string | null;
          };
          if (!row?.id || row.remetente_tipo === "time") return;
          if (vistos.current.has(row.id)) return;
          vistos.current.add(row.id);
          signalIncomingChat(row.id);
          if (!row.cliente_id) return;
          if (row.atendente_id && meuId && row.atendente_id !== meuId) return;

          const { data: cli } = await supabase
            .from("clientes")
            .select("nome")
            .eq("id", row.cliente_id)
            .maybeSingle();
          const nome = (cli?.nome as string | null) ?? "Cliente";

          abrirChatFlutuante(
            row.cliente_id,
            { nome },
            { minimized: true },
          );
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
        async (payload) => {
          const row = payload.new as {
            id?: string;
            demanda_id?: string | null;
            autor_id?: string | null;
          };
          if (!row?.id || !row.demanda_id) return;
          if (meuId && row.autor_id === meuId) return;
          if (vistos.current.has(row.id)) return;
          vistos.current.add(row.id);
          signalIncomingChat(row.id);

          const [{ data: dem }, { data: autor }] = await Promise.all([
            supabase
            .from("demandas")
              .select("numero, titulo")
            .eq("id", row.demanda_id)
              .maybeSingle(),
            row.autor_id
              ? supabase
                  .from("profiles")
                  .select("nome, foto_url")
                  .eq("id", row.autor_id)
                  .maybeSingle()
              : Promise.resolve({ data: null }),
          ]);
          const numero = (dem?.numero as string | null) ?? "—";
          const titulo = (dem?.titulo as string | null) ?? null;
          const interlocutorNome = (autor?.nome as string | null) ?? null;
          const interlocutorFoto = (autor?.foto_url as string | null) ?? null;

          abrirDemandaChatFlutuante(
            row.demanda_id,
            { numero, titulo, interlocutorNome, interlocutorFoto },
            { minimized: true },
          );
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
