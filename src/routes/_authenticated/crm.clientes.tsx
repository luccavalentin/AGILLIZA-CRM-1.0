import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { ModuloPlaceholder } from "@/components/app-shell/modulo-placeholder";
import { assertModuloPermitido } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/crm/clientes")({
  head: () => ({ meta: [{ title: "Clientes — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("crm.clientes"),
  component: Pagina,
});

function Pagina() {
  return (
    <ModuloPlaceholder icon={Users} titulo="Clientes" descricao="Gestão de clientes do seu ecossistema." />
  );
}
