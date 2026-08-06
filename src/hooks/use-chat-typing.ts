import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Papel = string;

/**
 * Indicador de "está digitando…" bidirecional via Supabase Realtime broadcast.
 *
 * Ambos os lados entram no mesmo canal (`chat-typing:{clienteId}`) e emitem
 * eventos efêmeros de digitação. Broadcast não depende de RLS nem de sessão
 * autenticada — funciona com a chave publishable (anon).
 *
 * @param clienteId  Identificador da conversa (id do cliente).
 * @param papel      Quem está usando o hook ("time" ou "cliente").
 * @param enabled    Desliga o canal quando falso (ex.: janela minimizada).
 */
export function useChatTyping(
  clienteId: string | null | undefined,
  papel: Papel,
  enabled = true,
) {
  const [peerTyping, setPeerTyping] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const enviadoRef = useRef(0);
  const limparPeerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!clienteId || !enabled) {
      setPeerTyping(false);
      return;
    }
    const canal = supabase.channel(`chat-typing:${clienteId}`, {
      config: { broadcast: { self: false } },
    });
    canal
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (!payload || payload.papel === papel) return;
        setPeerTyping(true);
        if (limparPeerRef.current) clearTimeout(limparPeerRef.current);
        limparPeerRef.current = setTimeout(() => setPeerTyping(false), 3500);
      })
      .on("broadcast", { event: "stop" }, ({ payload }) => {
        if (!payload || payload.papel === papel) return;
        if (limparPeerRef.current) clearTimeout(limparPeerRef.current);
        setPeerTyping(false);
      })
      .subscribe();
    channelRef.current = canal;

    return () => {
      if (limparPeerRef.current) clearTimeout(limparPeerRef.current);
      supabase.removeChannel(canal);
      channelRef.current = null;
      setPeerTyping(false);
    };
  }, [clienteId, papel, enabled]);

  /** Sinaliza que este lado está digitando (throttle de ~1,5s). */
  const notifyTyping = useCallback(() => {
    const canal = channelRef.current;
    if (!canal) return;
    const agora = Date.now();
    if (agora - enviadoRef.current < 1500) return;
    enviadoRef.current = agora;
    canal.send({ type: "broadcast", event: "typing", payload: { papel } });
  }, [papel]);

  /** Sinaliza que este lado parou de digitar (ex.: ao enviar). */
  const notifyStop = useCallback(() => {
    const canal = channelRef.current;
    if (!canal) return;
    enviadoRef.current = 0;
    canal.send({ type: "broadcast", event: "stop", payload: { papel } });
  }, [papel]);

  return { peerTyping, notifyTyping, notifyStop };
}
