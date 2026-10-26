import { FloatingWindow } from "@/components/shared/pop-out-panel";
import { useFloatingChats, fecharChatFlutuante } from "@/components/shared/floating-chat-store";
import { ConversaMenuAcoesLive } from "@/components/shared/conversa-menu-acoes";
import { DemandaChatConversa } from "@/components/operacional/demanda-chat";

/**
 * Host global da conversa flutuante das DEMANDAS. Fica montado no layout raiz, então a
 * janela permanece aberta ao navegar entre telas do sistema. (O chat com clientes, parceiros
 * e assinantes é o chat universal, com o aviso flutuante próprio — 26/10/2026, C14.)
 */
export function FloatingChatHost() {
  const janelas = useFloatingChats();

  return (
    <>
      {janelas.map((flutuante, index) => {
        const offsetStyle =
          index > 0 ? { transform: `translate(${index * 20}px, ${index * 20}px)` } : undefined;
        return (
          <div key={`demanda-${flutuante.demandaId}`} style={offsetStyle}>
            <FloatingWindow
              title={`Demanda · ${flutuante.info?.interlocutorNome ?? flutuante.info?.numero ?? "Usuário"}`}
              onClose={() => fecharChatFlutuante("demanda", flutuante.demandaId)}
              startMinimized={flutuante.minimized}
            >
              <div className="relative h-full min-h-0">
                <div className="absolute right-2 top-2 z-30">
                  <ConversaMenuAcoesLive
                    chatTipo="demanda"
                    chatId={flutuante.demandaId}
                    nomeReferencia={
                      flutuante.info?.interlocutorNome ??
                      flutuante.info?.titulo ??
                      flutuante.info?.numero ??
                      null
                    }
                    compact
                  />
                </div>
                <div className="h-full min-h-[24rem]">
                  <DemandaChatConversa demandaId={flutuante.demandaId} info={flutuante.info} />
                </div>
              </div>
            </FloatingWindow>
          </div>
        );
      })}
    </>
  );
}
