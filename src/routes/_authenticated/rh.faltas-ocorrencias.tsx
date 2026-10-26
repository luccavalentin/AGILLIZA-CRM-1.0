import { createFileRoute, redirect } from "@tanstack/react-router";

// Faltas e ocorrências ficam na aba "Faltas e atestados" da Folha mensal.
export const Route = createFileRoute("/_authenticated/rh/faltas-ocorrencias")({
  beforeLoad: () => {
    throw redirect({ to: "/rh/folha", search: { aba: "ocorrencias" }, replace: true });
  },
});
