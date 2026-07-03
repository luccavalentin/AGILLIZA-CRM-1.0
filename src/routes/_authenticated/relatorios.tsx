import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { ModuloPlaceholder } from "@/components/app-shell/modulo-placeholder";
import { assertModuloPermitido } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("relatorios.geral"),
  component: Pagina,
});

function Pagina() {
  return (
    <ModuloPlaceholder icon={BarChart3} titulo="Relatórios" descricao="Indicadores e relatórios gerenciais." />
  );
}
