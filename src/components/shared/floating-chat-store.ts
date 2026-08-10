import { useSyncExternalStore } from "react";
import type { ChatClienteInfo } from "@/components/crm/chat-cliente-tab";

export type FloatingChatState =
  | {
      kind: "cliente";
      clienteId: string;
      info?: ChatClienteInfo;
      minimized?: boolean;
    }
  | {
      kind: "demanda";
      demandaId: string;
      info?: {
        numero?: string | null;
        titulo?: string | null;
        statusLabel?: string | null;
        interlocutorNome?: string | null;
        interlocutorFoto?: string | null;
      };
      minimized?: boolean;
    }
  | {
      kind: "dm";
      conversaId: string;
      info?: { nome?: string | null };
      minimized?: boolean;
    };

let estado: FloatingChatState[] = [];
const ouvintes = new Set<() => void>();

function emitir() {
  for (const l of ouvintes) l();
}

/** Abre (ou troca) a conversa do cliente em janela flutuante global. */
export function abrirChatFlutuante(
  clienteId: string,
  info?: ChatClienteInfo,
  opts?: { minimized?: boolean },
) {
  const existingIndex = estado.findIndex(c => c.kind === "cliente" && c.clienteId === clienteId);
  const newItem: FloatingChatState = { kind: "cliente", clienteId, info, minimized: opts?.minimized };
  
  if (existingIndex !== -1) {
    estado[existingIndex] = newItem;
  } else {
    estado = [...estado, newItem];
  }
  emitir();
}

/** Abre (ou troca) a conversa de uma demanda em janela flutuante global. */
export function abrirDemandaChatFlutuante(
  demandaId: string,
  info?: Extract<FloatingChatState, { kind: "demanda" }>["info"],
  opts?: { minimized?: boolean },
) {
  const existingIndex = estado.findIndex(c => c.kind === "demanda" && c.demandaId === demandaId);
  const newItem: FloatingChatState = { kind: "demanda", demandaId, info, minimized: opts?.minimized };

  if (existingIndex !== -1) {
    estado[existingIndex] = newItem;
  } else {
    estado = [...estado, newItem];
  }
  emitir();
}

/** Abre (ou troca) uma mensagem direta (DM) em janela flutuante global. */
export function abrirDmFlutuante(
  conversaId: string,
  info?: Extract<FloatingChatState, { kind: "dm" }>["info"],
  opts?: { minimized?: boolean },
) {
  const existingIndex = estado.findIndex(c => c.kind === "dm" && c.conversaId === conversaId);
  const newItem: FloatingChatState = { kind: "dm", conversaId, info, minimized: opts?.minimized };

  if (existingIndex !== -1) {
    estado[existingIndex] = newItem;
  } else {
    estado = [...estado, newItem];
  }
  emitir();
}

/** Fecha a janela flutuante global. */
export function fecharChatFlutuante(kind: string, id: string) {
  estado = estado.filter(c => {
    if (c.kind === "cliente" && kind === "cliente") return c.clienteId !== id;
    if (c.kind === "demanda" && kind === "demanda") return c.demandaId !== id;
    if (c.kind === "dm" && kind === "dm") return c.conversaId !== id;
    return true;
  });
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

/** Lista de janelas flutuantes ativas. */
export function useFloatingChats(): FloatingChatState[] {
  return useSyncExternalStore(subscribe, getSnapshot, () => []);
}
