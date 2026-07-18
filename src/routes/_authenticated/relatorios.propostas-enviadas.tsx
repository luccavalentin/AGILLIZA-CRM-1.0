import { createFileRoute } from "@tanstack/react-router";
import { ReportView } from "@/components/reports/report-view";

export const Route = createFileRoute("/_authenticated/relatorios/propostas-enviadas")({
  head: () => ({ meta: [{ title: "Propostas enviadas — Relatórios — Agilliza" }] }),
  validateSearch: (s: Record<string, unknown>) => s,
  component: () => <ReportView codigo="propostas-enviadas" comFiltroBanco />,
});
