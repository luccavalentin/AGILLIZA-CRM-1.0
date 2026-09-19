import { createFileRoute, redirect } from "@tanstack/react-router";
import { assertModuloPermitido } from "@/lib/route-guards";

// "Relatórios gerenciais": /relatorios abre direto o relatório gerencial.
export const Route = createFileRoute("/_authenticated/relatorios/")({
  // Sem permissão de relatórios, a URL direta levava à tela mesmo com o
  // item escondido no menu (QA 19/09/2026).
  beforeLoad: () => assertModuloPermitido("relatorios.geral"),
  beforeLoad: () => {
    throw redirect({ to: "/relatorios/gerencial" });
  },
});
