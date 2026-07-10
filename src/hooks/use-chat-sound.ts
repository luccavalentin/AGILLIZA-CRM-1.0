import { useEffect, useRef } from "react";
import { signalIncomingChat } from "@/components/shared/chat-alert-store";

/**
 * Sinaliza a chegada de novas mensagens RECEBIDAS (não enviadas por mim):
 * toca o som característico (se habilitado) e faz o menu de chat piscar.
 * Ignora a carga inicial. A deduplicação por id (no store) evita alerta
 * duplicado quando o watcher global e esta tela veem a mesma mensagem.
 * Use em qualquer chat de qualquer portal.
 */
export function useIncomingChatSound(
  items: { id: string; mine: boolean }[] | undefined | null,
  conversaId?: string | null,
): void {
  const seen = useRef<Set<string> | null>(null);
  // Reseta o histórico de "vistas" ao trocar de conversa para não tocar som
  // (nem piscar) para mensagens antigas de outra conversa reaproveitada.
  useEffect(() => {
    seen.current = null;
  }, [conversaId]);
  useEffect(() => {
    if (!items) return;
    if (seen.current === null) {
      seen.current = new Set(items.map((i) => i.id));
      return;
    }
    for (const it of items) {
      if (!seen.current.has(it.id)) {
        seen.current.add(it.id);
        if (!it.mine) signalIncomingChat(it.id);
      }
    }
  }, [items]);
}
