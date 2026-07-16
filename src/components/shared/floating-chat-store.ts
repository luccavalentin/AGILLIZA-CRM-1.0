import { useSyncExternalStore } from "react";
import type { ChatClienteInfo } from "@/components/crm/chat-cliente-tab";

export type FloatingChatState =
  | {
      kind: "cliente";
      clienteId: string;
      info?: ChatClienteInfo;
    }
  | {
      kind: "demanda";
      demandaId: string;
      info?: {
        numero?: string | null;
        titulo?: string | null;
        statusLabel?: string | null;
      };
    };

let estado: FloatingChatState | null = null;
const ouvintes = new Set<() => void>();

function emitir() {
  for (const l of ouvintes) l();
}

/** Abre (ou troca) a conversa do cliente em janela flutuante global. */
export function abrirChatFlutuante(clienteId: string, info?: ChatClienteInfo) {
  estado = { kind: "cliente", clienteId, info };
  emitir();
}

/** Abre (ou troca) a conversa de uma demanda em janela flutuante global. */
export function abrirDemandaChatFlutuante(
  demandaId: string,
  info?: Extract<FloatingChatState, { kind: "demanda" }>["info"],
) {
  estado = { kind: "demanda", demandaId, info };
  emitir();
}

/** Fecha a janela flutuante global. */
export function fecharChatFlutuante() {
  estado = null;
  emitir();
}

function subscribe(cb: () => void) {
  ouvintes.add(cb);
  return () => {
    ouvintes.delete(cb);
  };
}

function getSnapshot() {
  return estado;
}

/** Estado atual da janela flutuante global (ou null). */
export function useFloatingChat(): FloatingChatState | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
