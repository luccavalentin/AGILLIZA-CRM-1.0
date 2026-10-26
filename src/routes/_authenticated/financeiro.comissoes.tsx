import { createFileRoute, redirect } from "@tanstack/react-router";

// "Repasses" antigo listava as comissões dos bancos: agora é a tela própria (frente a5).
export const Route = createFileRoute("/_authenticated/financeiro/comissoes")({
  beforeLoad: () => {
    throw redirect({ to: "/financeiro/comissoes-bancos" });
  },
});
