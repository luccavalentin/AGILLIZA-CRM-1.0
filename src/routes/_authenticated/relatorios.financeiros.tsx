import { createFileRoute } from "@tanstack/react-router";
import { assertModuloPermitido } from "@/lib/route-guards";
import { RelatorioFinanceiro } from "@/components/reports/eco/financeiro";

// Relatórios gerenciais do ecossistema (C47): filtro global na URL, números do banco já agregados.
export const Route = createFileRoute("/_authenticated/relatorios/financeiros")({
  beforeLoad: () => assertModuloPermitido("relatorios.geral"),
  head: () => ({ meta: [{ title: "Relatório financeiro — Agilliza" }] }),
  validateSearch: (s: Record<string, unknown>) => s,
  component: RelatorioFinanceiro,
});
