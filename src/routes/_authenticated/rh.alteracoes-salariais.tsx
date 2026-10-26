import { createFileRoute, redirect } from "@tanstack/react-router";

// Alteração salarial é feita na ficha do colaborador (aba Remuneração), com RH · Salários.
export const Route = createFileRoute("/_authenticated/rh/alteracoes-salariais")({
  beforeLoad: () => {
    throw redirect({ to: "/rh/funcionarios", search: {}, replace: true });
  },
});
