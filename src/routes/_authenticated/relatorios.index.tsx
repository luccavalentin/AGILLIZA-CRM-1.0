import { createFileRoute, redirect } from "@tanstack/react-router";
import { assertModuloPermitido } from "@/lib/route-guards";

// "Relatórios gerenciais": /relatorios abre direto o relatório gerencial.
export const Route = createFileRoute("/_authenticated/relatorios/")({
  // Sem permissão de relatórios, a URL direta levava à tela mesmo com o
  // item escondido no menu (QA 19/09/2026).
  beforeLoad: async () => {
    // Sem o await, o redirecionamento por falta de permissão virava uma
    // promessa rejeitada solta (só o layout pai segurava).
    await assertModuloPermitido("relatorios.geral");
    throw redirect({ to: "/relatorios/gerencial" });
  },
});
