import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  signalIncomingChat,
  pedirPermissaoNotificacao,
} from "@/components/shared/chat-alert-store";
import {
  abrirChatFlutuante,
  abrirDemandaChatFlutuante,
  abrirDmFlutuante,
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
    pedirPermissaoNotificacao();
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
          if (!row.cliente_id) {
            signalIncomingChat(row.id);
            return;
          }
          if (row.atendente_id && meuId && row.atendente_id !== meuId) return;

          const { data: cli } = await supabase
            .from("clientes")
            .select("nome")
            .eq("id", row.cliente_id)
            .maybeSingle();
          const nome = (cli?.nome as string | null) ?? "Cliente";
          signalIncomingChat(row.id, {
            titulo: `Nova mensagem · ${nome}`,
            corpo: "Você recebeu uma mensagem no chat do cliente.",
            skipSound: false, // Requisito: deve emitir som
          });

          // Som explícito para garantir que toca em todo chat aberto
          import("@/lib/chat-sound").then((m) => m.playChatSound());

          abrirChatFlutuante(row.cliente_id, { nome }, { minimized: true });
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
          signalIncomingChat(row.id, {
            titulo: `Nova mensagem · Demanda ${numero}`,
            corpo: interlocutorNome ?? titulo ?? undefined,
            skipSound: false,
          });

          import("@/lib/chat-sound").then((m) => m.playChatSound());

          abrirDemandaChatFlutuante(
            row.demanda_id,
            { numero, titulo, interlocutorNome, interlocutorFoto },
            { minimized: true },
          );
        },
      )
      .subscribe();

    // Mensagens diretas entre usuários internos (DM): abrem a janela do chat
    // na tela imediatamente, para o colega poder responder sem procurar o menu.
    const canalDm = supabase
      .channel("chat:alerta-global-dm")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "dm_mensagens" },
        async (payload) => {
          const row = payload.new as {
            id?: string;
            conversa_id?: string | null;
            autor_id?: string | null;
          };
          if (!row?.id || !row.conversa_id) return;
          if (meuId && row.autor_id === meuId) return;
          if (vistos.current.has(row.id)) return;
          vistos.current.add(row.id);

          // Só alerta se eu participo da conversa (RLS já restringe, mas o
          // canal pode entregar eventos de outras conversas visíveis).
          if (meuId) {
            const { data: sou } = await supabase
              .from("dm_participantes")
              .select("user_id")
              .eq("conversa_id", row.conversa_id)
              .eq("user_id", meuId)
              .maybeSingle();
            if (!sou) return;
          }

          const { data: autor } = row.autor_id
            ? await supabase.from("profiles").select("nome").eq("id", row.autor_id).maybeSingle()
            : { data: null };
          const nome = (autor?.nome as string | null) ?? "Colega";
          signalIncomingChat(row.id, {
            titulo: `Nova mensagem · ${nome}`,
            corpo: "Você recebeu uma mensagem direta.",
            skipSound: false,
          });

          import("@/lib/chat-sound").then((m) => m.playChatSound());
          abrirDmFlutuante(row.conversa_id, { nome }, { minimized: true });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canalCliente);
      supabase.removeChannel(canalDemanda);
      supabase.removeChannel(canalDm);
    };
  }, [meuId]);

  return null;
}
