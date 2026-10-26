import { createFileRoute } from "@tanstack/react-router";
import { assertModuloPermitido } from "@/lib/route-guards";
import { RelatorioGerencial } from "@/components/reports/eco/gerencial";

// Relatórios gerenciais do ecossistema (C47): filtro global na URL, números do banco já agregados.
export const Route = createFileRoute("/_authenticated/relatorios/gerencial")({
  beforeLoad: () => assertModuloPermitido("relatorios.geral"),
  head: () => ({ meta: [{ title: "Relatório gerencial — Agilliza" }] }),
  validateSearch: (s: Record<string, unknown>) => s,
  component: RelatorioGerencial,
});
