import { createFileRoute, redirect } from "@tanstack/react-router";

// A antiga "Central de relatórios" era apenas um índice de atalhos e não
// entregava dados. Foi removida: /relatorios abre direto o Painel geral.
export const Route = createFileRoute("/_authenticated/relatorios/")({
  beforeLoad: () => {
    throw redirect({ to: "/relatorios/painel-geral" });
  },
});
