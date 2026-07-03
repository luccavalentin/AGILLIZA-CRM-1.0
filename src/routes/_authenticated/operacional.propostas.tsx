import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { ModuloPlaceholder } from "@/components/app-shell/modulo-placeholder";
import { assertModuloPermitido } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/operacional/propostas")({
  head: () => ({ meta: [{ title: "Propostas — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.propostas"),
  component: Pagina,
});

function Pagina() {
  return (
    <ModuloPlaceholder icon={FileText} titulo="Propostas" descricao="Propostas enviadas aos bancos." />
  );
}
