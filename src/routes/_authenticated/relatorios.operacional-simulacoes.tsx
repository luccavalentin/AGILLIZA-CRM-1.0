import { createFileRoute } from "@tanstack/react-router";
import { ReportView } from "@/components/reports/report-view";

export const Route = createFileRoute("/_authenticated/relatorios/operacional-simulacoes")({
  head: () => ({ meta: [{ title: "Relatório operacional de simulações — Relatórios — Agilliza" }] }),
  validateSearch: (s: Record<string, unknown>) => s,
  component: Pagina,
});

function Pagina() {
  return <ReportView codigo="operacional-simulacoes" comFiltroStatus={false} comFiltroBanco={false} />;
}
