import { createFileRoute, redirect } from "@tanstack/react-router";

// Atestados e faltas ficam na aba "Faltas e atestados" da Folha mensal.
export const Route = createFileRoute("/_authenticated/rh/atestados")({
  beforeLoad: () => {
    throw redirect({ to: "/rh/folha", search: { aba: "ocorrencias" }, replace: true });
  },
});
