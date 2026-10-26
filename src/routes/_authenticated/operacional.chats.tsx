import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * O chat do Operacional duplicava o do CRM (pedido do dono, 26/10/2026): existe
 * um chat só. Este endereço antigo leva para ele.
 */
export const Route = createFileRoute("/_authenticated/operacional/chats")({
  beforeLoad: () => {
    throw redirect({ to: "/crm/chat", search: { c: undefined }, replace: true });
  },
});
