import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useRouter } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { signalIncomingChat } from "@/components/shared/chat-alert-store";

interface Props {
  /** ID do usuário logado — usado para não abrir chat quando ele mesmo é o autor. */
  meuId?: string | null;
}

/**
 * Observador global: escuta novas mensagens de qualquer chat (cliente e
 * demanda), dispara alerta (som + pisca do menu) e mostra um card compacto
 * (toast) preservando a privacidade — só nº da demanda / nome do cliente e
 * um botão "Ver" que leva para a tela original do chat.
 */
export function ChatAlertWatcher({ meuId }: Props) {
  const router = useRouter();
  // Evita disparar múltiplos toasts para a mesma mensagem em StrictMode.
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

          const clienteId = row.cliente_id;
          toast("Nova mensagem", {
            description: `Cliente · ${nome}`,
            icon: <MessageSquare className="h-4 w-4" />,
            action: {
              label: "Ver",
              onClick: () =>
                router.navigate({
                  to: "/crm/chat",
                  search: { c: clienteId },
                }),
            },
          });
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

          const { data: dem } = await supabase
            .from("demandas")
            .select("numero, titulo")
            .eq("id", row.demanda_id)
            .maybeSingle();
          const numero = (dem?.numero as string | null) ?? "—";
          const demandaId = row.demanda_id;
          toast("Nova mensagem", {
            description: `Demanda · ${numero}`,
            icon: <MessageSquare className="h-4 w-4" />,
            action: {
              label: "Ver",
              onClick: () =>
                router.navigate({
                  to: "/operacional/demandas/$id",
                  params: { id: demandaId },
                }),
            },
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canalCliente);
      supabase.removeChannel(canalDemanda);
    };
  }, [meuId, router]);

  return null;
}
