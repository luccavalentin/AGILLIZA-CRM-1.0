import { createFileRoute } from "@tanstack/react-router";
import { ChatAgilliza } from "@/components/chat/chat-agilliza";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Chat do portal do cliente do correspondente (pedido de 26/10/2026): o mesmo chat
 * universal dos assinantes — a equipe do correspondente e o histórico do chat antigo — com
 * a pessoa identificada SÓ pela sessão do portal.
 */
export const Route = createFileRoute("/cliente/chat")({
  head: () => ({ meta: [{ title: "Conversar — Meu Financiamento" }] }),
  validateSearch: (s: Record<string, unknown>): { c?: string; pedidos?: "1" } => ({
    c: typeof s.c === "string" && UUID.test(s.c) ? s.c : undefined,
    pedidos: s.pedidos === "1" || s.pedidos === 1 ? "1" : undefined,
  }),
  component: ChatPage,
});

function ChatPage() {
  const { c, pedidos } = Route.useSearch();
  return <ChatAgilliza canal="cliente" inicial={c ?? null} pedidos={pedidos === "1"} />;
}
