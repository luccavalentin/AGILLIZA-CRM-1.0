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

/** Sinaliza a chegada de UMA mensagem de chat recebida (deduplicada por id). */
export function signalIncomingChat(id: string): void {
  if (vistas.has(id)) return;
  vistas.add(id);
  // Evita crescer indefinidamente.
  if (vistas.size > 500) {
    vistas.clear();
    vistas.add(id);
  }
  if (!tipoAtivo("chat")) return;
  if (tipoComSom("chat")) playChatSound();
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
