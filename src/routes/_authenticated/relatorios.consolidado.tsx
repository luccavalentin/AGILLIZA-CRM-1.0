import { createFileRoute } from "@tanstack/react-router";
import { ReportView } from "@/components/reports/report-view";

export const Route = createFileRoute("/_authenticated/relatorios/consolidado")({
  head: () => ({ meta: [{ title: "Consolidado — Relatórios — Agilliza" }] }),
  validateSearch: (s: Record<string, unknown>) => s,
  component: Pagina,
});

function Pagina() {
  return <ReportView codigo="consolidado" comFiltroBanco comFiltroStatus />;
}
