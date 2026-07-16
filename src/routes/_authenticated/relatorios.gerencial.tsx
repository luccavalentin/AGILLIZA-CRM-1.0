import { createFileRoute } from "@tanstack/react-router";
import { ReportView } from "@/components/reports/report-view";

export const Route = createFileRoute("/_authenticated/relatorios/gerencial")({
  head: () => ({ meta: [{ title: "Relatório gerencial de operações — Agilliza" }] }),
  validateSearch: (s: Record<string, unknown>) => s,
  component: Pagina,
});

function Pagina() {
  return <ReportView codigo="gerencial" comFiltroBanco comFiltroStatus />;
}
