import { FloatingWindow } from "@/components/shared/pop-out-panel";
import { useFloatingChats, fecharChatFlutuante } from "@/components/shared/floating-chat-store";
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
  const janelas = useFloatingChats();

  return (
    <>
      {janelas.map((flutuante, index) => {
        const key =
          flutuante.kind === "cliente"
            ? `cliente-${flutuante.clienteId}`
            : flutuante.kind === "demanda"
              ? `demanda-${flutuante.demandaId}`
              : `dm-${flutuante.conversaId}`;

        const onClose = () => {
          if (flutuante.kind === "cliente") fecharChatFlutuante("cliente", flutuante.clienteId);
          else if (flutuante.kind === "demanda")
            fecharChatFlutuante("demanda", flutuante.demandaId);
          else fecharChatFlutuante("dm", flutuante.conversaId);
        };

        // Offset positions slightly if there are multiple windows
        const offsetStyle =
          index > 0
            ? {
                transform: `translate(${index * 20}px, ${index * 20}px)`,
              }
            : undefined;

        if (flutuante.kind === "demanda") {
          return (
            <div key={key} style={offsetStyle}>
              <FloatingWindow
                title={`Demanda · ${flutuante.info?.interlocutorNome ?? flutuante.info?.numero ?? "Usuário"}`}
                onClose={onClose}
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
                    <DemandaChatConversa demandaId={flutuante.demandaId} info={flutuante.info} />
                  </div>
                </ChatComMenu>
              </FloatingWindow>
            </div>
          );
        }

        if (flutuante.kind === "dm") {
          return (
            <div key={key} style={offsetStyle}>
              <FloatingWindow
                title={`Mensagem · ${flutuante.info?.nome ?? "Colega"}`}
                onClose={onClose}
                startMinimized={flutuante.minimized}
              >
                <ChatComMenu
                  chatTipo="dm"
                  chatId={flutuante.conversaId}
                  nomeReferencia={flutuante.info?.nome ?? null}
                >
                  <div className="h-full min-h-[24rem]">
                    <DmConversa conversaId={flutuante.conversaId} />
                  </div>
                </ChatComMenu>
              </FloatingWindow>
            </div>
          );
        }

        return (
          <div key={key} style={offsetStyle}>
            <FloatingWindow
              title={`Conversa · ${flutuante.info?.nome ?? "Cliente"}`}
              onClose={onClose}
              startMinimized={flutuante.minimized}
            >
              <ChatComMenu
                chatTipo="cliente"
                chatId={flutuante.clienteId}
                nomeReferencia={flutuante.info?.nome ?? null}
              >
                <div className="h-full min-h-[24rem]">
                  <ChatClienteConversa clienteId={flutuante.clienteId} info={flutuante.info} />
                </div>
              </ChatComMenu>
            </FloatingWindow>
          </div>
        );
      })}
    </>
  );
}
