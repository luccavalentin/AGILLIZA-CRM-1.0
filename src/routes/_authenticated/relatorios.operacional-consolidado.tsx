import { createFileRoute } from "@tanstack/react-router";
import { ReportView } from "@/components/reports/report-view";

export const Route = createFileRoute("/_authenticated/relatorios/operacional-consolidado")({
  head: () => ({ meta: [{ title: "Relatório operacional consolidado — Relatórios — Agilliza" }] }),
  validateSearch: (s: Record<string, unknown>) => s,
  component: () => (
    <ReportView codigo="operacional-consolidado" comFiltroStatus={false} comFiltroBanco={false} />
  ),
});
