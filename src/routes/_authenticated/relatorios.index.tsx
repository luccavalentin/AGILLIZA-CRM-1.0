import { createFileRoute, redirect } from "@tanstack/react-router";

// "Relatórios gerenciais": /relatorios abre direto o relatório gerencial.
export const Route = createFileRoute("/_authenticated/relatorios/")({
  beforeLoad: () => {
    throw redirect({ to: "/relatorios/gerencial" });
  },
});
