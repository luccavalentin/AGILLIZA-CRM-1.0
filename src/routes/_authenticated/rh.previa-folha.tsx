import { createFileRoute } from "@tanstack/react-router";
import { UserRound } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import { ModuloPlaceholder } from "@/components/app-shell/modulo-placeholder";

export const Route = createFileRoute("/_authenticated/rh/previa-folha")({
  head: () => ({ meta: [{ title: "RH — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("rh.dashboard"),
  component: () => (
    <ModuloPlaceholder
      icon={UserRound}
      titulo="Gestão de Pessoas e RH"
      descricao="Este submódulo faz parte da próxima etapa do RH."
    />
  ),
});
