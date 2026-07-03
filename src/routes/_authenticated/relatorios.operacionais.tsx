import { createFileRoute } from "@tanstack/react-router";
import { ReportView } from "@/components/reports/report-view";

export const Route = createFileRoute("/_authenticated/relatorios/operacionais")({
  head: () => ({ meta: [{ title: "Relatório operacional — Relatórios — Agilliza" }] }),
  validateSearch: (s: Record<string, unknown>) => s,
  component: Pagina,
});

function Pagina() {
  return <ReportView codigo="operacionais" comFiltroBanco comFiltroStatus />;
}
