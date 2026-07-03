import { createFileRoute } from "@tanstack/react-router";
import { assertModuloPermitido } from "@/lib/route-guards";
import { ContasPage } from "@/components/financeiro/contas-page";

export const Route = createFileRoute("/_authenticated/financeiro/contas-a-receber")({
  head: () => ({ meta: [{ title: "Contas a receber — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("financeiro.contas_receber"),
  component: () => <ContasPage tipo="receber" />,
  errorComponent: () => (
    <div className="p-6 text-sm text-muted-foreground">Não foi possível carregar as contas.</div>
  ),
});
