import { createFileRoute } from "@tanstack/react-router";
import { ReportView, parseReportSearch } from "@/components/reports/report-view";

export const Route = createFileRoute("/_authenticated/relatorios/financeiros")({
  head: () => ({ meta: [{ title: "Relatório financeiro — Relatórios — Agilliza" }] }),
  validateSearch: (s: Record<string, unknown>) => s,
  component: Pagina,
});

function Pagina() {
  return <ReportView codigo="financeiros" />;
}
