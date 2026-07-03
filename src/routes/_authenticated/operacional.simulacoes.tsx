import { createFileRoute } from "@tanstack/react-router";
import { Calculator } from "lucide-react";
import { ModuloPlaceholder } from "@/components/app-shell/modulo-placeholder";
import { assertModuloPermitido } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/operacional/simulacoes")({
  head: () => ({ meta: [{ title: "Simulações — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.simulacoes"),
  component: Pagina,
});

function Pagina() {
  return (
    <ModuloPlaceholder icon={Calculator} titulo="Simulações" descricao="Simulações de crédito imobiliário e home equity." />
  );
}
