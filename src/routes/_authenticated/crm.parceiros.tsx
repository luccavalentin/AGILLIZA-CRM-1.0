import { createFileRoute } from "@tanstack/react-router";
import { Handshake } from "lucide-react";
import { ModuloPlaceholder } from "@/components/app-shell/modulo-placeholder";
import { assertModuloPermitido } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/crm/parceiros")({
  head: () => ({ meta: [{ title: "Parceiros — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("crm.parceiros"),
  component: Pagina,
});

function Pagina() {
  return (
    <ModuloPlaceholder icon={Handshake} titulo="Parceiros" descricao="Imobiliárias e corretores parceiros." />
  );
}
