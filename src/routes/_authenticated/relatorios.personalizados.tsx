import { createFileRoute } from "@tanstack/react-router";
import { assertModuloPermitido } from "@/lib/route-guards";
import { RelatoriosPersonalizados } from "@/components/reports/eco/personalizados";

// Relatórios gerenciais do ecossistema (C47): filtro global na URL, números do banco já agregados.
export const Route = createFileRoute("/_authenticated/relatorios/personalizados")({
  beforeLoad: () => assertModuloPermitido("relatorios.geral"),
  head: () => ({ meta: [{ title: "Relatórios personalizados — Agilliza" }] }),
  validateSearch: (s: Record<string, unknown>) => s,
  component: RelatoriosPersonalizados,
});
