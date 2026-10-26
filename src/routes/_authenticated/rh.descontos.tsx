import { createFileRoute, redirect } from "@tanstack/react-router";

// Descontos viraram lançamentos da competência (rh_lancamentos) na Folha mensal.
export const Route = createFileRoute("/_authenticated/rh/descontos")({
  beforeLoad: () => {
    throw redirect({ to: "/rh/folha", search: { aba: "lancamentos" }, replace: true });
  },
});
