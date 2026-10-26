"use client";

/**
 * Contador do ícone do chat no menu (conversas não lidas + pedidos de mensagem). Quem
 * publica é o aviso flutuante (que já consulta `chat.avisos`); quem lê é o menu.
 */
import { useSyncExternalStore } from "react";

let valor = 0;
const ouvintes = new Set<() => void>();

export function publicarContadorChat(n: number) {
  const novo = Math.max(0, Math.floor(n || 0));
  if (novo === valor) return;
  valor = novo;
  for (const o of ouvintes) o();
}

const assinar = (o: () => void) => {
  ouvintes.add(o);
  return () => {
    ouvintes.delete(o);
  };
};

export function useContadorChat(): number {
  return useSyncExternalStore(
    assinar,
    () => valor,
    () => 0,
  );
}
