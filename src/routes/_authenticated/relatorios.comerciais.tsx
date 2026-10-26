import { createFileRoute } from "@tanstack/react-router";
import { assertModuloPermitido } from "@/lib/route-guards";
import { RelatorioComercial } from "@/components/reports/eco/comercial";

// Relatórios gerenciais do ecossistema (C47): filtro global na URL, números do banco já agregados.
export const Route = createFileRoute("/_authenticated/relatorios/comerciais")({
  beforeLoad: () => assertModuloPermitido("relatorios.geral"),
  head: () => ({ meta: [{ title: "Produção e comissões — Agilliza" }] }),
  validateSearch: (s: Record<string, unknown>) => s,
  component: RelatorioComercial,
});
