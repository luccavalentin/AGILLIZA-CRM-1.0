import { useEffect, useRef } from "react";
import { playChatSound } from "@/lib/chat-sound";

/**
 * Toca o som característico de chat quando uma nova mensagem RECEBIDA
 * (não enviada por mim) aparece na lista. Ignora a carga inicial.
 * Use em qualquer chat de qualquer portal.
 */
export function useIncomingChatSound(
  items: { id: string; mine: boolean }[] | undefined | null,
): void {
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!items) return;
    if (seen.current === null) {
      seen.current = new Set(items.map((i) => i.id));
      return;
    }
    let recebeuNova = false;
    for (const it of items) {
      if (!seen.current.has(it.id)) {
        seen.current.add(it.id);
        if (!it.mine) recebeuNova = true;
      }
    }
    if (recebeuNova) playChatSound();
  }, [items]);
}
