/**
 * Sinal de "chegou mensagem" para o menu (substitui o antigo chat-alert-store): o item do
 * chat pisca enquanto houver conversa não lida ou pedido de mensagem. Quem publica o número
 * é o aviso flutuante do chat universal (`chat.avisos`).
 */
import { useContadorChat } from "@/components/chat-universal/contador";

export function useChatFlash(): boolean {
  return useContadorChat() > 0;
}

/** O sinal acompanha as não lidas do banco: abrir o chat e ler é o que apaga. */
export function stopFlash(): void {}

/** Mantido para quem avisava "chegou algo" (retorno de proposta, demanda): o contador do chat já cobre. */
export function signalIncomingChat(..._qualquer: unknown[]): void {}
