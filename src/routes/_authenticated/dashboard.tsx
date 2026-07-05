import { createFileRoute } from "@tanstack/react-router";
import { PainelView } from "@/components/reports/painel-view";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Visão Geral — Agilliza" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <PainelView
      modulo="visao-geral"
      eyebrow="Visão geral · Dashboard"
      titulo="Produção comercial"
      descricao="Simulações, propostas e contratos atualizados com os dados reais do sistema."
      realtimeTabelas={["simulacoes", "propostas"]}
      abrirTo="/relatorios/consolidado"
    />
  );
}
