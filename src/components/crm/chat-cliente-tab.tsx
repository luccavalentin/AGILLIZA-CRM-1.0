import { Maximize2 } from "lucide-react";
import {
  useFloatingChat,
  abrirChatFlutuante,
  fecharChatFlutuante,
} from "@/components/shared/floating-chat-store";
import {
  ChatConversaCore,
  useAdaptadorCliente,
} from "@/components/shared/chat-core";
import type { ChatClienteInfo } from "./chat-cliente/utils";

export type { ChatClienteInfo } from "./chat-cliente/utils";

/**
 * Corpo da conversa (cabeçalho, mensagens e composer), sem casca flutuante.
 *
 * Wrapper fino em torno de {@link ChatConversaCore}: apenas monta o
 * adaptador do chat do cliente (`cliente_app_mensagens`) e delega toda a
 * lógica ao núcleo compartilhado. Mantém a API pública original para os
 * consumidores existentes (`crm.chat`, ficha do cliente, central de chat,
 * janela flutuante).
 */
export function ChatClienteConversa({
  clienteId,
  info,
  atendenteId,
  somenteLeitura = false,
  atendenteNome,
  acoes,
}: {
  clienteId: string;
  info?: ChatClienteInfo;
  /** Thread do atendente exibido (para a visão supervisora de gestores). */
  atendenteId?: string;
  /** Quando true, a conversa é de outro atendente: só leitura. */
  somenteLeitura?: boolean;
  atendenteNome?: string;
  /** Ações extras (ex.: "Mais ações") renderizadas no cabeçalho da conversa. */
  acoes?: React.ReactNode;
}) {
  const adapter = useAdaptadorCliente({
    clienteId,
    atendenteId,
    info,
    somenteLeitura,
    atendenteNome,
    acoes,
  });
  return <ChatConversaCore adapter={adapter} />;
}

/**
 * Chat interno com o cliente. Permite "soltar" a conversa em uma janela
 * flutuante GLOBAL, que continua aberta ao navegar entre telas do sistema.
 */
export function ChatClienteTab({
  clienteId,
  info,
  atendenteId,
  somenteLeitura = false,
  atendenteNome,
  acoes,
}: {
  clienteId: string;
  info?: ChatClienteInfo;
  atendenteId?: string;
  somenteLeitura?: boolean;
  atendenteNome?: string;
  acoes?: React.ReactNode;
}) {
  const flutuante = useFloatingChat();
  const estaFlutuando = flutuante?.kind === "cliente" && flutuante.clienteId === clienteId;

  // A janela flutuante só vale para a conversa do próprio usuário.
  if (somenteLeitura) {
    return (
      <div className="h-full min-h-[24rem] min-w-0 overflow-hidden">
        <ChatClienteConversa
          clienteId={clienteId}
          info={info}
          atendenteId={atendenteId}
          somenteLeitura
          atendenteNome={atendenteNome}
        />
      </div>
    );
  }

  if (estaFlutuando) {
    return (
      <div className="flex h-full min-h-[24rem] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/70 bg-muted/20 p-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Maximize2 className="size-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Aberta em janela flutuante</p>
          <p className="text-xs text-muted-foreground">
            A conversa continua disponível mesmo ao trocar de tela.
          </p>
        </div>
        <button
          type="button"
          onClick={fecharChatFlutuante}
          className="rounded-md border border-border/60 bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
        >
          Reacoplar janela
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[24rem] min-w-0 overflow-hidden">
      <button
        type="button"
        onClick={() => abrirChatFlutuante(clienteId, info)}
        title="Soltar em janela flutuante"
        aria-label="Soltar em janela flutuante"
        className="absolute right-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <Maximize2 className="size-3.5" />
        <span className="hidden sm:inline">Soltar chat</span>
      </button>

      <ChatClienteConversa clienteId={clienteId} info={info} acoes={acoes} />
    </div>
  );
}
