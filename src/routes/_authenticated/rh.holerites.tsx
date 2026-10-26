import { createFileRoute, redirect } from "@tanstack/react-router";

// Holerites agora são gerados e publicados na Folha mensal, depois do fechamento.
export const Route = createFileRoute("/_authenticated/rh/holerites")({
  beforeLoad: () => {
    throw redirect({ to: "/rh/folha", search: { aba: "holerites" }, replace: true });
  },
});
