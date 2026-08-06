// Store global do "alerta de chat": faz o item de menu do chat piscar quando
// chega uma nova mensagem recebida, em qualquer tela. Usa useSyncExternalStore
// para persistir fora da árvore de qualquer rota.

import { useSyncExternalStore } from "react";
import { playChatSound } from "@/lib/chat-sound";
import { tipoAtivo, tipoComSom } from "@/lib/notification-prefs";

let flashing = false;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
// IDs de mensagens já sinalizadas — evita som/pisca duplicado quando o watcher
// global e o hook da tela de chat veem a mesma mensagem.
const vistas = new Set<string>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Pede permissão de notificação do navegador (silencioso se já decidido). */
export function pedirPermissaoNotificacao(): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  try {
    if (Notification.permission === "default") void Notification.requestPermission();
  } catch {
    /* ignore */
  }
}

/** Exibe uma notificação do sistema operacional (se permitido). */
function notificarSO(titulo: string, corpo?: string): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  try {
    if (Notification.permission !== "granted") return;
    const n = new Notification(titulo, { body: corpo, tag: "agilliza-chat" });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* ignore */
  }
}

/** Sinaliza a chegada de UMA mensagem de chat recebida (deduplicada por id). */
export function signalIncomingChat(
  id: string,
  info?: { titulo?: string; corpo?: string; skipSound?: boolean },
): void {
  if (vistas.has(id)) return;
  vistas.add(id);
  // Evita crescer indefinidamente.
  if (vistas.size > 500) {
    vistas.clear();
    vistas.add(id);
  }
  // Removida a verificação tipoAtivo("chat") para garantir recebimento universal
  // Requisito: TODA NOTIFICAÇÃO DEVE EMITIR SOM (chat e outras)
  if (!info?.skipSound) playChatSound();
  notificarSO(info?.titulo ?? "Nova mensagem", info?.corpo);
  startFlash();
}

/** Liga o efeito de "piscar" no menu por alguns segundos. */
export function startFlash(): void {
  flashing = true;
  emit();
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    flashing = false;
    timer = null;
    emit();
  }, 10_000);
}

/** Interrompe o efeito (ex.: usuário abriu a tela de chat). */
export function stopFlash(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  if (flashing) {
    flashing = false;
    emit();
  }
}

/** Hook: verdadeiro enquanto o menu de chat deve piscar. */
export function useChatFlash(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => flashing,
    () => false,
  );
}
