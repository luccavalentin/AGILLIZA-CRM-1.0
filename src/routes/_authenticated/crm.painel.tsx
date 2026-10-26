import { createFileRoute, redirect } from "@tanstack/react-router";

/** A Esteira saiu do correspondente (pedido do dono, 26/10/2026); o endereço leva aos clientes. */
export const Route = createFileRoute("/_authenticated/crm/painel")({
  beforeLoad: () => {
    throw redirect({ to: "/crm/clientes", replace: true });
  },
});
