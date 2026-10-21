import { Maximize2 } from "lucide-react";
import {
  useFloatingChats,
  abrirChatFlutuante,
  fecharChatFlutuante,
} from "@/components/shared/floating-chat-store";
import { ChatConversaCore, useAdaptadorCliente } from "@/components/shared/chat-core";
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
  // Na janela flutuante a thread vem em `info` (o estado flutuante só guarda cliente + info).
  const adapter = useAdaptadorCliente({
    clienteId,
    atendenteId: atendenteId ?? info?.atendenteId,
    info,
    somenteLeitura,
    atendenteNome: atendenteNome ?? info?.atendenteNome,
    acoes,
  });
  return <ChatConversaCore adapter={adapter} />;
}

/**
 * Chat interno com o cliente. Permite "soltar" a conversa em uma janela
 * flutuante GLOBAL, que continua aberta ao navegar entre telas do sistema.
 * Usado no Chat do CRM e na ficha do cliente (único lugar com o botão "Soltar chat").
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
  const janelas = useFloatingChats();
  const estaFlutuando = janelas.some((c) => c.kind === "cliente" && c.clienteId === clienteId);

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
          onClick={() => fecharChatFlutuante("cliente", clienteId)}
          className="rounded-md border border-border/60 bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
        >
          Reacoplar janela
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[24rem] min-w-0 overflow-hidden">
      {/* "Soltar chat" vai no cabeçalho da conversa (antes ficava por cima dos botões dele). */}
      <ChatClienteConversa
        clienteId={clienteId}
        info={info}
        atendenteId={atendenteId}
        atendenteNome={atendenteNome}
        acoes={
          <>
            <button
              type="button"
              onClick={() =>
                abrirChatFlutuante(clienteId, {
                  nome: info?.nome ?? "Cliente",
                  ...info,
                  // Sem isto a janela abria a thread do próprio usuário, e não a que
                  // estava na tela (participante, visão supervisora).
                  atendenteId: atendenteId ?? info?.atendenteId,
                  atendenteNome: atendenteNome ?? info?.atendenteNome,
                })
              }
              title="Soltar em janela flutuante"
              aria-label="Soltar em janela flutuante"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <Maximize2 className="size-3.5" />
              <span className="hidden sm:inline">Soltar chat</span>
            </button>
            {acoes}
          </>
        }
      />
    </div>
  );
}
