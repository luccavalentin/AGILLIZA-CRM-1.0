import { createFileRoute, redirect } from "@tanstack/react-router";
import { assertModuloPermitido } from "@/lib/route-guards";

// O consolidado virou o relatório gerencial do ecossistema (C47, 26/10/2026): endereço antigo leva ao relatório novo, com o filtro de período.
export const Route = createFileRoute("/_authenticated/relatorios/consolidado")({
  beforeLoad: async ({ search }) => {
    await assertModuloPermitido("relatorios.geral");
    const s = search as Record<string, unknown>;
    const periodo = s.de && s.ate ? { periodo: "custom", de: String(s.de), ate: String(s.ate) } : {};
    throw redirect({ to: "/relatorios/gerencial", search: periodo as never, replace: true });
  },
});
