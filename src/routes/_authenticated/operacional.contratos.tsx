import { createFileRoute } from "@tanstack/react-router";
import { FileSignature } from "lucide-react";
import { ModuloPlaceholder } from "@/components/app-shell/modulo-placeholder";
import { assertModuloPermitido } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/operacional/contratos")({
  head: () => ({ meta: [{ title: "Contratos — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.contratos"),
  component: Pagina,
});

function Pagina() {
  return (
    <ModuloPlaceholder icon={FileSignature} titulo="Contratos" descricao="Contratos em andamento e concluídos." />
  );
}
