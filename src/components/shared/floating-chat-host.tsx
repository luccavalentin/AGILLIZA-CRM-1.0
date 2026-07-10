import { FloatingWindow } from "@/components/shared/pop-out-panel";
import {
  useFloatingChat,
  fecharChatFlutuante,
} from "@/components/shared/floating-chat-store";
import { ChatClienteConversa } from "@/components/crm/chat-cliente-tab";

/**
 * Host global da conversa flutuante. Fica montado no layout raiz, então a
 * janela permanece aberta ao navegar entre telas do sistema.
 */
export function FloatingChatHost() {
  const flutuante = useFloatingChat();
  if (!flutuante) return null;

  return (
    <FloatingWindow
      title={`Conversa · ${flutuante.info?.nome ?? "Cliente"}`}
      onClose={fecharChatFlutuante}
    >
      <div className="h-full min-h-[24rem]">
        <ChatClienteConversa
          key={flutuante.clienteId}
          clienteId={flutuante.clienteId}
          info={flutuante.info}
        />
      </div>
    </FloatingWindow>
  );
}
