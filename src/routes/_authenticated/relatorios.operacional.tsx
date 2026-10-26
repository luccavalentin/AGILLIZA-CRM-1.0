import { createFileRoute } from "@tanstack/react-router";
import { assertModuloPermitido } from "@/lib/route-guards";
import { RelatoriosOperacionais } from "@/components/reports/eco/operacional";

// Relatórios gerenciais do ecossistema (C47): filtro global na URL, números do banco já agregados.
export const Route = createFileRoute("/_authenticated/relatorios/operacional")({
  beforeLoad: () => assertModuloPermitido("relatorios.geral"),
  head: () => ({ meta: [{ title: "Relatórios operacionais — Agilliza" }] }),
  validateSearch: (s: Record<string, unknown>) => s,
  component: RelatoriosOperacionais,
});
