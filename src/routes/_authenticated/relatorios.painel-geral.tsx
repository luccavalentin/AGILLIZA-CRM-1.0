import { createFileRoute } from "@tanstack/react-router";
import { ReportView } from "@/components/reports/report-view";

export const Route = createFileRoute("/_authenticated/relatorios/painel-geral")({
  head: () => ({ meta: [{ title: "Painel geral — Relatórios — Agilliza" }] }),
  validateSearch: (s: Record<string, unknown>) => s,
  component: Pagina,
});

function Pagina() {
  return <ReportView codigo="painel-geral" comFiltroBanco comFiltroStatus />;
}
