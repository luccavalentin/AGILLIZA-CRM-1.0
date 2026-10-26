import { createFileRoute } from "@tanstack/react-router";
import { assertModuloPermitido } from "@/lib/route-guards";
import { ChatAgilliza } from "@/components/chat/chat-agilliza";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Chat do correspondente (pedido do dono, 26/10/2026 — C14): o fluxo antigo foi apagado e
 * esta é a MESMA tela do chat dos assinantes do Agilliza Tech, no mesmo backend. Contatos:
 * a equipe, os clientes, os parceiros/vinculados e os assinantes; fora da base, pelo @.
 *
 * `?c=` abre uma conversa; `?cliente=` (vindo da ficha do cliente) abre a conversa com ele;
 * `?pedidos=1` abre os pedidos de mensagem.
 */
export const Route = createFileRoute("/_authenticated/crm/chat")({
  head: () => ({ meta: [{ title: "Chat — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("crm.chat"),
  validateSearch: (s: Record<string, unknown>): { c?: string; cliente?: string; pedidos?: "1" } => ({
    c: typeof s.c === "string" && UUID.test(s.c) ? s.c : undefined,
    cliente: typeof s.cliente === "string" && UUID.test(s.cliente) ? s.cliente : undefined,
    pedidos: s.pedidos === "1" || s.pedidos === 1 ? "1" : undefined,
  }),
  component: Pagina,
});

function Pagina() {
  const { c, cliente, pedidos } = Route.useSearch();
  return <ChatAgilliza canal="equipe" inicial={c ?? null} clienteAgillizaId={cliente ?? null} pedidos={pedidos === "1"} />;
}
