import { useSyncExternalStore } from "react";

/**
 * Janela flutuante da conversa de uma DEMANDA. As do chat com o cliente e das mensagens
 * diretas saíram com o chat antigo (pedido de 26/10/2026, C14): o chat agora é o universal,
 * com o próprio aviso flutuante.
 */
export type FloatingChatState = {
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
};

let estado: FloatingChatState[] = [];
const ouvintes = new Set<() => void>();

function emitir() {
  for (const l of ouvintes) l();
}

/** Abre (ou troca) a conversa de uma demanda em janela flutuante global. */
export function abrirDemandaChatFlutuante(
  demandaId: string,
  info?: FloatingChatState["info"],
  opts?: { minimized?: boolean },
) {
  const existingIndex = estado.findIndex((c) => c.kind === "demanda" && c.demandaId === demandaId);
  const newItem: FloatingChatState = {
    kind: "demanda",
    demandaId,
    info,
    minimized: opts?.minimized,
  };

  if (existingIndex !== -1) {
    estado[existingIndex] = newItem;
  } else {
    estado = [...estado, newItem];
  }
  emitir();
}

/** Fecha a janela flutuante global. */
export function fecharChatFlutuante(kind: string, id: string) {
  estado = estado.filter((c) => {
    if (kind === "demanda") return c.demandaId !== id;
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

const snapshotVazio: FloatingChatState[] = [];
const getServerSnapshot = () => snapshotVazio;

/** Lista de janelas flutuantes ativas. */
export function useFloatingChats(): FloatingChatState[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
