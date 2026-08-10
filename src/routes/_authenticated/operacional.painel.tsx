import { createFileRoute } from "@tanstack/react-router";
import { assertModuloPermitido } from "@/lib/route-guards";
import { PainelView } from "@/components/reports/painel-view";

export const Route = createFileRoute("/_authenticated/operacional/painel")({
  head: () => ({ meta: [{ title: "Painel — Operacional — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.propostas"),
  component: Pagina,
});

function Pagina() {
  return (
    <PainelView
      modulo="operacional"
      eyebrow="Operacional · Painel"
      titulo="Execução operacional"
      descricao="Como está a execução de propostas, demandas e tarefas."
      realtimeTabelas={["propostas", "simulacoes", "demandas", "tasks", "clientes"]}
      abrirTo="/relatorios/operacionais"
    />
  );
}
