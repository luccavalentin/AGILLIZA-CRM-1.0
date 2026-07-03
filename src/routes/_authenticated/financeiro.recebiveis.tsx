import { createFileRoute } from "@tanstack/react-router";
import { Wallet } from "lucide-react";
import { ModuloPlaceholder } from "@/components/app-shell/modulo-placeholder";
import { assertModuloPermitido } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/financeiro/recebiveis")({
  head: () => ({ meta: [{ title: "Recebíveis — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("financeiro.recebiveis"),
  component: Pagina,
});

function Pagina() {
  return (
    <ModuloPlaceholder icon={Wallet} titulo="Recebíveis" descricao="Recebíveis e fluxo financeiro." />
  );
}
