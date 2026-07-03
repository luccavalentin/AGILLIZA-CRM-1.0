import { createFileRoute } from "@tanstack/react-router";
import { Percent } from "lucide-react";
import { ModuloPlaceholder } from "@/components/app-shell/modulo-placeholder";
import { assertModuloPermitido } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/financeiro/comissoes")({
  head: () => ({ meta: [{ title: "Comissões — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("financeiro.comissoes"),
  component: Pagina,
});

function Pagina() {
  return (
    <ModuloPlaceholder icon={Percent} titulo="Comissões" descricao="Comissões da equipe e parceiros." />
  );
}
