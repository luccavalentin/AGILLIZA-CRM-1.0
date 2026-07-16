import { FloatingWindow } from "@/components/shared/pop-out-panel";
import {
  useFloatingChat,
  fecharChatFlutuante,
} from "@/components/shared/floating-chat-store";
import { ConversaMenuAcoesLive } from "@/components/shared/conversa-menu-acoes";
import { ChatClienteConversa } from "@/components/crm/chat-cliente-tab";
import { DemandaChatConversa } from "@/components/operacional/demanda-chat";
import { DmConversa } from "@/components/operacional/central-chat/dm-conversa";
import type { ReactNode } from "react";

function ChatComMenu({
  chatTipo,
  chatId,
  nomeReferencia,
  children,
}: {
  chatTipo: "dm" | "cliente" | "demanda";
  chatId: string;
  nomeReferencia: string | null;
  children: ReactNode;
}) {
  return (
    <div className="relative h-full min-h-0">
      <div className="absolute right-2 top-2 z-30">
        <ConversaMenuAcoesLive
          chatTipo={chatTipo}
          chatId={chatId}
          nomeReferencia={nomeReferencia}
          compact
        />
      </div>
      {children}
    </div>
  );
}

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
        <ChatComMenu
          chatTipo="demanda"
          chatId={flutuante.demandaId}
          nomeReferencia={
            flutuante.info?.interlocutorNome ??
            flutuante.info?.titulo ??
            flutuante.info?.numero ??
            null
          }
        >
          <div className="h-full min-h-[24rem]">
            <DemandaChatConversa
              key={flutuante.demandaId}
              demandaId={flutuante.demandaId}
              info={flutuante.info}
            />
          </div>
        </ChatComMenu>
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
        <ChatComMenu
          chatTipo="dm"
          chatId={flutuante.conversaId}
          nomeReferencia={flutuante.info?.nome ?? null}
        >
          <div className="h-full min-h-[24rem]">
            <DmConversa key={flutuante.conversaId} conversaId={flutuante.conversaId} />
          </div>
        </ChatComMenu>
      </FloatingWindow>
    );
  }

  return (
    <FloatingWindow
      title={`Conversa · ${flutuante.info?.nome ?? "Cliente"}`}
      onClose={fecharChatFlutuante}
      startMinimized={flutuante.minimized}
    >
      <ChatComMenu
        chatTipo="cliente"
        chatId={flutuante.clienteId}
        nomeReferencia={flutuante.info?.nome ?? null}
      >
        <div className="h-full min-h-[24rem]">
          <ChatClienteConversa
            key={flutuante.clienteId}
            clienteId={flutuante.clienteId}
            info={flutuante.info}
          />
        </div>
      </ChatComMenu>
    </FloatingWindow>
  );
}
