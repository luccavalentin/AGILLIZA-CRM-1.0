import { useSyncExternalStore } from "react";
import type { ChatClienteInfo } from "@/components/crm/chat-cliente-tab";

export interface FloatingChatState {
  clienteId: string;
  info?: ChatClienteInfo;
}

let estado: FloatingChatState | null = null;
const ouvintes = new Set<() => void>();

function emitir() {
  for (const l of ouvintes) l();
}

/** Abre (ou troca) a conversa do cliente em janela flutuante global. */
export function abrirChatFlutuante(clienteId: string, info?: ChatClienteInfo) {
  estado = { clienteId, info };
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
