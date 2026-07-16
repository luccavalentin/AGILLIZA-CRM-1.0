import { FloatingWindow } from "@/components/shared/pop-out-panel";
import {
  useFloatingChat,
  fecharChatFlutuante,
} from "@/components/shared/floating-chat-store";
import { ChatClienteConversa } from "@/components/crm/chat-cliente-tab";
import { DemandaChatConversa } from "@/components/operacional/demanda-chat";
import { DmConversa } from "@/components/operacional/central-chat/dm-conversa";

/**
 * Host global da conversa flutuante. Fica montado no layout raiz, então a
 * janela permanece aberta ao navegar entre telas do sistema.
 */
export function FloatingChatHost() {
  const flutuante = useFloatingChat();
  if (!flutuante) return null;

  if (flutuante.kind === "demanda") {
    return (
      <FloatingWindow
        title={`Demanda · ${flutuante.info?.interlocutorNome ?? flutuante.info?.numero ?? "Usuário"}`}
        onClose={fecharChatFlutuante}
        startMinimized={flutuante.minimized}
      >
        <div className="h-full min-h-[24rem]">
          <DemandaChatConversa
            key={flutuante.demandaId}
            demandaId={flutuante.demandaId}
            info={flutuante.info}
          />
        </div>
      </FloatingWindow>
    );
  }

  if (flutuante.kind === "dm") {
    return (
      <FloatingWindow
        title={`Mensagem · ${flutuante.info?.nome ?? "Colega"}`}
        onClose={fecharChatFlutuante}
        startMinimized={flutuante.minimized}
      >
        <div className="h-full min-h-[24rem]">
          <DmConversa key={flutuante.conversaId} conversaId={flutuante.conversaId} />
        </div>
      </FloatingWindow>
    );
  }

  return (
    <FloatingWindow
      title={`Conversa · ${flutuante.info?.nome ?? "Cliente"}`}
      onClose={fecharChatFlutuante}
      startMinimized={flutuante.minimized}
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
