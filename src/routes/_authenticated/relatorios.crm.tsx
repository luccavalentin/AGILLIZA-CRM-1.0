import { createFileRoute } from "@tanstack/react-router";
import { ReportView } from "@/components/reports/report-view";

export const Route = createFileRoute("/_authenticated/relatorios/crm")({
  head: () => ({ meta: [{ title: "Relatório de CRM — Relatórios — Agilliza" }] }),
  validateSearch: (s: Record<string, unknown>) => s,
  component: Pagina,
});

function Pagina() {
  return <ReportView codigo="crm" />;
}
