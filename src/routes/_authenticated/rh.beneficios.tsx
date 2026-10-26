import { createFileRoute, redirect } from "@tanstack/react-router";

// Benefícios (tipos e valores padrão) ficam em RH › Configurações; o vínculo por pessoa, na ficha.
export const Route = createFileRoute("/_authenticated/rh/beneficios")({
  beforeLoad: () => {
    throw redirect({ to: "/rh/configuracoes", search: { aba: "beneficios" }, replace: true });
  },
});
