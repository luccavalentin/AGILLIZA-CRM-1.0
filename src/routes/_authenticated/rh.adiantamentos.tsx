import { createFileRoute, redirect } from "@tanstack/react-router";

// Adiantamentos entram pela aba Lançamentos da Folha mensal.
export const Route = createFileRoute("/_authenticated/rh/adiantamentos")({
  beforeLoad: () => {
    throw redirect({ to: "/rh/folha", search: { aba: "lancamentos" }, replace: true });
  },
});
