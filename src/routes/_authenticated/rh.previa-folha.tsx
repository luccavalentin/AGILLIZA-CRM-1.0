import { createFileRoute, redirect } from "@tanstack/react-router";

// A prévia virou a aba "Prévia e fechamento" da Folha mensal (pedido de 26/10/2026).
export const Route = createFileRoute("/_authenticated/rh/previa-folha")({
  beforeLoad: () => {
    throw redirect({ to: "/rh/folha", search: { aba: "previa" }, replace: true });
  },
});
