import { createFileRoute, redirect } from "@tanstack/react-router";

// "Comissões (usuários)" virou "Corretores e parceiros" (frente a5).
export const Route = createFileRoute("/_authenticated/financeiro/comissoes-usuario")({
  beforeLoad: () => {
    throw redirect({ to: "/financeiro/comissoes-corretores" });
  },
});
